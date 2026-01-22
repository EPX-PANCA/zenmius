import { useState, useEffect } from 'react'
import { Monitor, Server, Activity, Plus, Play, X, Search, Edit2, User, Key } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'

interface RemoteSession {
    id: string
    name: string
    protocol: 'vnc' | 'rdp'
    host: string
    port: number
    username?: string
    password?: string
    resolution?: string
    status: 'connecting' | 'connected' | 'disconnected'
}

export function RemoteView() {
    const { activeTheme, notify, vaultLocked } = useStore()
    const [sessions, setSessions] = useState<RemoteSession[]>([])
    const [isNewConnectionModalOpen, setIsNewConnectionModalOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Load Sessions
    useEffect(() => {
        window.electron.ipcRenderer.invoke('db:get-remote-connections').then((conns: any[]) => {
            const mapped = conns.map(c => ({ ...c, status: 'disconnected' }))
            setSessions(mapped)
        })
    }, [])

    // Form State
    const [formData, setFormData] = useState({
        id: '',
        protocol: 'vnc' as 'vnc' | 'rdp',
        host: '',
        port: '',
        name: '',
        username: '',
        password: '',
        resolution: 'smart'
    })

    const filteredSessions = sessions.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.host.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleConnect = async () => {
        const id = formData.id || crypto.randomUUID()
        const newSession: RemoteSession = {
            id,
            name: formData.name || `${formData.host}:${formData.port}`,
            protocol: formData.protocol,
            host: formData.host,
            port: parseInt(formData.port) || (formData.protocol === 'vnc' ? 5900 : 3389),
            username: formData.username,
            password: formData.password,
            resolution: formData.resolution,
            status: 'disconnected'
        }

        // Optimistic UI update
        setSessions(prev => {
            const exists = prev.find(s => s.id === id)
            if (exists) {
                return prev.map(s => s.id === id ? newSession : s)
            }
            return [newSession, ...prev]
        })
        setIsNewConnectionModalOpen(false)
        setFormData({ id: '', protocol: 'vnc', host: '', port: '', name: '', username: '', password: '', resolution: 'smart' })

        // 1. Save Metadata to DB
        const dbRes = await window.electron.ipcRenderer.invoke('db:save-remote-connection', {
            id: newSession.id,
            name: newSession.name,
            protocol: newSession.protocol,
            host: newSession.host,
            port: newSession.port,
            username: newSession.username,
            password: newSession.password, // Keep in DB as requested
            resolution: newSession.resolution
        })

        if (!dbRes.success) {
            notify('error', 'Failed to save connection to DB: ' + dbRes.error)
            return
        }

        // 2. Save Credential to Vault (Secure & Synced)
        if (newSession.password) {
            const vaultRes = await window.electron.ipcRenderer.invoke('vault:save-credential', {
                hostId: newSession.id,
                username: newSession.username,
                password: newSession.password
            })
            if (!vaultRes.success) {
                notify('error', 'Connection saved, but Vault save failed: ' + vaultRes.error)
            } else {
                notify('success', 'Connection saved to DB & Vault')
            }
        } else {
            notify('success', 'Connection saved (No Password)')
        }
    }

    const handleLaunch = async (session: RemoteSession) => {
        if (vaultLocked) {
            notify('error', 'Vault is Locked. Unlock to access credentials.')
            return
        }
        notify('info', `Launching ${session.protocol.toUpperCase()} Viewer...`)

        // Resolve Password: Try Session (DB) -> Then Vault -> Then Prompt (TODO)
        let finalPassword = session.password

        if (!finalPassword) {
            // Try fetching from Vault if missing in DB object
            try {
                const vaultRes = await window.electron.ipcRenderer.invoke('vault:get-credential', session.id)
                if (vaultRes.success && vaultRes.credential && vaultRes.credential.password) {
                    finalPassword = vaultRes.credential.password
                    console.log('Password retrieved from Vault')
                }
            } catch (e) {
                console.warn('Failed to fetch from vault', e)
            }
        }

        try {
            const res = await window.electron.ipcRenderer.invoke('remote:launch', {
                protocol: session.protocol,
                host: session.host,
                port: session.port,
                username: session.username,
                password: finalPassword,
                resolution: session.resolution
            })

            if (!res.success) {
                notify('error', 'Launch failed: ' + res.error)
            }
        } catch (error: any) {
            console.error('Failed to invoke remote:launch', error)
            // Specific message for the "No handler" error which is common during dev updates
            if (error.message.includes('No handler registered')) {
                notify('error', 'Handler update pending. Please restart the terminal/app.')
            } else {
                notify('error', 'Launch failed: ' + error.message)
            }
        }
    }

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (confirm('Delete this connection preset?')) {
            setSessions(prev => prev.filter(s => s.id !== id))
            const res = await window.electron.ipcRenderer.invoke('db:delete-remote-connection', id)
            if (res.success) {
                notify('info', 'Connection removed')
            } else {
                notify('error', 'Failed to remove connection')
            }
        }
    }

    return (
        <div className="w-full h-full flex flex-col p-8 space-y-8 animate-fade-in relative overflow-hidden text-white">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 font-bold tracking-[0.2em] text-[10px] uppercase" style={{ color: activeTheme.primary }}>
                        <Monitor size={14} /> Remote Desktop Protocol
                    </div>
                    <h2 className="text-4xl font-extrabold text-white tracking-tight">Native Bridge</h2>
                    <p className="text-slate-400 font-medium leading-relaxed max-w-2xl">
                        High-performance connection manager with hardware-accelerated rendering.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group w-80">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="text"
                            placeholder="Search remote servers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-medium placeholder-slate-600"
                        />
                    </div>
                    <button
                        onClick={() => {
                            setFormData({ id: '', protocol: 'vnc', host: '', port: '', name: '', username: '', password: '', resolution: 'fullscreen' })
                            setIsNewConnectionModalOpen(true)
                        }}
                        className="h-12 px-6 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all hover:brightness-110"
                        style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                    >
                        <Plus size={18} /> New Connection
                    </button>
                </div>
            </div>

            {/* Active Sessions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pr-2 overflow-y-auto pb-20 custom-scrollbar">
                {filteredSessions.map(session => (
                    <motion.div
                        key={session.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#1a1d24] border border-white/5 rounded-[1.5rem] p-5 relative overflow-hidden group hover:border-white/10 transition-all hover:shadow-2xl shadow-black/50 flex flex-col gap-4"
                    >

                        <div className="flex justify-between items-start">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 border border-white/5 shadow-inner" style={{ color: activeTheme.primary }}>
                                {session.protocol === 'vnc' ? <Monitor size={18} /> : <Server size={18} />}
                            </div>
                            <div className={`w-2 h-2 rounded-full ${session.status === 'connected' ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-slate-600'}`} />
                        </div>

                        <div>
                            <h3 className="text-white font-bold text-lg truncate mb-1">{session.name}</h3>
                            <div className="flex flex-col gap-1">
                                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 truncate flex items-center gap-2">
                                    <span className="opacity-50">HOST</span> {session.host}
                                </p>
                                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 truncate flex items-center gap-2">
                                    <span className="opacity-50">RES</span> {session.resolution === 'smart' ? 'Dynamic' : session.resolution || 'Fullscreen'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-auto">
                            {session.status === 'connecting' ? (
                                <div className="h-10 bg-black/20 rounded-lg border border-white/5 flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: activeTheme.primary }} />
                                    <span className="text-[9px] uppercase font-bold tracking-widest" style={{ color: activeTheme.primary }}>Connecting...</span>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <motion.button
                                        whileHover={{ scale: 1.02, backgroundColor: activeTheme.primary, borderColor: activeTheme.primary }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleLaunch(session)}
                                        className="flex-1 py-2.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-black text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        <Play size={10} fill="currentColor" /> Launch Viewer
                                    </motion.button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setFormData({
                                                id: session.id,
                                                protocol: session.protocol,
                                                host: session.host,
                                                port: session.port.toString(),
                                                name: session.name,
                                                username: session.username || '',
                                                password: session.password || '',
                                                resolution: session.resolution || 'fullscreen'
                                            })
                                            setIsNewConnectionModalOpen(true)
                                        }}
                                        className="p-2.5 bg-black/30 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/5"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, session.id)}
                                        className="p-2.5 bg-black/30 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-white/5 hover:border-red-500/20"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}

                {filteredSessions.length === 0 && (
                    <div className="col-span-full h-[300px] border-2 border-dashed border-white/5 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-slate-600 bg-black/20">
                        <Monitor size={48} className="opacity-20" />
                        <p className="text-sm font-bold uppercase tracking-widest">
                            {searchQuery ? `No results for "${searchQuery}"` : 'No Active Remote Sessions'}
                        </p>
                    </div>
                )}
            </div>

            {/* New Connection Modal */}
            <AnimatePresence>
                {isNewConnectionModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-lg border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6 relative overflow-hidden"
                            style={{ backgroundColor: '#14171d' }}
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                            <button
                                onClick={() => setIsNewConnectionModalOpen(false)}
                                className="absolute top-8 right-8 p-2 hover:bg-white/5 rounded-full transition-all text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>

                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Configuration</h3>
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Gateway Settings</p>
                            </div>

                            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                                {['vnc', 'rdp'].map((proto) => (
                                    <button
                                        key={proto}
                                        onClick={() => setFormData({ ...formData, protocol: proto as any })}
                                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formData.protocol === proto ? 'bg-white/10 text-white shadow-lg border border-white/10' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {proto}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Label</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-bold placeholder-white/10"
                                        placeholder="My Remote Server"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2 space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Host</label>
                                        <input
                                            type="text"
                                            value={formData.host}
                                            onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-mono placeholder-white/10"
                                            placeholder="192.168.1.100"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Port</label>
                                        <input
                                            type="text"
                                            value={formData.port}
                                            onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-mono placeholder-white/10"
                                            placeholder={formData.protocol === 'vnc' ? '5900' : '3389'}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Username</label>
                                        <div className="relative">
                                            <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="text"
                                                value={formData.username}
                                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-bold placeholder-white/10"
                                                placeholder="admin"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Password</label>
                                        <div className="relative">
                                            <Key size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                            <input
                                                type="password"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-bold placeholder-white/10"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Screen Mode</label>
                                    <select
                                        value={formData.resolution}
                                        onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all uppercase tracking-wide appearance-none"
                                    >
                                        <option value="fullscreen">Fullscreen (Immersive)</option>
                                        <option value="smart">Dynamic Resolution (Resizable)</option>
                                        <option value="1920x1080">1920 x 1080 (HD)</option>
                                        <option value="1280x720">1280 x 720 (SD)</option>
                                        <option value="1600x900">1600 x 900</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleConnect}
                                disabled={!formData.host}
                                className="w-full py-4 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center gap-2 items-center hover:brightness-110 shadow-xl active:scale-95 border border-white/10"
                                style={{ backgroundColor: activeTheme.primary }}
                            >
                                <Play size={14} fill="currentColor" /> Save & Ready
                            </button>

                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    )
}
