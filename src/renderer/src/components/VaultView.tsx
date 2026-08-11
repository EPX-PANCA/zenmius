import { useState, useEffect } from 'react'
import { Shield, Key, Plus, Trash2, Copy, Lock, ExternalLink, HardDrive, Edit3, X, Save, Eye, EyeOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'

export function VaultView() {
    const { vaultLocked, setVaultLocked, notify, activeTheme, hosts, vaultEditHostId, setVaultEditHostId } = useStore()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [vaultInitialized, setVaultInitialized] = useState<boolean | null>(null)
    const isExistingVault = vaultInitialized !== false || hosts.length > 0
    const [isVerifying, setIsVerifying] = useState(false)
    const [credentials, setCredentials] = useState<any[]>([])
    const [hasLoaded, setHasLoaded] = useState(false)

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingSecret, setEditingSecret] = useState<any>(null)
    const [formData, setFormData] = useState({
        name: '',
        type: 'password',
        username: '',
        privateKey: ''
    })
    const [showSecret, setShowSecret] = useState(false)

    const loadVaultContent = async () => {
        const loadRes = await window.electron.ipcRenderer.invoke('vault:load')
        if (loadRes.success) {
            let credsArray: any[] = []
            if (Array.isArray(loadRes.data)) {
                credsArray = loadRes.data
            } else if (loadRes.data && typeof loadRes.data === 'object') {
                if (loadRes.data.secrets && Array.isArray(loadRes.data.secrets)) {
                    credsArray = [...loadRes.data.secrets]
                }
                if (loadRes.data.hosts) {
                    const hostCreds = Object.entries(loadRes.data.hosts).map(([id, val]: [string, any]) => {
                        const relatedHost = hosts.find(h => h.id === id)
                        return {
                            id,
                            name: relatedHost ? `Password: ${relatedHost.name} (#${id.substring(0, 8)})` : `Remote Credential (#${id.substring(0, 8)})`,
                            type: 'host-password',
                            username: val.username || relatedHost?.username || 'System',
                            privateKey: '******',
                            updatedAt: val.updatedAt
                        }
                    })
                    credsArray = [...credsArray, ...hostCreds]
                }
            }
            setCredentials(credsArray)
            setHasLoaded(true)
        } else {
            if (loadRes.error !== 'Vault locked') notify('error', loadRes.error)
        }
    }

    useEffect(() => {
        window.electron.ipcRenderer.invoke('vault:status').then((status) => {
            setVaultInitialized(Boolean(status.initialized))
        })
        if (!vaultLocked) {
            loadVaultContent()
        }
    }, [vaultLocked, hosts])

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!password) {
            notify('error', 'Master password is required.')
            return
        }
        if (vaultInitialized === null && hosts.length === 0) {
            notify('error', 'Checking vault status. Please try again.')
            return
        }
        if (!isExistingVault && password !== confirmPassword) {
            notify('error', 'Master password confirmation does not match.')
            return
        }
        setIsVerifying(true)
        const res = await window.electron.ipcRenderer.invoke('vault:init', password)
        if (res.success) {
            if (!isExistingVault) {
                const saveRes = await window.electron.ipcRenderer.invoke('vault:save', { hosts: {}, secrets: [] })
                if (!saveRes.success) throw new Error(saveRes.error || 'Failed to initialize vault storage')
                setVaultInitialized(true)
            }
            await loadVaultContent()
            setVaultLocked(false)
            notify('success', isExistingVault ? 'Vault decrypted successfully.' : 'Vault created successfully.')
        } else {
            notify('error', res.error)
        }
        setIsVerifying(false)
    }

    const handleOpenAddModal = () => {
        setEditingSecret(null)
        setFormData({ name: '', type: 'password', username: '', privateKey: '' })
        setShowSecret(false)
        setIsModalOpen(true)
    }

    const handleOpenEditModal = async (cred: any) => {
        let actualPrivateKey = cred.privateKey
        if (cred.type === 'host-password') {
            const currentRes = await window.electron.ipcRenderer.invoke('vault:load')
            if (currentRes.success && currentRes.data.hosts && currentRes.data.hosts[cred.id]) {
                const hostCredObj = currentRes.data.hosts[cred.id]
                actualPrivateKey = typeof hostCredObj === 'object' ? hostCredObj.password : hostCredObj
            }
        }
        
        setEditingSecret(cred)
        setFormData({
            name: cred.name,
            type: cred.type,
            username: cred.username || '',
            privateKey: actualPrivateKey === '******' ? '' : actualPrivateKey
        })
        setShowSecret(false)
        setIsModalOpen(true)
    }

    useEffect(() => {
        if (hasLoaded && vaultEditHostId && !vaultLocked && !isModalOpen) {
            const cred = credentials.find(c => c.id === vaultEditHostId && c.type === 'host-password')
            if (cred) {
                handleOpenEditModal(cred)
            } else {
                notify('info', 'Belum ada password yang tersimpan untuk server ini.')
            }
            setVaultEditHostId(null)
        }
    }, [hasLoaded, vaultEditHostId, vaultLocked, credentials, isModalOpen])

    const handleSaveSecret = async (e: React.FormEvent) => {
        e.preventDefault()
        
        const currentRes = await window.electron.ipcRenderer.invoke('vault:load')
        if (!currentRes.success) {
            notify('error', 'Gagal meload vault: ' + currentRes.error)
            return
        }

        let currentData = currentRes.data
        if (Array.isArray(currentData)) {
            currentData = { secrets: currentData, hosts: {} }
        } else if (typeof currentData !== 'object' || currentData === null) {
            currentData = { secrets: [], hosts: {} }
        }

        if (editingSecret?.type === 'host-password') {
            if (!currentData.hosts) currentData.hosts = {}
            const existing = currentData.hosts[editingSecret.id] || {}
            currentData.hosts[editingSecret.id] = {
                ...(typeof existing === 'object' ? existing : { password: existing }),
                password: formData.privateKey,
                updatedAt: new Date().toISOString()
            }
        } else {
            if (!currentData.secrets) currentData.secrets = []
            
            const secretObj = {
                id: editingSecret ? editingSecret.id : Math.random().toString(36).substring(7),
                name: formData.name,
                type: formData.type,
                username: formData.username,
                privateKey: formData.privateKey
            }

            if (editingSecret) {
                currentData.secrets = currentData.secrets.map((c: any) => c.id === editingSecret.id ? secretObj : c)
            } else {
                currentData.secrets = [...currentData.secrets, secretObj]
            }
        }

        const res = await window.electron.ipcRenderer.invoke('vault:save', currentData)
        if (res.success) {
            await loadVaultContent()
            setIsModalOpen(false)
            notify('success', editingSecret ? 'Secret berhasil diperbarui.' : 'Secret berhasil ditambahkan.')
        } else {
            notify('error', 'Gagal menyimpan vault: ' + res.error)
        }
    }

    const deleteCredential = async (id: string) => {
        try {
            const isHost = credentials.find(c => c.id === id)?.type === 'host-password'
            
            // Prevent deleting host credential if the host still exists
            if (isHost) {
                const attachedHost = hosts.find(h => h.id === id)
                if (attachedHost) {
                    notify('error', `Akses ditolak! Kredensial ini masih terhubung dengan server: ${attachedHost.name}. Harap hapus server tersebut di Dashboard terlebih dahulu.`)
                    return
                }
            }

            const currentRes = await window.electron.ipcRenderer.invoke('vault:load')
            if (!currentRes.success) {
                notify('error', 'Gagal meload vault: ' + currentRes.error)
                return
            }

            let currentData = currentRes.data
            let modified = false

            if (Array.isArray(currentData)) {
                if (!isHost) {
                    currentData = { secrets: currentData.filter((c: any) => c.id !== id) }
                    modified = true
                }
            } else if (typeof currentData === 'object' && currentData !== null) {
                if (isHost) {
                    if (currentData.hosts && currentData.hosts[id]) {
                        delete currentData.hosts[id]
                        modified = true
                    }
                } else {
                    if (currentData.secrets) {
                        currentData.secrets = currentData.secrets.filter((c: any) => c.id !== id)
                        modified = true
                    }
                }
            }

            if (modified) {
                const res = await window.electron.ipcRenderer.invoke('vault:save', currentData)
                if (res.success) {
                    const updated = credentials.filter(c => c.id !== id)
                    setCredentials(updated)
                    notify('success', isHost ? 'Host credential berhasil dihapus.' : 'Secret berhasil dihapus.')
                } else {
                    notify('error', 'Gagal menyimpan vault: ' + res.error)
                }
            }
        } catch (error: any) {
            notify('error', 'Terjadi kesalahan sistem: ' + error.message)
        }
    }

    if (vaultLocked) {
        return (
            <div className="w-full h-full flex items-center justify-center p-8 bg-grid">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md bg-[#14171d] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl text-center"
                >
                    <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-8" style={{ color: activeTheme.primary }}>
                        <Lock size={36} />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-wider">
                        {!isExistingVault ? 'Create Your Vault' : vaultInitialized === null ? 'Checking Vault' : 'Vault Locked'}
                    </h2>
                    {!isExistingVault && <p className="text-white/50 text-sm mb-6">Choose a master password for this device.</p>}
                    <form onSubmit={handleUnlock} className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={!isExistingVault ? 'Create Master Password' : 'Enter Existing Master Password'}
                            className="w-full h-14 bg-black/30 border border-white/5 rounded-2xl px-6 text-sm focus:outline-none focus:ring-1 text-white transition-all"
                            style={{ borderColor: activeTheme.primary + '40' }}
                        />
                        {!isExistingVault && <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm Master Password"
                            className="w-full h-14 bg-black/30 border border-white/5 rounded-2xl px-6 text-sm focus:outline-none focus:ring-1 text-white transition-all"
                            style={{ borderColor: activeTheme.primary + '40' }}
                        />}
                        <button
                            disabled={isVerifying}
                            className="w-full h-14 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
                            style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                        >
                            {isVerifying ? 'Processing...' : !isExistingVault ? 'Create Vault' : 'Unlock Vault'}
                        </button>
                    </form>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="p-12 max-w-7xl mx-auto space-y-10 animate-fade-in custom-scrollbar overflow-y-auto h-full pb-24 relative">
            
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-lg border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl"
                            style={{ backgroundColor: activeTheme.sidebar }}
                        >
                            <div className="px-10 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                                <h2 className="text-xl font-black text-white uppercase tracking-wider">{editingSecret ? 'Edit Credential' : 'Add Credential'}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleSaveSecret} className="p-10 space-y-6">
                                {editingSecret?.type === 'host-password' ? (
                                    <div className="p-4 rounded-xl bg-white/5 text-sm text-slate-400 border border-white/10 mb-4">
                                        Editing Host Credential: <b className="text-white">{editingSecret.name}</b><br/>
                                        <span className="text-[10px] uppercase tracking-widest opacity-60">Host ID: {editingSecret.id}</span><br/>
                                        Only the password/key can be modified here.
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2 group">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 transition-colors group-focus-within:opacity-100" style={{ color: activeTheme.primary }}>Name</label>
                                            <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full h-12 bg-black/20 border border-white/5 rounded-xl px-4 text-sm text-white focus:outline-none focus:ring-1 transition-all placeholder:text-slate-700" style={{ '--tw-ring-color': activeTheme.primary } as any} placeholder="e.g. AWS Production Key" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2 group">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 transition-colors group-focus-within:opacity-100" style={{ color: activeTheme.primary }}>Type</label>
                                                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full h-12 bg-black/20 border border-white/5 rounded-xl px-4 text-sm text-white focus:outline-none focus:ring-1 transition-all appearance-none" style={{ '--tw-ring-color': activeTheme.primary } as any}>
                                                    <option value="ssh-key">SSH Key</option>
                                                    <option value="password">Password</option>
                                                    <option value="token">Token</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2 group">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 transition-colors group-focus-within:opacity-100" style={{ color: activeTheme.primary }}>Username</label>
                                                <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full h-12 bg-black/20 border border-white/5 rounded-xl px-4 text-sm text-white focus:outline-none focus:ring-1 transition-all placeholder:text-slate-700" style={{ '--tw-ring-color': activeTheme.primary } as any} placeholder="root" />
                                            </div>
                                        </div>
                                    </>
                                )}
                                
                                <div className="space-y-2 group">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 transition-colors group-focus-within:opacity-100" style={{ color: activeTheme.primary }}>Secret Data</label>
                                    {formData.type === 'ssh-key' ? (
                                        <textarea required value={formData.privateKey} onChange={e => setFormData({...formData, privateKey: e.target.value})} className="w-full h-32 bg-black/20 border border-white/5 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-1 transition-all font-mono resize-none placeholder:text-slate-700" style={{ '--tw-ring-color': activeTheme.primary } as any} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
                                    ) : (
                                        <div className="relative">
                                            <input required type={showSecret ? 'text' : 'password'} value={formData.privateKey} onChange={e => setFormData({...formData, privateKey: e.target.value})} className="w-full h-12 bg-black/20 border border-white/5 rounded-xl pl-4 pr-12 text-sm text-white focus:outline-none focus:ring-1 transition-all font-mono placeholder:text-slate-700" style={{ '--tw-ring-color': activeTheme.primary } as any} placeholder="Secret value..." />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowSecret(!showSecret)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                                            >
                                                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-14 bg-white/[0.03] border border-white/5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/[0.06] transition-all active:scale-[0.98]">Cancel</button>
                                    <button type="submit" className="flex-[2] h-14 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2" style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}>
                                        <Save size={16}/> Save Secret
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="flex items-end justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 font-bold tracking-[0.2em] text-[10px] uppercase" style={{ color: activeTheme.primary }}>
                        <Shield size={14} /> Encrypted Storage
                    </div>
                    <h2 className="text-4xl font-extrabold text-white tracking-tight">Credential Vault</h2>
                    <p className="text-slate-500 font-medium max-w-lg">
                        Securely manage your SSH keys, PGP keys, and administrative passwords.
                    </p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handleOpenAddModal}
                        className="h-12 px-6 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg hover:brightness-110"
                        style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                    >
                        <Plus size={18} /> Add Secret
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {credentials.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem] text-slate-600 uppercase font-black tracking-widest text-[10px]">
                        Vault is Empty
                    </div>
                ) : (
                    credentials.map(cred => (
                        <div key={cred.id} className="bg-[#14171d] border border-white/5 p-6 rounded-3xl flex items-center justify-between group hover:border-white/20 transition-all">
                            <div className="flex items-center gap-6">
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center text-slate-500 transition-colors"
                                    style={{ color: activeTheme.primary }}>
                                    {cred.type === 'ssh-key' ? <Key size={24} /> : (cred.type === 'host-password' ? <HardDrive size={24} /> : <Shield size={24} />)}
                                </div>
                                <div>
                                    <h3 className="text-white font-bold">{cred.name}</h3>
                                    <p className="text-slate-500 text-[10px] uppercase tracking-widest font-black mt-1">{cred.username} • {cred.type}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 transition-opacity">
                                <button
                                    onClick={() => handleOpenEditModal(cred)}
                                    className="p-3 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"><Edit3 size={16} /></button>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(cred.privateKey); notify('success', 'Key copied to clipboard'); }}
                                    className="p-3 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"><Copy size={16} /></button>
                                <button className="p-3 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"><ExternalLink size={16} /></button>
                                <button onClick={() => deleteCredential(cred.id)} className="p-3 hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
