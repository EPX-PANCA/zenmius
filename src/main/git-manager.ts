import { ipcMain, app } from 'electron'
import { vaultManager } from './vault-manager'
import { dbManager } from './db-manager'
import * as git from 'isomorphic-git'
import * as fs from 'fs'
import * as path from 'path'
import http from 'isomorphic-git/http/node'

const USER_DATA = app.getPath('userData')
const SYNC_DIR = path.join(USER_DATA, 'sync-repo')
const ENC_DB_FILE = path.join(SYNC_DIR, 'zenmius_db.enc')

class GitManager {
    public init() {
        this.setupHandlers()
    }

    private getOnAuth(token: string, explicitUsername?: string) {
        let attempts = 0
        const trimmedToken = token.trim()
        const trimmedUser = explicitUsername?.trim()

        return (url: string) => {
            attempts++
            const isGitLab = url.toLowerCase().includes('gitlab')
            if (trimmedUser && attempts === 1) return { username: trimmedUser, password: trimmedToken }
            if (isGitLab) {
                if (attempts === 1 || (trimmedUser && attempts === 2)) return { username: 'oauth2', password: trimmedToken }
                if (attempts === 2 || (trimmedUser && attempts === 3)) return { username: 'gitlab-token', password: trimmedToken }
                return { username: 'git', password: trimmedToken }
            } else {
                if (attempts === 1 || (trimmedUser && attempts === 2)) return { username: trimmedToken, password: '' }
                return { username: 'token', password: trimmedToken }
            }
        }
    }

    private setupHandlers() {
        ipcMain.handle('git:check-status', async (_, { url, token, username }) => {
            try {
                const safeUrl = url.trim()
                const refs = await git.listServerRefs({ http, url: safeUrl, onAuth: this.getOnAuth(token, username) })
                return { success: true, isEmpty: refs.length === 0 }
            } catch (error: any) {
                return { success: false, error: error.message }
            }
        })

        ipcMain.handle('git:clone', async (_, { url, token, username }) => {
            try {
                const safeUrl = url.trim()
                if (fs.existsSync(SYNC_DIR)) fs.rmSync(SYNC_DIR, { recursive: true, force: true })
                fs.mkdirSync(SYNC_DIR, { recursive: true })
                await git.clone({ fs, http, dir: SYNC_DIR, url: safeUrl, onAuth: this.getOnAuth(token, username), singleBranch: true, depth: 1 })
                fs.writeFileSync(path.join(SYNC_DIR, '.git-credentials-cache.json'), JSON.stringify({ url: safeUrl, token, username }))
                return { success: true }
            } catch (error: any) {
                return { success: false, error: error.message }
            }
        })

        ipcMain.handle('git:sync', async (_, { token, url, username, mode = 'merge', commitMessage }) => {
            if (!url || !token) {
                try {
                    const cache = JSON.parse(fs.readFileSync(path.join(SYNC_DIR, '.git-credentials-cache.json'), 'utf-8'))
                    token = token || cache.token
                    url = url || cache.url
                    username = username || cache.username
                } catch (e) {
                    return { success: false, error: 'Missing Credentials' }
                }
            }

            const safeUrl = url.trim()
            const vaultStatus = await vaultManager.status()
            if (vaultStatus.locked) return { success: false, error: 'Vault is LOCKED' }

            const runSync = async (retry = true): Promise<{ success: boolean; error?: string }> => {
                const log = (msg: string) => console.log(`[GitSync] ${msg}`)
                const branch = 'main'
                const fullBranchRef = `refs/heads/${branch}`

                try {
                    // 1. REPO INIT
                    const dotGit = path.join(SYNC_DIR, '.git')
                    if (!fs.existsSync(dotGit)) {
                        log('Initializing fresh repository...')
                        if (fs.existsSync(SYNC_DIR)) fs.rmSync(SYNC_DIR, { recursive: true, force: true })
                        fs.mkdirSync(SYNC_DIR, { recursive: true })
                        await git.init({ fs, dir: SYNC_DIR, defaultBranch: branch })
                        // Ensure HEAD is explicitly set to our branch
                        fs.writeFileSync(path.join(dotGit, 'HEAD'), `ref: ${fullBranchRef}\n`)
                    }

                    // 2. REMOTE CONFIG
                    try {
                        await git.addRemote({ fs, dir: SYNC_DIR, remote: 'origin', url: safeUrl })
                    } catch (e) {
                        try {
                            await git.deleteRemote({ fs, dir: SYNC_DIR, remote: 'origin' })
                            await git.addRemote({ fs, dir: SYNC_DIR, remote: 'origin', url: safeUrl })
                        } catch (re) { }
                    }

                    // 3. REMOTE CHECK
                    let remoteHasData = false
                    try {
                        const refs = await git.listServerRefs({
                            http, url: safeUrl,
                            onAuth: this.getOnAuth(token, username)
                        })
                        remoteHasData = refs.length > 0
                        log(`Remote status: ${remoteHasData ? 'Contains data' : 'Empty'}`)
                    } catch (e) {
                        log('Remote check failed: ' + (e as Error).message)
                    }

                    // 4. PULL (Mode Merge or Pull)
                    if (remoteHasData && mode !== 'push') {
                        try {
                            log('Pulling latest changes...')
                            await git.pull({
                                fs, http, dir: SYNC_DIR,
                                author: { name: 'Zenmius', email: 'bot@zenmius.io' },
                                ref: branch,
                                singleBranch: true,
                                onAuth: this.getOnAuth(token, username)
                            })
                        } catch (e: any) {
                            log('Pull encountered an issue: ' + e.message)
                        }
                    }

                    // 5. DATA IMPORT
                    // We skip import if mode is 'push' because push means "Replace remote with local"
                    // If we import first, we overwrite local changes with old remote data before pushing.
                    if (fs.existsSync(ENC_DB_FILE) && mode !== 'push') {
                        try {
                            const encData = JSON.parse(fs.readFileSync(ENC_DB_FILE, 'utf-8'))
                            const decrypted = await vaultManager.decryptData(encData)
                            if (decrypted.success) {
                                // Check if this is the new combined format
                                if (decrypted.data.db && decrypted.data.vault) {
                                    dbManager.importData(decrypted.data.db)
                                    // Save vault data directly
                                    // access private method or expose a setter? 
                                    // Using the public IPC handler logic equivalent:
                                    const saveResult = await vaultManager.saveDirect(decrypted.data.vault)
                                    if (!saveResult.success) log('Vault import warning: ' + saveResult.error)
                                    else log('Vault data merged from sync.')
                                } else {
                                    // Legacy format (just DB data)
                                    dbManager.importData(decrypted.data)
                                }
                                log('Data imported from sync file.')
                            }
                        } catch (e) {
                            log('Import failed: ' + (e as Error).message)
                        }
                    }

                    // 6. COMMIT & PUSH (Mode Merge or Push)
                    if (mode === 'push' || mode === 'merge') {
                        log(`Preparing ${mode} operation...`)
                        const dbData = dbManager.exportData()
                        const vaultRes = await vaultManager.loadDirect() // Need to expose this
                        const vaultData = vaultRes.success ? vaultRes.data : {}

                        const combinedPayload = {
                            db: dbData,
                            vault: vaultData
                        }

                        const encResult = await vaultManager.encryptData(combinedPayload)
                        if (!encResult.success) throw new Error(encResult.error)

                        fs.writeFileSync(ENC_DB_FILE, JSON.stringify(encResult.payload))

                        log('Git Add...')
                        await git.add({ fs, dir: SYNC_DIR, filepath: '.' })

                        log('Git Commit...')
                        let headOid = ''
                        try {
                            headOid = await git.resolveRef({ fs, dir: SYNC_DIR, ref: 'HEAD' })
                        } catch (e) { }

                        try {
                            const newCommitOid = await git.commit({
                                fs, dir: SYNC_DIR,
                                author: { name: 'Zenmius', email: 'sync@zenmius.io' },
                                message: commitMessage || `Sync Update: ${new Date().toISOString()}`,
                                ref: branch
                            })
                            log(`Commit created: ${newCommitOid}`)
                        } catch (e: any) {
                            if (e.code === 'NothingToCommitError') {
                                log('Nothing to commit.')
                                if (!headOid) {
                                    log('Repository is empty - forcing initial commit')
                                    await git.commit({
                                        fs, dir: SYNC_DIR,
                                        author: { name: 'Zenmius', email: 'sync@zenmius.io' },
                                        message: 'Initialize Sync Branch',
                                        ref: branch
                                    })
                                }
                            } else {
                                throw e
                            }
                        }

                        // Ensure we point HEAD to the branch before push
                        // We use writeRef instead of branch() to be more direct and avoid HEAD resolution issues
                        await git.writeRef({
                            fs, dir: SYNC_DIR,
                            ref: 'HEAD',
                            value: fullBranchRef,
                            force: true,
                            symbolic: true
                        })

                        log('Git Push...')
                        await git.push({
                            fs, http, dir: SYNC_DIR,
                            ref: branch,
                            remoteRef: branch,
                            force: mode === 'push' || !remoteHasData,
                            onAuth: this.getOnAuth(token, username)
                        })
                        log('Push successful.')
                    }

                    return { success: true }
                } catch (error: any) {
                    log('CRITICAL: ' + error.message)
                    if (retry && (error.code === 'NotFoundError' || error.message.includes('HEAD') || error.message.includes('resolve'))) {
                        log('Self-Healing: Wiping sync cache and retrying once...')
                        if (fs.existsSync(SYNC_DIR)) fs.rmSync(SYNC_DIR, { recursive: true, force: true })
                        return await runSync(false)
                    }
                    return { success: false, error: error.message }
                }
            }

            return await runSync()
        })
    }
}

export const gitManager = new GitManager()
