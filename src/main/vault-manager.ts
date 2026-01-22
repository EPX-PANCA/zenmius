import { ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
const libsodiumRaw = require('libsodium-wrappers-sumo')
const libsodium = libsodiumRaw.default || libsodiumRaw

const VAULT_PATH = path.join(app.getPath('userData'), 'vault.json')
const METADATA_PATH = path.join(app.getPath('userData'), 'vault_meta.json')

class VaultManager {
    private masterKey: Uint8Array | null = null

    public init() {
        console.log('[Vault] Libsodium keys:', Object.keys(libsodium))
        this.setupHandlers()
    }

    public status() {
        return { locked: this.masterKey === null }
    }

    public async encryptData(data: any) {
        if (!this.masterKey) return { success: false, error: 'Vault Locked' }
        try {
            const NONCE_BYTES = libsodium.crypto_secretbox_NONCEBYTES || 24
            const nonce = libsodium.randombytes_buf(NONCE_BYTES) as Uint8Array
            const encrypted = libsodium.crypto_secretbox_easy(
                JSON.stringify(data),
                nonce,
                this.masterKey
            )
            return {
                success: true,
                payload: {
                    nonce: libsodium.to_hex(nonce),
                    ciphertext: libsodium.to_hex(encrypted)
                }
            }
        } catch (e: any) {
            return { success: false, error: e.message }
        }
    }

    public async loadDirect() {
        return this.decryptVault()
    }

    public async saveDirect(data: any) {
        if (!this.masterKey) return { success: false, error: 'Vault Locked' }
        try {
            const NONCE_BYTES = libsodium.crypto_secretbox_NONCEBYTES || 24
            const nonce = libsodium.randombytes_buf(NONCE_BYTES) as Uint8Array
            const encrypted = libsodium.crypto_secretbox_easy(
                JSON.stringify(data),
                nonce,
                this.masterKey
            )

            const payload = {
                nonce: libsodium.to_hex(nonce),
                ciphertext: libsodium.to_hex(encrypted)
            }

            fs.writeFileSync(VAULT_PATH, JSON.stringify(payload))
            return { success: true }
        } catch (error: any) {
            return { success: false, error: 'Failed to save vault: ' + error.message }
        }
    }

    public async decryptData(payload: any) {
        if (!this.masterKey) return { success: false, error: 'Vault Locked' }
        try {
            const nonce = libsodium.from_hex(payload.nonce) as Uint8Array
            const ciphertext = libsodium.from_hex(payload.ciphertext) as Uint8Array

            const decrypted = libsodium.crypto_secretbox_open_easy(
                ciphertext,
                nonce,
                this.masterKey
            )
            if (!decrypted) throw new Error('Decryption Failed')

            return { success: true, data: JSON.parse(libsodium.to_string(decrypted)) }
        } catch (e: any) {
            return { success: false, error: e.message }
        }
    }

    private async getSalt(_password: string): Promise<Uint8Array> {
        await libsodium.ready
        const SALT_BYTES = libsodium.crypto_pwhash_SALTBYTES || 16

        try {
            if (fs.existsSync(METADATA_PATH)) {
                const raw = fs.readFileSync(METADATA_PATH, 'utf-8')
                if (raw && raw.trim()) {
                    const meta = JSON.parse(raw)
                    if (meta && meta.salt && typeof meta.salt === 'string') {
                        return libsodium.from_hex(meta.salt) as Uint8Array
                    }
                }
                console.warn('[Vault] Metadata corrupted or invalid salt format.')
            }
        } catch (e) {
            console.error('[Vault] Error reading metadata:', e)
        }

        // Fallback: Create new salt
        console.log('[Vault] Creating new salt')
        const salt = libsodium.randombytes_buf(SALT_BYTES) as Uint8Array
        try {
            fs.writeFileSync(METADATA_PATH, JSON.stringify({ salt: libsodium.to_hex(salt) }))
        } catch (e) {
            console.error('[Vault] Failed to write metadata:', e)
        }
        return salt
    }

    private setupHandlers() {
        ipcMain.handle('vault:save-credential', async (_, { hostId, password, username }) => {
            console.log('[Vault] Saving credential for host:', hostId)
            if (!this.masterKey) {
                console.error('[Vault] Save failed: Vault locked')
                return { success: false, error: 'Vault locked' }
            }

            try {
                // 1. Load existing
                const current = await this.decryptVault()
                const data = (current.success && current.data && typeof current.data === 'object' && !Array.isArray(current.data))
                    ? current.data
                    : { hosts: {} }

                // 2. Update
                if (!data.hosts) data.hosts = {}
                data.hosts[hostId] = { password, username, updatedAt: new Date().toISOString() }

                console.log('[Vault] Updated credential payload for', hostId)

                // 3. Save
                const NONCE_BYTES = libsodium.crypto_secretbox_NONCEBYTES || 24
                const nonce = libsodium.randombytes_buf(NONCE_BYTES) as Uint8Array
                const encrypted = libsodium.crypto_secretbox_easy(
                    JSON.stringify(data),
                    nonce,
                    this.masterKey
                )

                fs.writeFileSync(VAULT_PATH, JSON.stringify({
                    nonce: libsodium.to_hex(nonce),
                    ciphertext: libsodium.to_hex(encrypted)
                }))

                console.log('[Vault] Saved to disk successfully')
                return { success: true }
            } catch (e: any) {
                console.error('[Vault] Save Error:', e)
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('vault:get-credential', async (_, hostId) => {
            if (!this.masterKey) return { success: false, error: 'Vault locked' }

            const current = await this.decryptVault()
            if (!current.success) return current

            const data = (current.data && typeof current.data === 'object' && !Array.isArray(current.data))
                ? current.data
                : { hosts: {} }

            const cred = data.hosts?.[hostId] || null
            console.log(`[Vault] Get credential for ${hostId}:`, cred ? 'FOUND' : 'NOT FOUND')
            return { success: true, credential: cred }
        })

        ipcMain.handle('vault:init', async (_, password) => {
            try {
                await libsodium.ready
                const salt = (await this.getSalt(password)) as Uint8Array
                this.masterKey = libsodium.crypto_pwhash(
                    libsodium.crypto_secretbox_KEYBYTES,
                    password,
                    salt,
                    libsodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
                    libsodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
                    libsodium.crypto_pwhash_ALG_DEFAULT
                ) as Uint8Array

                // Verify if we can decrypt existing vault if it exists
                if (fs.existsSync(VAULT_PATH)) {
                    // Force ensure masterKey is set before decrypting (it is set above)
                    if (!this.masterKey) throw new Error('Master Key generation failed')

                    const loadResult = await this.decryptVault()
                    if (!loadResult.success) {
                        console.error('[Vault] Init failed verification:', loadResult.error)
                        this.masterKey = null // Reset if password is wrong
                        return { success: false, error: 'Invalid Master Password (or corrupted vault)' }
                    }
                }
                return { success: true }
            } catch (error: any) {
                console.error('[Vault] Init Critical Error:', error)
                return { success: false, error: error.message || 'Unknown Vault Error' }
            }
        })

        ipcMain.handle('vault:change-password', async (_, { newPassword }) => {
            if (!this.masterKey) return { success: false, error: 'Vault must be unlocked first' }

            try {
                // 1. Decrypt current data
                const currentData = await this.decryptVault()
                if (!currentData.success) throw new Error('Failed to decrypt current vault')

                // 2. Generate NEW salt
                const SALT_BYTES = libsodium.crypto_pwhash_SALTBYTES || 16
                const newSalt = libsodium.randombytes_buf(SALT_BYTES) as Uint8Array

                // 3. Generate NEW master key
                const newMasterKey = libsodium.crypto_pwhash(
                    libsodium.crypto_secretbox_KEYBYTES,
                    newPassword,
                    newSalt,
                    libsodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
                    libsodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
                    libsodium.crypto_pwhash_ALG_DEFAULT
                ) as Uint8Array

                // 4. Encrypt data with NEW key
                const NONCE_BYTES = libsodium.crypto_secretbox_NONCEBYTES || 24
                const nonce = libsodium.randombytes_buf(NONCE_BYTES) as Uint8Array
                const encrypted = libsodium.crypto_secretbox_easy(
                    JSON.stringify(currentData.data),
                    nonce,
                    newMasterKey
                )

                // 5. Save everything
                const payload = {
                    nonce: libsodium.to_hex(nonce),
                    ciphertext: libsodium.to_hex(encrypted)
                }

                fs.writeFileSync(VAULT_PATH, JSON.stringify(payload))
                fs.writeFileSync(METADATA_PATH, JSON.stringify({ salt: libsodium.to_hex(newSalt) }))

                // 6. Update in-memory key
                this.masterKey = newMasterKey

                return { success: true }
            } catch (error: any) {
                return { success: false, error: error.message }
            }
        })

        ipcMain.handle('vault:save', async (_, data) => {
            if (!this.masterKey) return { success: false, error: 'Vault locked' }

            try {
                const NONCE_BYTES = libsodium.crypto_secretbox_NONCEBYTES || 24
                const nonce = libsodium.randombytes_buf(NONCE_BYTES) as Uint8Array
                const encrypted = libsodium.crypto_secretbox_easy(
                    JSON.stringify(data),
                    nonce,
                    this.masterKey
                )

                const payload = {
                    nonce: libsodium.to_hex(nonce),
                    ciphertext: libsodium.to_hex(encrypted)
                }

                fs.writeFileSync(VAULT_PATH, JSON.stringify(payload))
                return { success: true }
            } catch (error: any) {
                return { success: false, error: 'Failed to save vault: ' + error.message }
            }
        })

        ipcMain.handle('vault:load', async () => {
            return await this.decryptVault()
        })

        ipcMain.handle('vault:lock', () => {
            this.masterKey = null
            return { success: true }
        })

        ipcMain.handle('vault:status', () => {
            return { locked: this.masterKey === null }
        })
    }

    private async decryptVault() {
        if (!this.masterKey) return { success: false, error: 'Vault locked' }
        if (!fs.existsSync(VAULT_PATH)) return { success: true, data: [] }

        try {
            const raw = fs.readFileSync(VAULT_PATH, 'utf-8')
            if (!raw || raw.trim() === '') return { success: true, data: [] }

            let payload;
            try {
                payload = JSON.parse(raw)
            } catch (e) {
                return { success: false, error: 'Vault JSON corrupted' }
            }

            if (!payload || !payload.nonce || typeof payload.nonce !== 'string' || !payload.ciphertext || typeof payload.ciphertext !== 'string') {
                console.error('[Vault] Invalid payload format:', payload)
                throw new Error('Invalid vault format or corruption')
            }

            const nonce = libsodium.from_hex(payload.nonce) as Uint8Array
            const ciphertext = libsodium.from_hex(payload.ciphertext) as Uint8Array

            if (!this.masterKey) throw new Error('Master key lost during decryption')

            const decrypted = libsodium.crypto_secretbox_open_easy(
                ciphertext,
                nonce,
                this.masterKey
            )

            if (!decrypted) throw new Error('Decryption returned null (Wrong Password?)')

            return { success: true, data: JSON.parse(libsodium.to_string(decrypted)) }
        } catch (e: any) {
            console.error('Vault Decryption Error:', e)
            return { success: false, error: 'Master Password verification failed or vault corrupted.' }
        }
    }
}

export const vaultManager = new VaultManager()
