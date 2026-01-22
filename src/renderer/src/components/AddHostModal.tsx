import { useState, useMemo } from 'react'
import { X, Server, Globe, User, Hash, Folder, Tag, Plus, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore, Host } from '../store/useStore'

interface AddHostModalProps {
    isOpen: boolean
    onClose: () => void
    hostToEdit?: Host | null
}

export function AddHostModal({ isOpen, onClose, hostToEdit }: AddHostModalProps) {
    const { addHost, updateHost, hosts, activeTheme } = useStore()
    const [formData, setFormData] = useState({
        name: '',
        host: '',
        port: '22',
        username: '',
        folder: '',
        tags: ''
    })

    useMemo(() => {
        if (hostToEdit && isOpen) {
            setFormData({
                name: hostToEdit.name,
                host: hostToEdit.host,
                port: hostToEdit.port.toString(),
                username: hostToEdit.username,
                folder: hostToEdit.folder || '',
                tags: hostToEdit.tags.join(', ')
            })
        } else if (!hostToEdit && isOpen) {
            setFormData({ name: '', host: '', port: '22', username: '', folder: '', tags: '' })
        }
    }, [hostToEdit, isOpen])

    // Extract unique existing groups and tags for suggestions
    const existingGroups = useMemo(() => Array.from(new Set(hosts.map(h => h.folder).filter(Boolean))), [hosts])
    const existingTags = useMemo(() => Array.from(new Set(hosts.flatMap(h => h.tags))), [hosts])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const hostData: Host = {
            id: hostToEdit ? hostToEdit.id : Math.random().toString(36).substring(7),
            name: formData.name,
            host: formData.host,
            port: parseInt(formData.port),
            username: formData.username,
            folder: formData.folder || null,
            tags: formData.tags.split(',').map(t => t.trim()).filter(t => t !== '')
        }

        if (hostToEdit) {
            updateHost(hostData)
        } else {
            addHost(hostData)
        }

        onClose()
        setFormData({ name: '', host: '', port: '22', username: '', folder: '', tags: '' })
    }

    const addTag = (tag: string) => {
        const currentTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        if (!currentTags.includes(tag)) {
            setFormData({ ...formData, tags: [...currentTags, tag].join(', ') })
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-2xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl"
                        style={{ backgroundColor: activeTheme.sidebar }}
                    >
                        {/* Header */}
                        <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center border" style={{ backgroundColor: activeTheme.primary + '10', color: activeTheme.primary, borderColor: activeTheme.primary + '20' }}>
                                    {hostToEdit ? <ShieldCheck size={24} strokeWidth={3} /> : <Plus size={24} strokeWidth={3} />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white uppercase tracking-wider">{hostToEdit ? 'Update Resource' : 'Register New Resource'}</h2>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">{hostToEdit ? 'Modify host configuration' : 'SSH & Remote Node Configuration'}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-10 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                {/* Basic Info */}
                                <div className="space-y-6">
                                    <InputGroup
                                        icon={<Server size={18} />}
                                        label="Resource Name"
                                        placeholder="e.g. Production Web-01"
                                        value={formData.name}
                                        onChange={v => setFormData({ ...formData, name: v })}
                                        required
                                    />
                                    <InputGroup
                                        icon={<Globe size={18} />}
                                        label="Hostname / IP"
                                        placeholder="10.0.0.1 or domain.com"
                                        value={formData.host}
                                        onChange={v => setFormData({ ...formData, host: v })}
                                        required
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputGroup
                                            icon={<User size={18} />}
                                            label="Username"
                                            placeholder="root"
                                            value={formData.username}
                                            onChange={v => setFormData({ ...formData, username: v })}
                                            required
                                        />
                                        <InputGroup
                                            icon={<Hash size={18} />}
                                            label="Port"
                                            placeholder="22"
                                            value={formData.port}
                                            onChange={v => setFormData({ ...formData, port: v })}
                                        />
                                    </div>
                                </div>

                                {/* Organization */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <InputGroup
                                            icon={<Folder size={18} />}
                                            label="Folder / Group"
                                            placeholder="Infrastructure"
                                            value={formData.folder}
                                            onChange={v => setFormData({ ...formData, folder: v })}
                                        />
                                        {existingGroups.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {existingGroups.map((group: any) => (
                                                    <button
                                                        key={group}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, folder: group })}
                                                        className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition-colors"
                                                        style={{ backgroundColor: activeTheme.primary + '10', color: activeTheme.primary, borderColor: activeTheme.primary + '30' }}
                                                    >
                                                        {group}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <InputGroup
                                            icon={<Tag size={18} />}
                                            label="Tags (Comma separated)"
                                            placeholder="prod, web, backup"
                                            value={formData.tags}
                                            onChange={v => setFormData({ ...formData, tags: v })}
                                        />
                                        {existingTags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2 max-h-20 overflow-y-auto custom-scrollbar">
                                                {existingTags.map(tag => (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => addTag(tag)}
                                                        className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg bg-white/5 text-slate-500 hover:bg-white/10 hover:text-white transition-colors border border-white/5"
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 border rounded-2xl space-y-3" style={{ backgroundColor: activeTheme.primary + '05', borderColor: activeTheme.primary + '20' }}>
                                        <div className="font-bold text-[10px] uppercase tracking-widest flex items-center gap-2" style={{ color: activeTheme.primary }}>
                                            <ShieldCheck size={14} /> Security Note
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            Credentials will be requested upon first connection and securely stored in your AES-256 encrypted vault.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 h-14 bg-white/[0.03] border border-white/5 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/[0.06] transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] h-14 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:brightness-110 transition-all active:scale-[0.98]"
                                    style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                                >
                                    {hostToEdit ? 'Save Changes' : 'Register Resource'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

function InputGroup({ icon, label, placeholder, value, onChange, required }: any) {
    const { activeTheme } = useStore()
    return (
        <div className="space-y-2 group">
            <label
                className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 transition-colors group-focus-within:opacity-100"
                style={{ color: activeTheme.primary }}
            >
                {label}
            </label>
            <div className="relative">
                <div
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 transition-colors"
                    style={{ color: activeTheme.primary }}
                >
                    {icon}
                </div>
                <input
                    type="text"
                    required={required}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full h-12 bg-black/20 border border-white/5 rounded-xl pl-12 pr-4 text-sm focus:outline-none focus:ring-1 transition-all text-slate-200 placeholder:text-slate-700 focus:border-[var(--focus-color)] focus:ring-[var(--focus-ring)]"
                    style={{ '--focus-color': activeTheme.primary, '--focus-ring': activeTheme.primary + '40' } as any}
                />
            </div>
        </div>
    )
}
