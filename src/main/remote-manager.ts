import { ipcMain } from 'electron'
import { spawn } from 'child_process'

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

    private launchRDP(host: string, port: number, username?: string, password?: string, resolution?: string) {
        const binary = this.getBinaryName('rdp')
        const isWin = process.platform === 'win32'

        // Construct xfreerdp arguments
        const args = [
            `/v:${host}:${port}`,
            '/title:RDP - Zenmius', // Set window title
            '/cert-ignore',
            '+clipboard',
            '/gdi:sw', // Use software rendering for stability
            '/network:auto', // Optimize connections
            '+fonts',
            '/floatbar:sticky:on,default:visible,show:always'
        ]

        // Add Linux-specific flags
        if (!isWin) {
            args.push('/sound:sys:alsa', '/microphone:sys:alsa')
            args.push('+window-drag')
            args.push('/wm-class:Zenmius')
        }

        // Resolution Logic
        if (resolution === 'fullscreen' || !resolution) {
            args.push('/f')
        } else if (resolution === 'smart') {
            args.push('/dynamic-resolution', '/size:1280x720') // Enable dynamic resolution for resizing
        } else {
            // Specific resolution e.g., 1920x1080
            args.push(`/size:${resolution}`)
        }

        if (username) args.push(`/u:${username}`)
        if (password) args.push(`/p:${password}`)

        console.log(`[Remote] Spawning ${binary} with args:`, args)

        try {
            const child = spawn(binary, args, {
                detached: false, // Keep attached to see output for now
                stdio: 'pipe'
            })

            child.stdout?.on('data', (data) => {
                console.log(`[RDP stdout]: ${data}`)
            })

            child.stderr?.on('data', (data) => {
                console.error(`[RDP stderr]: ${data}`)
            })

            child.on('error', (err) => {
                console.error('[Remote] Failed to start RDP process:', err)
            })

            child.on('close', (code) => {
                console.log(`[RDP] Process exited with code ${code}`)
            })

            // child.unref() // Keep referenced to ensure we get output
            return { success: true }
        } catch (e: any) {
            return { success: false, error: e.message }
        }
    }

    private launchVNC(host: string, port: number, _username?: string, _password?: string) {
        const target = `${host}:${port}`
        const args = [target]
        const binary = this.getBinaryName('vnc')

        console.log(`[Remote] Spawning ${binary} for:`, target)

        try {
            const child = spawn(binary, args, {
                detached: false,
                stdio: 'pipe'
            })

            child.stdout?.on('data', (data) => {
                console.log(`[VNC stdout]: ${data}`)
            })

            child.stderr?.on('data', (data) => {
                console.error(`[VNC stderr]: ${data}`)
            })

            child.on('error', (err) => {
                console.error('[Remote] Failed to start VNC process:', err)
            })

            child.on('close', (code) => {
                console.log(`[VNC] Process exited with code ${code}`)
            })

            // child.unref()
            return { success: true }
        } catch (e: any) {
            return { success: false, error: e.message }
        }
    }
}

export const remoteManager = new RemoteManager()
