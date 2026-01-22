import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import { dbManager } from './db-manager'

class RemoteManager {
    init() {
        this.checkDependencies()

        ipcMain.handle('remote:launch', async (_, { protocol, host, port, username, password, resolution }) => {
            console.log(`[Remote] Launching ${protocol} session for ${host}:${port}`)

            const deps = await this.checkDependencies()
            if (protocol === 'rdp' && !deps.rdp) {
                return { success: false, error: 'FreeRDP argument (xfreerdp/wfreerdp) is not found in PATH.' }
            }
            if (protocol === 'vnc' && !deps.vnc) {
                return { success: false, error: 'VNC Viewer is not found in PATH.' }
            }

            try {
                if (protocol === 'rdp') {
                    return this.launchRDP(host, port, username, password, resolution)
                } else if (protocol === 'vnc') {
                    return this.launchVNC(host, port, username, password)
                }
                return { success: false, error: 'Unsupported protocol' }
            } catch (error: any) {
                console.error('[Remote] Launch Error:', error)
                return { success: false, error: error.message }
            }
        })
    }

    private getBinaryName(type: 'rdp' | 'vnc') {
        const isWin = process.platform === 'win32'
        if (type === 'rdp') return isWin ? 'wfreerdp' : 'xfreerdp'
        if (type === 'vnc') return isWin ? 'vncviewer' : 'vncviewer'
        return ''
    }

    private async checkDependencies() {
        const rdpBin = this.getBinaryName('rdp')
        const vncBin = this.getBinaryName('vnc')
        const checkCmd = process.platform === 'win32' ? 'where' : 'which'

        const check = (cmd: string) => new Promise<boolean>(resolve => {
            const child = spawn(checkCmd, [cmd])
            child.on('close', code => resolve(code === 0))
        })

        const rdp = await check(rdpBin)
        const vnc = await check(vncBin)

        if (!rdp) console.warn(`[Remote] Warning: ${rdpBin} not found!`)
        if (!vnc) console.warn(`[Remote] Warning: ${vncBin} not found!`)

        return { rdp, vnc }
    }

    private launchRDP(host: string, port: number, username?: string, password?: string, resolution?: string): Promise<{ success: boolean, error?: string }> {
        return new Promise((resolve) => {
            const binary = this.getBinaryName('rdp')
            const isWin = process.platform === 'win32'

            const args = [
                `/v:${host}:${port}`,
                '/title:RDP - Zenmius',
                '/cert-ignore',
                '+clipboard',
                '/gdi:sw',
                '/network:auto',
                '+fonts',
                '/floatbar:sticky:on,default:visible,show:always'
            ]

            if (!isWin) {
                args.push('/sound:sys:alsa', '/microphone:sys:alsa')
                args.push('+window-drag')
                args.push('/wm-class:Zenmius')
            }

            if (resolution === 'fullscreen' || !resolution) {
                args.push('/f')
            } else if (resolution === 'smart') {
                args.push('/dynamic-resolution', '/size:1280x720')
            } else {
                args.push(`/size:${resolution}`)
            }

            if (username) args.push(`/u:${username}`)
            if (password) args.push(`/p:${password}`)

            console.log(`[Remote] Spawning ${binary} with args:`, args)

            try {
                const child = spawn(binary, args, { detached: false, stdio: 'pipe' })
                let outputBuffer = ''
                let exited = false

                const checkOutput = (data: string) => {
                    outputBuffer += data
                    const str = data.toString()

                    // Critical Error Detection
                    const errorKeywords = [
                        'ERRCONNECT_CONNECT_FAILED',
                        'failed to connect',
                        'Connection refused',
                        'Host not found',
                        'Authentication failure'
                    ]

                    const foundError = errorKeywords.find(k => str.includes(k))
                    if (foundError) {
                        child.kill()
                        const errorMsg = `Connection Error: ${foundError} (Check logs/VPN)`

                        dbManager.addLog({
                            type: 'error',
                            module: 'RDP',
                            action: 'connect',
                            message: errorMsg,
                            details: str.slice(0, 500)
                        })

                        if (!exited) {
                            exited = true
                            resolve({ success: false, error: errorMsg })
                        } else {
                            // Late failure notification
                            const win = BrowserWindow.getAllWindows()[0]
                            win?.webContents.send('app:notification', {
                                type: 'error',
                                message: errorMsg
                            })
                        }
                        return
                    }

                    // Blocking Prompt Detection
                    if (str.includes('Password:') || str.includes('password:')) {
                        child.kill()
                        if (!exited) {
                            exited = true
                            resolve({ success: false, error: 'Launch Failed: Process is waiting for password.' })
                            dbManager.addLog({
                                type: 'warn',
                                module: 'RDP',
                                action: 'launch',
                                message: 'Process waiting for password interactively',
                                details: 'User must save password in settings.'
                            })
                        }
                    }
                    if (str.includes('(Y/N)') || str.includes('[y/n]')) {
                        child.kill()
                        if (!exited) {
                            exited = true
                            resolve({ success: false, error: 'Launch Failed: Host verification required.' })
                            dbManager.addLog({
                                type: 'warn',
                                module: 'RDP',
                                action: 'launch',
                                message: 'Host verification required (Y/N prompt)',
                                details: 'First connection usually requires trusting the certificate.'
                            })
                        }
                    }
                }

                child.stdout?.on('data', (data) => checkOutput(data.toString()))
                child.stderr?.on('data', (data) => {
                    const str = data.toString()
                    console.error(`[RDP stderr]: ${str}`)
                    checkOutput(str)
                })

                child.on('error', (err) => {
                    if (!exited) {
                        dbManager.addLog({ type: 'error', module: 'RDP', action: 'spawn', message: err.message })
                        resolve({ success: false, error: 'Spawn Error: ' + err.message })
                    }
                })

                const exitHandler = (code: number) => {
                    if (exited) return // Already handled

                    exited = true
                    if (code !== 0) {
                        const lastLine = outputBuffer.trim().split('\n').pop() || 'Unknown Error'
                        const fullError = `RDP exited with code ${code}. Details: ${lastLine.slice(0, 100)}`

                        dbManager.addLog({
                            type: 'error',
                            module: 'RDP',
                            action: 'crash-early',
                            message: `Process exited with code ${code}`,
                            details: outputBuffer.slice(0, 500)
                        })

                        resolve({ success: false, error: fullError })
                    } else {
                        resolve({ success: true })
                    }
                }
                // Only attach one exit handler initially
                child.on('close', exitHandler)

                setTimeout(() => {
                    if (!exited) {
                        // Mark as "Started Successfully" (timeout reached without crash)
                        child.off('close', exitHandler) // Remove the initial resolver
                        exited = true // Prevent the initial resolve from firing later
                        resolve({ success: true })

                        dbManager.addLog({
                            type: 'success',
                            module: 'RDP',
                            action: 'launch',
                            message: 'Session started successfully'
                        })

                        // Monitor for late crashes (AFTER 3s)
                        child.on('close', (code) => {
                            console.log(`[RDP] Session ended with code ${code}`)
                            if (code !== 0) {
                                // Extract meaningful error from buffer if possible
                                const errorLines = outputBuffer.split('\n').filter(l => l.includes('ERROR') || l.includes('failed'))
                                const reason = errorLines.length > 0 ? errorLines[errorLines.length - 1] : `Code ${code}`

                                dbManager.addLog({
                                    type: 'error',
                                    module: 'RDP',
                                    action: 'crash-late',
                                    message: `Session Crashed: ${reason.slice(0, 100)}`,
                                    details: outputBuffer.slice(0, 1000)
                                })

                                const win = BrowserWindow.getAllWindows()[0]
                                win?.webContents.send('app:notification', {
                                    type: 'error',
                                    message: `RDP Session Crashed: ${reason.slice(0, 60)}...`
                                })
                            } else {
                                dbManager.addLog({
                                    type: 'info',
                                    module: 'RDP',
                                    action: 'close',
                                    message: 'Session closed cleanly'
                                })
                            }
                        })
                    }
                }, 3000)

            } catch (e: any) {
                resolve({ success: false, error: e.message })
            }
        })
    }

    private launchVNC(host: string, port: number, _username?: string, _password?: string): Promise<{ success: boolean, error?: string }> {
        return new Promise((resolve) => {
            const target = `${host}:${port}`
            const args = [target]
            const binary = this.getBinaryName('vnc')

            console.log(`[Remote] Spawning ${binary} for:`, target)

            try {
                const child = spawn(binary, args, { detached: false, stdio: 'pipe' })
                let outputBuffer = ''
                let exited = false

                child.stderr?.on('data', (data) => {
                    outputBuffer += data.toString()
                    console.error(`[VNC stderr]: ${data}`)
                })

                child.on('error', (err) => {
                    if (!exited) {
                        dbManager.addLog({ type: 'error', module: 'VNC', action: 'spawn', message: err.message })
                        resolve({ success: false, error: 'Spawn Error: ' + err.message })
                    }
                })

                const exitHandler = (code: number) => {
                    if (exited) return
                    exited = true

                    if (code !== 0) {
                        const lastLine = outputBuffer.trim().split('\n').pop() || 'Unknown Error'
                        dbManager.addLog({
                            type: 'error',
                            module: 'VNC',
                            action: 'crash-early',
                            message: `Process exited with code ${code}`,
                            details: outputBuffer.slice(0, 500)
                        })
                        resolve({ success: false, error: `VNC exited with code ${code}. Details: ${lastLine.slice(0, 100)}` })
                    } else {
                        resolve({ success: true })
                    }
                }
                child.on('close', exitHandler)

                setTimeout(() => {
                    if (!exited) {
                        child.off('close', exitHandler)
                        exited = true
                        resolve({ success: true })

                        dbManager.addLog({
                            type: 'success',
                            module: 'VNC',
                            action: 'launch',
                            message: 'Session started successfully'
                        })

                        child.on('close', (code) => {
                            console.log(`[VNC] Session ended with code ${code}`)
                            if (code !== 0) {
                                dbManager.addLog({
                                    type: 'error',
                                    module: 'VNC',
                                    action: 'crash-late',
                                    message: `Session Crashed (Code ${code})`,
                                    details: outputBuffer.slice(0, 1000)
                                })
                                const win = BrowserWindow.getAllWindows()[0]
                                win?.webContents.send('app:notification', {
                                    type: 'error',
                                    message: `VNC Session crashed (Code ${code}). Check logs for details.`
                                })
                            } else {
                                dbManager.addLog({
                                    type: 'info',
                                    module: 'VNC',
                                    action: 'close',
                                    message: 'Session closed cleanly'
                                })
                            }
                        })
                    }
                }, 3000)

            } catch (e: any) {
                resolve({ success: false, error: e.message })
            }
        })
    }
}

export const remoteManager = new RemoteManager()
