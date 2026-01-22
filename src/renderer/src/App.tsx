import React, { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
    Terminal as TerminalIcon,
    Shield,
    Settings,
    Database,
    Cpu,
    X,
    Bell,
    LayoutGrid,
    Lock,
    Code2,
    Palette,
    HardDrive,
    Zap,
    Monitor,
    RefreshCw
} from 'lucide-react'
import { TerminalView } from './components/TerminalView'
import { HostGallery } from './components/HostGallery'
import { VaultView } from './components/VaultView'
import { SyncView } from './components/SyncView'
import { SnippetView } from './components/SnippetView'
import { ThemeView } from './components/ThemeView'
import { RemoteView } from './components/RemoteView'
import { SFTPView } from './components/SFTPView'
import { SettingsView } from './components/SettingsView'
import { NotificationManager } from './components/NotificationManager'
import { LogsView } from './components/LogsView'
import { PasswordModal } from './components/PasswordModal'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from './store/useStore'

interface Session {
    id: string
    title: string
    type: 'ssh' | 'rdp' | 'vnc'
    viewMode: 'terminal' | 'sftp'
    isConnected: boolean // New: Track connection status
    config: any
}

function App() {
    const [activeTabId, setActiveTabId] = useState<string | null>(null)
    const [sessions, setSessions] = useState<Session[]>([])
    const [sidebarTab, setSidebarTab] = useState('dashboard')
    const { vaultLocked, activeTheme, notify, loadData, settings, addLog } = useStore() // Added addLog
    // Password prompt state
    const [pendingHost, setPendingHost] = useState<any>(null)
    const [isPasswordModalOpen, setPasswordModalOpen] = useState(false)

    // System Stats
    const [stats, setStats] = useState({
        cpu: 0,
        mem: { total: 0, used: 0, free: 0 },
        storage: { total: 0, used: 0, percent: 0 }
    })

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await window.electron.ipcRenderer.invoke('system:stats')
                if (res) setStats(res)
            } catch (e) {
                console.error('Stats error:', e)
            }
        }

        fetchStats()
        const interval = setInterval(fetchStats, 2000)
        return () => clearInterval(interval)
    }, [])

    // ... existing system stats code ...


    useEffect(() => {
        loadData()
        document.documentElement.style.setProperty('--bg-main', activeTheme.bg)
        document.documentElement.style.setProperty('--bg-sidebar', activeTheme.sidebar)
        document.documentElement.style.setProperty('--bg-accent', activeTheme.primary)

        // AUTO-UNLOCK VAULT ON STARTUP
        // This ensures seamless experience for local usage while keeping storage encrypted
        const initVault = async () => {
            const status = await window.electron.ipcRenderer.invoke('vault:status')
            if (!status.initialized || status.locked) {
                // Try default password for seamless experience
                const res = await window.electron.ipcRenderer.invoke('vault:init', 'zendemo')
                if (res.success) {
                    useStore.getState().setVaultLocked(false)
                    notify('success', 'Vault Ready & Secured')
                } else {
                    // Only lock if default password fails (user changed it)
                    useStore.getState().setVaultLocked(true)
                }
            } else {
                useStore.getState().setVaultLocked(false)
            }
        }
        initVault()

        // Global Log Listener
        const removeLogListener = window.electron.ipcRenderer.on('db:new-log', (_, log) => {
            useStore.getState().receiveLog(log)
        })

        return () => {
            removeLogListener()
        }
    }, [activeTheme, loadData])

    // Auto-Lock Mechanism
    useEffect(() => {
        // Only run if feature enabled and vault is currently unlocked
        if (!settings.autoLockVault || vaultLocked) return

        let timeout: NodeJS.Timeout
        const TIMEOUT_MS = 15 * 60 * 1000 // 15 Min

        const lockVault = async () => {
            if (!useStore.getState().vaultLocked) {
                await window.electron.ipcRenderer.invoke('vault:lock')
                useStore.getState().setVaultLocked(true)
                notify('info', 'Vault locked due to inactivity')
            }
        }

        const resetTimer = () => {
            clearTimeout(timeout)
            timeout = setTimeout(lockVault, TIMEOUT_MS)
        }

        window.addEventListener('mousemove', resetTimer)
        window.addEventListener('keypress', resetTimer)
        window.addEventListener('click', resetTimer)

        resetTimer() // Start initial timer

        return () => {
            clearTimeout(timeout)
            window.removeEventListener('mousemove', resetTimer)
            window.removeEventListener('keypress', resetTimer)
            window.removeEventListener('click', resetTimer)
        }
    }, [settings.autoLockVault, vaultLocked])

    const startSession = useCallback((hostConfig: any) => {
        const id = Math.random().toString(36).substring(7)
        addLog({
            type: 'info',
            module: 'Session Manager',
            action: 'Start Session',
            message: `Initializing session for ${hostConfig.name || hostConfig.host}`,
            details: `Session ID: ${id}`
        })
        const newSession: Session = {
            id,
            title: hostConfig?.name || `Session-${id.toUpperCase()}`,
            type: 'ssh',
            viewMode: 'terminal',
            isConnected: false, // Default false
            config: hostConfig || {
                host: 'localhost',
                port: 22,
                username: 'user'
            }
        }
        setSessions(prev => [...prev, newSession])
        setActiveTabId(id)
        setSidebarTab('sessions')
    }, [addLog])

    const handleSessionConnected = useCallback((id: string) => {
        const session = sessions.find(s => s.id === id)
        if (session && !session.isConnected) {
            addLog({
                type: 'success',
                module: 'SSH Client',
                action: 'Connected',
                message: `Connection established to ${session.title}`,
                details: `Session ID: ${id}`
            })
        }
        setSessions(prev => prev.map(s => s.id === id ? { ...s, isConnected: true } : s))
    }, [sessions, addLog])

    const handleConnect = useCallback(async (host: any) => {
        // Try to fetch credentials from vault
        try {
            const hasCreds = await window.electron.ipcRenderer.invoke('vault:get-credential', host.id)
            if (hasCreds.success && hasCreds.credential) {
                // Determine if we have a password or key
                // (Currently we only saved password/username, we can extend this)
                const { password, username } = hasCreds.credential
                if (password) {
                    addLog({
                        type: 'info',
                        module: 'Vault',
                        action: 'Credential Access',
                        message: `Credentials retrieved for ${host.name}`,
                        details: 'Password auto-fill'
                    })
                    startSession({ ...host, password, username: username || host.username })
                    return
                }
            }
        } catch (e: any) {
            console.error('Failed to fetch credentials:', e)
            addLog({
                type: 'error',
                module: 'Vault',
                action: 'Credential Access',
                message: 'Failed to access vault credentials',
                details: e.message
            })
        }

        // If no credentials found, prompt
        if (!host.password && !host.privateKey) {
            setPendingHost(host)
            setPasswordModalOpen(true)
        } else {
            startSession(host)
        }
    }, [startSession, addLog])

    const handlePasswordSubmit = async (password: string) => {
        if (pendingHost) {
            startSession({ ...pendingHost, password })

            // Save to vault automatically
            try {
                // Ensure arguments are strings
                const safePassword = String(password || '')
                const safeUsername = String(pendingHost.username || '')

                let res = await window.electron.ipcRenderer.invoke('vault:save-credential', {
                    hostId: pendingHost.id,
                    password: safePassword,
                    username: safeUsername
                })

                // Auto-unlock retry mechanism
                if (!res.success && (res.error === 'Vault locked' || res.error === 'Vault must be unlocked first')) {
                    console.log('Vault locked, attempting auto-unlock with default...')
                    const unlockRes = await window.electron.ipcRenderer.invoke('vault:init', 'zendemo') // Default password
                    if (unlockRes.success) {
                        useStore.getState().setVaultLocked(false)
                        // Retry save
                        res = await window.electron.ipcRenderer.invoke('vault:save-credential', {
                            hostId: pendingHost.id,
                            password: safePassword,
                            username: safeUsername
                        })
                    } else {
                        console.error('Auto-unlock failed:', unlockRes.error)
                        // If auto-unlock failed, we can't save.
                        // But we don't want to show generic "vault locked" if it was a crash.
                        if (unlockRes.error && unlockRes.error.includes('length')) {
                            res.error = 'System Fault: ' + unlockRes.error
                        }
                    }
                }

                if (res.success) {
                    notify('success', 'Credentials saved securely to Vault')
                } else {
                    console.warn('Vault save failed:', res.error)
                    // Suppress simple lock/unlock info, show real errors
                    if (res.error && !res.error.includes('locked') && !res.error.includes('Vault')) {
                        notify('error', 'Vault Error: ' + res.error)
                    } else if (res.error && res.error.includes('System Fault')) {
                        notify('error', res.error)
                    }
                }
            } catch (e) {
                console.error('Failed to save credentials:', e)
            }

            setPendingHost(null)
            setPasswordModalOpen(false)
        }
    }

    const closeSession = useCallback((e: React.MouseEvent | null, id: string) => {
        if (e) e.stopPropagation()

        // Explicitly disconnect SSH session
        window.electron.ipcRenderer.send('ssh:disconnect', id)

        setSessions(prev => {
            const newSessions = prev.filter(s => s.id !== id)
            if (activeTabId === id) {
                setActiveTabId(newSessions.length > 0 ? newSessions[newSessions.length - 1].id : null)
            }
            return newSessions
        })
    }, [activeTabId])

    const toggleViewMode = (id: string, mode: 'terminal' | 'sftp') => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, viewMode: mode } : s))
    }

    const reconnectSession = async (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId)
        if (!session) return

        notify('info', `Reconnecting session...`)
        try {
            const res = await window.electron.ipcRenderer.invoke('ssh:connect', { id: session.id, config: session.config })
            if (res.success) {
                notify('success', 'Session re-established!')
                // Force a refresh if needed, but SFTPView handles its own refresh on interaction
            } else {
                notify('error', 'Reconnection failed: ' + res.error)
            }
        } catch (e: any) {
            notify('error', 'Reconnection error: ' + e.message)
        }
    }

    return (
        <div className="flex h-screen w-full bg-[#0a0c10] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30 text-sm" style={{ backgroundColor: activeTheme.bg }}>
            <NotificationManager />
            <PasswordModal
                isOpen={isPasswordModalOpen}
                hostName={pendingHost?.name || 'Unknown Host'}
                onClose={() => setPasswordModalOpen(false)}
                onSubmit={handlePasswordSubmit}
            />

            {/* Sidebar */}
            <aside className="w-[72px] flex flex-col items-center py-6 border-r border-white/5 z-30" style={{ backgroundColor: activeTheme.sidebar }}>
                <div
                    onClick={() => setSidebarTab('dashboard')}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-8 shadow-2xl ring-1 ring-white/10 group cursor-pointer hover:scale-105 transition-all"
                    style={{ backgroundColor: activeTheme.primary }}
                >
                    <Shield size={24} className="text-white drop-shadow-md" />
                </div>

                <nav className="flex flex-col gap-4 flex-1 w-full items-center py-4 overflow-y-auto no-scrollbar">
                    <SidebarIcon icon={<LayoutGrid size={22} />} active={sidebarTab === 'dashboard'} onClick={() => setSidebarTab('dashboard')} label="Dashboard" />
                    <SidebarIcon icon={<TerminalIcon size={22} />} active={sidebarTab === 'sessions'} onClick={() => setSidebarTab('sessions')} label="Sessions" />
                    <SidebarIcon icon={<Monitor size={22} />} active={sidebarTab === 'remote'} onClick={() => setSidebarTab('remote')} label="Remote" />
                    <SidebarIcon icon={<Code2 size={22} />} active={sidebarTab === 'snippets'} onClick={() => setSidebarTab('snippets')} label="Snippets" />
                    <SidebarIcon icon={<Database size={22} />} active={sidebarTab === 'vault'} onClick={() => setSidebarTab('vault')} label="Vault" />
                    <SidebarIcon icon={<RefreshCw size={22} />} active={sidebarTab === 'sync'} onClick={() => setSidebarTab('sync')} label="Sync" />
                </nav>

                <div className="flex flex-col gap-4 mt-auto">
                    <SidebarIcon icon={<Bell size={20} />} active={sidebarTab === 'logs'} onClick={() => setSidebarTab('logs')} label="Logs" />
                    <SidebarIcon icon={<Palette size={20} />} active={sidebarTab === 'themes'} onClick={() => setSidebarTab('themes')} label="Themes" />
                    <SidebarIcon icon={<Settings size={20} />} active={sidebarTab === 'settings'} onClick={() => setSidebarTab('settings')} label="Settings" />
                </div>
            </aside>

            {/* Main Container */}
            <main className="flex-1 flex flex-col min-w-0 bg-grid relative text-slate-300">
                {/* Modern Header */}
                <header className="h-16 border-b border-white/5 flex items-center px-8 justify-between bg-[#0a111a]/50 backdrop-blur-3xl z-20">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[9px] uppercase tracking-[0.3em] font-black" style={{ color: activeTheme.primary }}>Zenmius.io</span>
                            <h1 className="text-sm font-bold text-white tracking-tight uppercase">
                                {sidebarTab === 'sessions' && activeTabId ? sessions.find(s => s.id === activeTabId)?.title : sidebarTab}
                            </h1>
                        </div>

                        <div className="h-6 w-[1px] bg-white/10 mx-2"></div>

                        <div
                            onClick={async () => {
                                if (!vaultLocked) {
                                    await window.electron.ipcRenderer.invoke('vault:lock')
                                    useStore.getState().setVaultLocked(true)
                                    notify('info', 'Vault has been locked manually.')
                                }
                            }}
                            className={`flex items-center gap-2 text-[9px] font-black tracking-widest px-3 py-1.5 rounded-lg border transition-all cursor-pointer hover:brightness-125 active:scale-95 ${vaultLocked
                                ? 'bg-amber-400/5 text-amber-400 border-amber-400/20'
                                : 'bg-emerald-400/5 text-emerald-400 border-emerald-400/20'
                                }`}>
                            {vaultLocked ? <Lock size={10} className="animate-pulse" /> : <Shield size={10} />}
                            {vaultLocked ? 'LOCKED' : 'SECURED'}
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        {/* Header Actions removed */}
                    </div>
                </header>

                {/* Tab System & View Toggler */}
                {(sidebarTab === 'sessions' && sessions.length > 0) && (
                    <div className="h-14 border-b border-white/5 flex items-center bg-black/40 px-3 justify-between">
                        <div className="flex-1 min-w-0 mr-4 relative h-full">
                            <div className="absolute inset-0 flex items-center gap-2 overflow-x-auto no-scrollbar px-2">
                                <AnimatePresence mode='popLayout'>
                                    {sessions.map(session => (
                                        <Tab
                                            key={session.id}
                                            active={activeTabId === session.id}
                                            title={session.title}
                                            sessionId={session.id}
                                            onClick={() => setActiveTabId(session.id)}
                                            onClose={(e) => closeSession(e, session.id)}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 pl-4 border-l border-white/5 h-8 my-auto">
                            {activeTabId && (
                                <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/5">
                                    <button
                                        onClick={() => toggleViewMode(activeTabId, 'terminal')}
                                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${sessions.find(s => s.id === activeTabId)?.viewMode === 'terminal'
                                            ? 'bg-white/10 text-white shadow-lg'
                                            : 'text-slate-500 hover:text-slate-400'
                                            }`}
                                    >
                                        <TerminalIcon size={12} /> Terminal
                                    </button>
                                    <button
                                        onClick={() => toggleViewMode(activeTabId, 'sftp')}
                                        className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${sessions.find(s => s.id === activeTabId)?.viewMode === 'sftp'
                                            ? 'bg-white/10 text-white shadow-lg'
                                            : 'text-slate-500 hover:text-slate-400'
                                            }`}
                                    >
                                        <HardDrive size={12} /> SFTP Explorer
                                    </button>
                                </div>
                            )}

                            {sessions.length > 1 && (
                                <button
                                    onClick={() => {
                                        if (confirm('Close all active sessions?')) {
                                            sessions.forEach(s => window.electron.ipcRenderer.send('ssh:disconnect', s.id))
                                            setSessions([])
                                            setActiveTabId(null)
                                            useStore.getState().notify('info', 'All sessions closed')
                                        }
                                    }}
                                    className="h-8 px-4 flex items-center justify-center gap-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest"
                                    title="Close All Sessions"
                                >
                                    <X size={12} strokeWidth={3} /> Close All
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Content Area */}
                <section className="flex-1 relative overflow-hidden bg-[#0c0e14]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={sidebarTab}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.02 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 w-full h-full z-20"
                        >
                            <div className={`w-full h-full ${sidebarTab === 'sessions' ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                                {sidebarTab === 'dashboard' && (
                                    <div className="w-full h-full p-8 overflow-y-auto custom-scrollbar">
                                        <HostGallery onConnect={handleConnect} />
                                    </div>
                                )}

                                {sidebarTab === 'vault' && <VaultView />}
                                {sidebarTab === 'sync' && <SyncView />}
                                {sidebarTab === 'snippets' && (
                                    <SnippetView
                                        sessions={sessions}
                                        onRun={(sessionId, command) => {
                                            window.electron.ipcRenderer.send('ssh:data', { id: sessionId, data: command + '\n' })
                                            // Optionally switch to sessions view to show execution
                                            setSidebarTab('sessions')
                                            setActiveTabId(sessionId)
                                        }}
                                    />
                                )}
                                {sidebarTab === 'themes' && <ThemeView />}
                                {sidebarTab === 'remote' && <RemoteView />}
                                {sidebarTab === 'settings' && <SettingsView />}
                                {sidebarTab === 'logs' && <LogsView />}


                                {[''].includes(sidebarTab) && (
                                    <EmptyState icon={<Bell size={48} />} title={`${sidebarTab.toUpperCase()} Module`} description="This feature is coming in the next build." buttonText="Back to Dashboard" onButtonClick={() => setSidebarTab('dashboard')} />
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Persistent Session Layer (Never Unmounts) */}
                    <div className={`absolute inset-0 w-full h-full ${sidebarTab === 'sessions' ? 'z-30 visible' : 'z-0 invisible'}`}>
                        {sessions.length === 0 ? (
                            <div className="w-full h-full bg-[#0c0e14]">
                                <EmptyState
                                    icon={<TerminalIcon size={48} />}
                                    title="Active Sessions"
                                    description="You don't have any active SSH or SFTP sessions. Return to the Dashboard to connect to a host."
                                    buttonText="Connect to a Host"
                                    onButtonClick={() => setSidebarTab('dashboard')}
                                />
                            </div>
                        ) : (
                            <div className="w-full h-full relative">
                                {sessions.map(session => (
                                    <div
                                        key={session.id}
                                        className={`absolute inset-0 w-full h-full bg-[#0c0e14] ${activeTabId === session.id ? 'z-10' : 'z-0 opacity-0 pointer-events-none'}`}
                                    >
                                        {/* Render BOTH views but toggle visibility so state persists */}
                                        <div className={`w-full h-full ${session.viewMode === 'terminal' ? 'block' : 'hidden'}`}>
                                            <TerminalView
                                                id={session.id}
                                                config={session.config}
                                                onClose={() => closeSession(null as any, session.id)}
                                                onConnected={() => handleSessionConnected(session.id)}
                                            />
                                        </div>
                                        <div className={`w-full h-full ${session.viewMode === 'sftp' ? 'block' : 'hidden'}`}>
                                            <SFTPView
                                                id={session.id}
                                                isConnected={session.isConnected}
                                                onReconnect={() => reconnectSession(session.id)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Status Bar */}
                <footer className="h-8 border-t border-white/5 bg-[#050608] flex items-center px-10 justify-between text-[10px] text-slate-600 font-mono font-bold tracking-[0.1em] z-30">
                    <div className="flex items-center gap-10">
                        <div className="flex items-center gap-2">
                            <Cpu size={14} style={{ color: activeTheme.primary }} /> <span className="text-slate-500">CPU</span> {stats.cpu}%
                        </div>
                        <div className="flex items-center gap-2">
                            <Zap size={14} style={{ color: activeTheme.primary }} /> <span className="text-slate-500">RAM</span> {Math.round(stats.mem.used / 1024 / 1024 / 1024 * 10) / 10}GB
                        </div>
                        <div className="flex items-center gap-2">
                            <HardDrive size={14} style={{ color: activeTheme.primary }} /> <span className="text-slate-500">SSD</span> {stats.storage.percent}%
                        </div>
                        <div className="flex items-center gap-2 text-[9px] opacity-60">
                            ZENMIUS CORE v1.2.6 • {activeTheme.name.toUpperCase()}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <span className="opacity-60 uppercase">System Ready</span>
                    </div>
                </footer>
            </main>
        </div>
    )
}

function SidebarIcon({ icon, active, onClick, label }: { icon: any, active: boolean, onClick: () => void, label: string }) {
    const { activeTheme } = useStore()
    const [isHovered, setIsHovered] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0, height: 0 })

    const handleMouseEnter = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect()
        setCoords({ top: rect.top, left: rect.right, height: rect.height })
        setIsHovered(true)
    }

    return (
        <>
            <button
                onClick={onClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setIsHovered(false)}
                className={`relative group p-3.5 rounded-2xl transition-all duration-500 ${active
                    ? 'text-white shadow-xl translate-x-1'
                    : 'text-slate-600 hover:text-slate-400 hover:bg-white/[0.02]'
                    }`}
                style={active ? { backgroundColor: activeTheme.primary } : {}}
            >
                {icon}
            </button>
            {isHovered && createPortal(
                <div
                    className="fixed z-[9999] px-3 py-2 bg-[#1a1d24] text-white text-[10px] font-black tracking-widest uppercase rounded-lg shadow-2xl border border-white/10 backdrop-blur-md pointer-events-none animate-fade-in whitespace-nowrap"
                    style={{
                        top: coords.top + (coords.height / 2),
                        left: coords.left + 16,
                        transform: 'translateY(-50%)'
                    }}
                >
                    {label}
                    {/* Arrow */}
                    <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-[#1a1d24] rotate-45 border-l border-b border-white/10"></div>
                </div>,
                document.body
            )}
        </>
    )
}

function Tab({ active, title, sessionId, onClick, onClose }: { active: boolean, title: string, sessionId: string, onClick: () => void, onClose: (e: any) => void }) {
    const { activeTheme } = useStore()
    return (
        <motion.div
            layout
            className={`
      flex items-center gap-4 px-6 py-2 h-[calc(100%-12px)] text-[11px] font-black tracking-tight cursor-pointer transition-all border rounded-[14px] mx-1 relative group select-none shrink-0 min-w-[200px]
      ${active
                    ? 'bg-white/[0.05] border-white/10 shadow-inner'
                    : 'text-slate-600 hover:bg-white/[0.03] hover:text-slate-500 border-transparent'}
    `}
            onClick={onClick}
            style={active ? { color: activeTheme.primary } : {}}
        >
            <TerminalIcon size={14} />
            <span className="flex-1 truncate uppercase tracking-widest">
                {title} <span className="opacity-40 text-[9px]">#{sessionId.substring(0, 4)}</span>
            </span>
            <button
                onClick={onClose}
                className="w-5 h-5 flex items-center justify-center hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <X size={12} strokeWidth={3} />
            </button>
            {active && <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full" style={{ backgroundColor: activeTheme.primary }}></div>}
        </motion.div>
    )
}

function EmptyState({ icon, title, description, buttonText, onButtonClick }: any) {
    const { activeTheme } = useStore()
    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center">
            <div className="w-24 h-24 rounded-[2.5rem] bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-700 mb-8">
                {icon}
            </div>
            <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">{title}</h2>
            <p className="text-slate-600 max-w-sm mb-12 font-medium leading-relaxed">{description}</p>
            {buttonText && (
                <button
                    onClick={onButtonClick}
                    className="px-8 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all shadow-xl"
                    style={{ transitionDuration: '0.4s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = activeTheme.primary}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                >
                    {buttonText}
                </button>
            )}
        </div>
    )
}

export default App
