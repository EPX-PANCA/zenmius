import { useState, useEffect } from 'react'
import { Shield, Key, Plus, Trash2, Copy, Lock, ExternalLink, HardDrive } from 'lucide-react'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'

export function VaultView() {
    const { vaultLocked, setVaultLocked, notify, activeTheme } = useStore()
    const [password, setPassword] = useState('')
    const [isVerifying, setIsVerifying] = useState(false)
    const [credentials, setCredentials] = useState<any[]>([])

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
                    const hostCreds = Object.entries(loadRes.data.hosts).map(([id, val]: [string, any]) => ({
                        id,
                        name: `Remote Credential (${id.substring(0, 8)})`,
                        type: 'host-password',
                        username: val.username,
                        privateKey: '******',
                        updatedAt: val.updatedAt
                    }))
                    credsArray = [...credsArray, ...hostCreds]
                }
            }
            setCredentials(credsArray)
        } else {
            // If load fails because locked, component will re-render blocked ui
            if (loadRes.error !== 'Vault locked') notify('error', loadRes.error)
        }
    }

    useEffect(() => {
        if (!vaultLocked) {
            loadVaultContent()
        }
    }, [vaultLocked])

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!password) {
            notify('error', 'Master password is required.')
            return
        }
        setIsVerifying(true)
        const res = await window.electron.ipcRenderer.invoke('vault:init', password)
        if (res.success) {
            await loadVaultContent()
            setVaultLocked(false)
            notify('success', 'Vault decrypted successfully.')
        } else {
            notify('error', res.error)
        }
        setIsVerifying(false)
    }

    const addCredential = async () => {
        const newCred = {
            id: Math.random().toString(36).substring(7),
            name: 'New SSH Key',
            type: 'ssh-key',
            username: 'root',
            privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----...'
        }
        // We need to fetch current vault structure first
        const currentRes = await window.electron.ipcRenderer.invoke('vault:load')
        let currentData = { secrets: [], hosts: {} }

        if (currentRes.success) {
            if (Array.isArray(currentRes.data)) {
                currentData.secrets = currentRes.data as any
            } else if (typeof currentRes.data === 'object') {
                currentData = { ...currentData, ...currentRes.data }
            }
        }

        const updatedSecrets = [...(currentData.secrets || []), newCred]
        const finalData = { ...currentData, secrets: updatedSecrets }

        const res = await window.electron.ipcRenderer.invoke('vault:save', finalData)
        if (res.success) {
            // Re-fetch to be consistent
            await window.electron.ipcRenderer.invoke('vault:load')
            // ... Or just update local state if we trust it, but we changed structure logic just above
            // Let's trigger a re-load logic or simpler:
            setCredentials([...credentials, newCred]) // Only UI update
            notify('success', 'Secret added to vault.')
        } else {
            notify('error', res.error)
        }
    }

    const deleteCredential = async (id: string) => {
        // For deletion, we need to know if it is a secret or a host credential
        const isHost = credentials.find(c => c.id === id)?.type === 'host-password'

        if (isHost) {
            // For now we don't impl delete host cred here as it's bound to host
            notify('info', 'Cannot delete host credential from here yet.')
            return
        }

        const currentRes = await window.electron.ipcRenderer.invoke('vault:load')
        if (!currentRes.success) return

        let currentData = currentRes.data
        if (Array.isArray(currentData)) {
            currentData = { secrets: currentData.filter((c: any) => c.id !== id) }
        } else {
            if (currentData.secrets) {
                currentData.secrets = currentData.secrets.filter((c: any) => c.id !== id)
            }
        }

        const res = await window.electron.ipcRenderer.invoke('vault:save', currentData)

        // Update local state
        const updated = credentials.filter(c => c.id !== id)
        if (res.success) {
            setCredentials(updated)
            notify('info', 'Secret removed from vault.')
        } else {
            notify('error', res.error)
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
                    <h2 className="text-3xl font-black text-white mb-6 uppercase tracking-wider">Vault Locked</h2>
                    <form onSubmit={handleUnlock} className="space-y-4">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Master Password"
                            className="w-full h-14 bg-black/30 border border-white/5 rounded-2xl px-6 text-sm focus:outline-none focus:ring-1 text-white transition-all"
                            style={{ borderColor: activeTheme.primary + '40' }}
                        />
                        <button
                            disabled={isVerifying}
                            className="w-full h-14 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
                            style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                        >
                            {isVerifying ? 'Decrypting...' : 'Unlock Vault'}
                        </button>
                    </form>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="p-12 max-w-7xl mx-auto space-y-10 animate-fade-in custom-scrollbar overflow-y-auto h-full pb-24">
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
                        onClick={addCredential}
                        className="h-12 px-6 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg brightness-110 hover:brightness-125"
                        style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                    >
                        <Plus size={18} /> Add Secret
                    </button>
                </div>
            </div>

            {/* Vault Items */}
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
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
