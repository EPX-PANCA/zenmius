import { Client, ClientChannel, SFTPWrapper } from 'ssh2'
import { ipcMain, BrowserWindow, dialog } from 'electron'

interface SSHConfig {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
}

class SSHSessionManager {
    private sessions: Map<string, Client> = new Map()
    private streams: Map<string, ClientChannel> = new Map()
    private sftpSessions: Map<string, SFTPWrapper> = new Map()

    public init() {
        this.setupHandlers()
    }

    private setupHandlers() {
        ipcMain.handle('ssh:connect', async (event, { id, config }: { id: string, config: SSHConfig }) => {
            console.log(`[SSH] Connection Request: ${id} (${config.username}@${config.host})`)
            const window = BrowserWindow.fromWebContents(event.sender)
            if (!window) return

            try {
                await this.connect(id, config, window)
                console.log(`[SSH] Connection Success: ${id}`)
                return { success: true }
            } catch (error: any) {
                console.error(`SSH Connection Error [${id}]:`, error)
                return { success: false, error: error.message || 'Unknown SSH Error' }
            }
        })

        ipcMain.on('ssh:data', (_, { id, data }: { id: string, data: string }) => {
            const stream = this.streams.get(id)
            if (stream) {
                try {
                    stream.write(data)
                } catch (e) {
                    console.error(`Stream write error [${id}]:`, e)
                }
            }
        })

        ipcMain.on('ssh:resize', (_, { id, cols, rows }: { id: string, cols: number, rows: number }) => {
            const stream = this.streams.get(id)
            if (stream) {
                try {
                    stream.setWindow(rows, cols, 0, 0)
                } catch (e) {
                    // Ignore resize errors if stream is closing
                }
            }
        })

        ipcMain.on('ssh:disconnect', (_, id: string) => {
            this.disconnect(id)
        })

        // SFTP Handlers with Error Wrapping
        ipcMain.handle('sftp:list', async (_, { id, path }: { id: string, path: string }) => {
            console.log(`[SFTP] Requesting list for ${id} at ${path}`)
            try {
                const sftp = await this.getSFTP(id)
                return new Promise((resolve) => {
                    sftp.readdir(path, (err, list) => {
                        if (err) resolve({ success: false, error: `SFTP List Error: ${err.message}` })
                        else resolve({ success: true, list })
                    })
                })
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('sftp:mkdir', async (_, { id, path }: { id: string, path: string }) => {
            try {
                const sftp = await this.getSFTP(id)
                return new Promise((resolve) => {
                    sftp.mkdir(path, (err) => {
                        if (err) resolve({ success: false, error: err.message })
                        else resolve({ success: true })
                    })
                })
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('sftp:remove', async (_, { id, path, isDir }: { id: string, path: string, isDir: boolean }) => {
            try {
                const sftp = await this.getSFTP(id)
                return new Promise((resolve) => {
                    const method = isDir ? sftp.rmdir : sftp.unlink
                    method.call(sftp, path, (err) => {
                        if (err) resolve({ success: false, error: err.message })
                        else resolve({ success: true })
                    })
                })
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        // File Transfer Handlers
        ipcMain.handle('sftp:upload', async (event, { id, localPath, remotePath }: { id: string, localPath: string, remotePath: string }) => {
            try {
                const sftp = await this.getSFTP(id)
                const window = BrowserWindow.fromWebContents(event.sender)
                return new Promise((resolve) => {
                    sftp.fastPut(localPath, remotePath, {
                        step: (transferred, _, total) => {
                            if (window && !window.isDestroyed()) {
                                const percent = Math.round((transferred / total) * 100)
                                window.webContents.send(`sftp:progress:${id}`, { type: 'upload', percent, filename: remotePath })
                            }
                        }
                    }, (err) => {
                        if (err) resolve({ success: false, error: err.message })
                        else resolve({ success: true })
                    })
                })
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('sftp:download', async (event, { id, remotePath, localPath }: { id: string, remotePath: string, localPath: string }) => {
            try {
                const sftp = await this.getSFTP(id)
                const window = BrowserWindow.fromWebContents(event.sender)
                return new Promise((resolve) => {
                    sftp.fastGet(remotePath, localPath, {
                        step: (transferred, _, total) => {
                            if (window && !window.isDestroyed()) {
                                const percent = Math.round((transferred / total) * 100)
                                window.webContents.send(`sftp:progress:${id}`, { type: 'download', percent, filename: remotePath })
                            }
                        }
                    }, (err) => {
                        if (err) resolve({ success: false, error: err.message })
                        else resolve({ success: true })
                    })
                })
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('sftp:create-file', async (_, { id, path }: { id: string, path: string }) => {
            try {
                const sftp = await this.getSFTP(id)
                return new Promise((resolve) => {
                    // Create empty file
                    sftp.open(path, 'w', (err, handle) => {
                        if (err) {
                            resolve({ success: false, error: err.message })
                            return
                        }
                        sftp.close(handle, (err) => {
                            if (err) resolve({ success: false, error: err.message })
                            else resolve({ success: true })
                        })
                    })
                })
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        // Dialog Handlers
        ipcMain.handle('dialog:open-file', async () => {
            const result = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
            return { canceled: result.canceled, filePaths: result.filePaths }
        })

        ipcMain.handle('dialog:save-file', async (_, { defaultName }: { defaultName: string }) => {
            const result = await dialog.showSaveDialog({ defaultPath: defaultName })
            return { canceled: result.canceled, filePath: result.filePath }
        })
    }

    private async getSFTP(id: string): Promise<SFTPWrapper> {
        const conn = this.sessions.get(id)
        if (!conn) throw new Error('SSH session not found or disconnected. Please reconnect.')

        if (this.sftpSessions.has(id)) {
            // Basic check if sftp is still alive (no direct 'isAlive' but we can check session)
            return this.sftpSessions.get(id)!
        }

        return new Promise((resolve, reject) => {
            conn.sftp((err, sftp) => {
                if (err) {
                    reject(new Error(`Failed to initialize SFTP: ${err.message}`))
                } else {
                    this.sftpSessions.set(id, sftp)
                    sftp.on('close', () => this.sftpSessions.delete(id))
                    resolve(sftp)
                }
            })
        })
    }

    private async connect(id: string, config: SSHConfig, window: BrowserWindow): Promise<void> {
        const conn = new Client()

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                conn.end()
                reject(new Error('Connection timed out (30s)'))
            }, 30000)

            conn.on('ready', () => {
                console.log(`[SSH] Client Ready: ${id}`)
                clearTimeout(timeout)
                this.sessions.set(id, conn)

                conn.shell({ term: 'xterm-256color', rows: 24, cols: 80 }, (err, stream) => {
                    if (err) {
                        this.disconnect(id)
                        reject(err)
                        return
                    }

                    this.streams.set(id, stream)

                    stream.on('data', (data: Buffer) => {
                        window.webContents.send(`ssh:data:${id}`, data.toString('utf-8'))
                    })

                    stream.on('close', () => {
                        window.webContents.send(`ssh:closed:${id}`)
                        this.disconnect(id)
                    })

                    resolve()
                })
            }).on('error', (err) => {
                clearTimeout(timeout)
                this.disconnect(id)
                reject(err)
            }).on('end', () => {
                this.disconnect(id)
            }).on('close', () => {
                console.log(`[SSH] Client Closed: ${id}`)
                this.disconnect(id)
            }).connect({
                ...config,
                readyTimeout: 20000,
                keepaliveInterval: 10000,
                keepaliveCountMax: 3
            })
        })
    }

    private disconnect(id: string) {
        const stream = this.streams.get(id)
        if (stream) {
            try { stream.end() } catch (e) { }
            this.streams.delete(id)
        }

        const sftp = this.sftpSessions.get(id)
        if (sftp) {
            try { sftp.end() } catch (e) { }
            this.sftpSessions.delete(id)
        }

        const conn = this.sessions.get(id)
        if (conn) {
            try { conn.end() } catch (e) { }
            this.sessions.delete(id)
        }
    }
}

export const sshManager = new SSHSessionManager()
