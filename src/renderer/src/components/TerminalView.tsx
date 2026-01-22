import { useEffect, useRef } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useStore } from '../store/useStore'

interface TerminalViewProps {
    id: string
    config: {
        host: string
        port: number
        username: string
    }
    onClose?: () => void
    onConnected?: () => void
}

export function TerminalView({ id, config, onClose, onConnected }: TerminalViewProps) {
    const terminalRef = useRef<HTMLDivElement>(null)
    const xtermRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const hasConnected = useRef(false)
    const { notify, settings } = useStore()

    // Handle dynamic font size changes
    useEffect(() => {
        if (xtermRef.current && fitAddonRef.current) {
            xtermRef.current.options.fontSize = settings.terminalFontSize
            setTimeout(() => {
                fitAddonRef.current?.fit()
            }, 10)
        }
    }, [settings.terminalFontSize])

    useEffect(() => {
        if (!terminalRef.current) return

        const term = new Terminal({
            cursorBlink: true,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: settings.terminalFontSize,
            letterSpacing: 0,
            lineHeight: 1.4,
            theme: {
                background: '#0a0c10',
                foreground: '#f8fafc',
                cursor: '#6366f1',
                cursorAccent: '#0a0c10',
                selectionBackground: 'rgba(99, 102, 241, 0.3)',
                black: '#1e293b',
                red: '#ef4444',
                green: '#10b981',
                yellow: '#f59e0b',
                blue: '#3b82f6',
                magenta: '#a855f7',
                cyan: '#06b6d4',
                white: '#f8fafc',
                brightBlack: '#475569',
                brightRed: '#f87171',
                brightGreen: '#34d399',
                brightYellow: '#fbbf24',
                brightBlue: '#60a5fa',
                brightMagenta: '#c084fc',
                brightCyan: '#22d3ee',
                brightWhite: '#ffffff',
            },
            allowProposedApi: true
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        fitAddonRef.current = fitAddon

        term.open(terminalRef.current)

        // IMPORTANT: Delay fit to ensure DOM is ready and container has dimensions
        setTimeout(() => {
            fitAddon.fit()
            // Report initial size
            if (term.cols > 0 && term.rows > 0) {
                window.electron.ipcRenderer.send('ssh:resize', { id, cols: term.cols, rows: term.rows })
            }
        }, 100)


        xtermRef.current = term

        if (!hasConnected.current) {
            hasConnected.current = true
            window.electron.ipcRenderer.invoke('ssh:connect', { id, config }).then((result: any) => {
                if (result.success) {
                    term.write('\x1b[1;32m● Connected to ' + config.host + '\x1b[0m\r\n')
                    notify('success', `Established SSH connection to ${config.host}`)
                    if (onConnected) onConnected()
                    // Resize again after connection just in case
                    setTimeout(() => {
                        fitAddon.fit()
                        window.electron.ipcRenderer.send('ssh:resize', { id, cols: term.cols, rows: term.rows })
                    }, 200)
                } else {
                    term.write('\x1b[1;31m✖ Connection Failed: ' + result.error + '\x1b[0m\r\n')
                    notify('error', `SSH Failure: ${result.error}`)
                    hasConnected.current = false // Allow retry on failure if needed / or assume session closed
                }
            })
        }

        const removeListener = window.electron.ipcRenderer.on(`ssh:data:${id}`, (_event, data: string) => {
            term.write(data)
        })

        const removeCloseListener = window.electron.ipcRenderer.on(`ssh:closed:${id}`, () => {
            term.write('\r\n\x1b[33mSession closed.\x1b[0m')
            if (onClose) onClose()
        })

        term.onData((data) => {
            window.electron.ipcRenderer.send('ssh:data', { id, data })
        })

        // Copy/Paste Handler
        term.attachCustomKeyEventHandler((arg) => {
            // Ctrl+Shift+C: Copy
            if (arg.ctrlKey && arg.shiftKey && arg.code === 'KeyC' && arg.type === 'keydown') {
                const selection = term.getSelection()
                if (selection) {
                    navigator.clipboard.writeText(selection)
                    return false
                }
            }
            // Ctrl+Shift+V: Paste
            if (arg.ctrlKey && arg.shiftKey && arg.code === 'KeyV' && arg.type === 'keydown') {
                navigator.clipboard.readText().then(text => {
                    window.electron.ipcRenderer.send('ssh:data', { id, data: text })
                })
                return false
            }
            return true
        })

        // Right click paste
        term.element?.addEventListener('contextmenu', (e) => {
            e.preventDefault()
            navigator.clipboard.readText().then(text => {
                window.electron.ipcRenderer.send('ssh:data', { id, data: text })
            })
        })

        const resizeObserver = new ResizeObserver(() => {
            // Debounce resize
            if (requestAnimationFrame) {
                requestAnimationFrame(() => {
                    fitAddon.fit()
                    if (term.cols > 0 && term.rows > 0) {
                        window.electron.ipcRenderer.send('ssh:resize', {
                            id,
                            cols: term.cols,
                            rows: term.rows
                        })
                    }
                })
            }
        })
        resizeObserver.observe(terminalRef.current)

        return () => {
            removeListener()
            removeCloseListener()
            resizeObserver.disconnect()
            // Do not disconnect SSH here, as switching to SFTP view unmounts this component but session must stay alive.
            // ssh:disconnect is handled by the close tab action in App.tsx
            term.dispose()
        }
    }, [id])

    return (
        <div className="w-full h-full bg-[#0a0c10] p-6 animate-fade-in flex flex-col">
            <div ref={terminalRef} className="flex-1 w-full h-full overflow-hidden" style={{ minHeight: 0 }} />
        </div>
    )
}
