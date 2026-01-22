import { useState, useEffect } from 'react'
import { Plus, Trash2, Copy, Edit3, Code2, Play, Search, Filter, ChevronDown, Terminal, X, Save, Tag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'

// Extend window.electron to avoid type errors (if not already working globally)
declare global {
    interface Window {
        electron: any
    }
}

interface SnippetViewProps {
    sessions: any[]
    onRun: (sessionId: string, command: string) => void
}

export function SnippetView({ sessions, onRun }: SnippetViewProps) {
    const { notify, activeTheme } = useStore()
    const [searchQuery, setSearchQuery] = useState('')
    const [runMenuOpen, setRunMenuOpen] = useState<string | null>(null)
    const [snippets, setSnippets] = useState<any[]>([])

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingSnippet, setEditingSnippet] = useState<any>(null)
    const [formData, setFormData] = useState({ name: '', command: '', tags: '' })

    // Calculate commonly used tags from existing snippets
    const allTags = Array.from(new Set(snippets.flatMap(s => s.tags)))

    const loadSnippets = async () => {
        try {
            const data = await window.electron.ipcRenderer.invoke('db:get-snippets')
            setSnippets(data)
        } catch (error) {
            console.error('Failed to load snippets:', error)
            notify('error', 'Failed to load snippets')
        }
    }

    useEffect(() => {
        loadSnippets()
    }, [])

    const activeSessions = sessions.filter(s => s.isConnected)

    useEffect(() => {
        const handleClickOutside = () => setRunMenuOpen(null)
        window.addEventListener('click', handleClickOutside)
        return () => window.removeEventListener('click', handleClickOutside)
    }, [])

    const handleRunClick = (e: React.MouseEvent, snippetId: string) => {
        e.stopPropagation()
        if (activeSessions.length === 0) {
            notify('error', 'No active SSH sessions found. Connect to a host first.')
            return
        }
        setRunMenuOpen(runMenuOpen === snippetId ? null : snippetId)
    }

    const executeRun = (sessionId: string, command: string) => {
        console.log('Executing run on session', sessionId, command) // Debug log
        onRun(sessionId, command)
        setRunMenuOpen(null)
        notify('success', 'Command sent to session')
    }

    const filteredSnippets = snippets.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const handleCopy = (command: string) => {
        navigator.clipboard.writeText(command)
        notify('success', 'Command copied to clipboard')
    }

    const handleDelete = async (id: string) => {
        if (confirm('Delete this snippet?')) {
            try {
                const res = await window.electron.ipcRenderer.invoke('db:delete-snippet', id)
                if (res.success) {
                    notify('info', 'Snippet removed')
                    loadSnippets()
                } else {
                    notify('error', 'Failed to remove snippet')
                }
            } catch (err) {
                notify('error', 'Error deleting snippet')
            }
        }
    }

    // Modal Logic
    const openModal = (snippet?: any) => {
        if (snippet) {
            setEditingSnippet(snippet)
            setFormData({
                name: snippet.name,
                command: snippet.command,
                tags: snippet.tags.join(', ')
            })
        } else {
            setEditingSnippet(null)
            setFormData({ name: '', command: '', tags: '' })
        }
        setIsModalOpen(true)
    }

    const handleSave = async () => {
        if (!formData.name || !formData.command) {
            notify('error', 'Name and Command are required')
            return
        }

        const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t !== '')

        const snippetData = {
            id: editingSnippet ? editingSnippet.id : crypto.randomUUID(), // Use crypto.randomUUID() for cleaner IDs
            name: formData.name,
            command: formData.command,
            tags: tagsArray
        }

        try {
            const res = await window.electron.ipcRenderer.invoke('db:save-snippet', snippetData)
            if (res.success) {
                notify('success', editingSnippet ? 'Snippet updated' : 'Snippet created')
                loadSnippets()
                setIsModalOpen(false)
            } else {
                notify('error', 'Failed to save snippet')
            }
        } catch (err) {
            notify('error', 'Error saving snippet')
        }
    }

    const addTagToForm = (tag: string) => {
        const currentTags = formData.tags.split(',').map(t => t.trim()).filter(t => t !== '')
        if (!currentTags.includes(tag)) {
            setFormData({ ...formData, tags: [...currentTags, tag].join(', ') })
        }
    }

    return (
        <div className="p-12 max-w-7xl mx-auto space-y-12 animate-fade-in h-full overflow-y-auto custom-scrollbar pb-32 relative">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 font-bold tracking-[0.2em] text-[10px] uppercase" style={{ color: activeTheme.primary }}>
                        <Code2 size={14} /> Automation Engine
                    </div>
                    <h2 className="text-4xl font-extrabold text-white tracking-tight">Command Snippets</h2>
                    <p className="text-slate-500 font-medium max-w-lg leading-relaxed">
                        Save reusable command blocks and execute them across multiple sessions with one click.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-white transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search snippets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/[0.03] border border-white/5 rounded-2xl py-3 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/20 w-72 transition-all placeholder:text-slate-700 font-medium text-white"
                        />
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="h-12 px-6 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all hover:brightness-110"
                        style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                    >
                        <Plus size={18} /> New Snippet
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AnimatePresence mode="popLayout">
                    {filteredSnippets.map(snippet => (
                        <motion.div
                            layout
                            key={snippet.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] space-y-6 group hover:border-white/10 transition-all shadow-2xl relative"
                            style={{ zIndex: runMenuOpen === snippet.id ? 50 : 1 }}
                        >
                            {/* Background Container for Clipping */}
                            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
                                <div className="absolute top-0 left-0 w-full h-[100px] bg-gradient-to-b from-white/[0.01] to-transparent"></div>
                            </div>

                            <div className="flex justify-between items-start relative z-10">
                                <div className="space-y-1">
                                    <h3 className="text-white font-black text-xl tracking-tight group-hover:text-slate-200 transition-colors uppercase">{snippet.name}</h3>
                                    <div className="flex gap-2 flex-wrap">
                                        {snippet.tags.map((tag: string) => (
                                            <span key={tag} className="text-[9px] uppercase font-black tracking-widest text-slate-500 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">#{tag}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                    <button onClick={() => openModal(snippet)} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all"><Edit3 size={16} /></button>
                                    <button onClick={() => handleDelete(snippet.id)} className="p-2.5 bg-red-500/5 hover:bg-red-500/20 rounded-xl text-slate-500 hover:text-red-400 transition-all"><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <div className="p-6 bg-black/40 rounded-[1.5rem] border border-white/5 relative group/code overflow-hidden shadow-inner">
                                <code className="text-[11px] font-mono text-emerald-400/90 block break-all leading-relaxed pr-10">
                                    {snippet.command}
                                </code>
                                <button
                                    onClick={() => handleCopy(snippet.command)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all shadow-xl bg-white/5 text-slate-400 hover:text-white"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>

                            <div className="relative">
                                <button
                                    onClick={(e) => handleRunClick(e, snippet.id)}
                                    className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 border active:scale-95 ${runMenuOpen === snippet.id ? 'text-white border-transparent' : 'bg-white/[0.02] text-slate-400 border-white/5 hover:text-white'}`}
                                    style={runMenuOpen === snippet.id || runMenuOpen === null ? {
                                        backgroundColor: runMenuOpen === snippet.id ? activeTheme.primary : '',
                                        borderColor: runMenuOpen === snippet.id ? activeTheme.primary : ''
                                    } : {}}
                                    onMouseEnter={(e) => {
                                        if (runMenuOpen !== snippet.id) {
                                            e.currentTarget.style.backgroundColor = activeTheme.primary
                                            e.currentTarget.style.color = 'white'
                                            e.currentTarget.style.borderColor = activeTheme.primary
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (runMenuOpen !== snippet.id) {
                                            e.currentTarget.style.backgroundColor = ''
                                            e.currentTarget.style.color = '' // Revert to class control
                                            e.currentTarget.style.borderColor = ''
                                        }
                                    }}
                                >
                                    <Play size={12} fill="currentColor" /> Run in Active Session <ChevronDown size={12} />
                                </button>

                                {/* Session Selector Dropdown */}
                                <AnimatePresence>
                                    {runMenuOpen === snippet.id && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute top-full left-0 right-0 mt-2 bg-[#1a1d24] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-[100] p-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5 mb-1">Select Session</div>

                                            {activeSessions.length > 1 && (
                                                <button
                                                    onClick={() => {
                                                        activeSessions.forEach(s => executeRun(s.id, snippet.command))
                                                    }}
                                                    className="w-full text-left px-3 py-3 rounded-xl hover:bg-white/5 flex items-center gap-3 text-white transition-colors group/item mb-1 border border-white/10"
                                                >
                                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: activeTheme.primary }}>
                                                        <Play size={12} fill="currentColor" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold">Broadcast to All</div>
                                                        <div className="text-[9px] font-mono opacity-50">{activeSessions.length} Active Sessions</div>
                                                    </div>
                                                </button>
                                            )}

                                            {activeSessions.map(session => (
                                                <button
                                                    key={session.id}
                                                    onClick={() => executeRun(session.id, snippet.command)}
                                                    className="w-full text-left px-3 py-3 rounded-xl hover:bg-white/5 flex items-center gap-3 text-slate-300 hover:text-white transition-colors group/item"
                                                >
                                                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                        <Terminal size={12} />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold">{session.title}</div>
                                                        <div className="text-[9px] font-mono opacity-50">ID: {session.id.substring(0, 4)}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {filteredSnippets.length === 0 && (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center opacity-30">
                        <Filter size={48} className="text-slate-600 mb-4" />
                        <span className="font-black uppercase tracking-widest text-xs">No matching snippets</span>
                    </div>
                )}
            </div>

            {/* Edit/Create Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-8">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-[#14171d] border border-white/10 p-8 rounded-[2rem] w-full max-w-lg relative z-10 shadow-2xl space-y-6"
                            style={{ backgroundColor: activeTheme.sidebar }}
                        >
                            <div className="flex justify-between items-center">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                                    {editingSnippet ? 'Edit Snippet' : 'New Snippet'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Snippet Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all font-bold"
                                        placeholder="e.g. Update System"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Command</label>
                                    <textarea
                                        value={formData.command}
                                        onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-emerald-400 font-mono focus:outline-none focus:ring-1 focus:ring-white/20 transition-all min-h-[100px]"
                                        placeholder="sudo apt update..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tags</label>
                                    <input
                                        type="text"
                                        value={formData.tags}
                                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-400 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                                        placeholder="linux, ops, maintenance"
                                    />
                                    {/* Suggested Tags Area */}
                                    {allTags.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {allTags.map(tag => (
                                                <button
                                                    key={tag}
                                                    onClick={() => addTagToForm(tag)}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] uppercase font-bold text-slate-400 hover:text-white transition-all active:scale-95"
                                                >
                                                    <Tag size={10} /> {tag}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all flex items-center gap-2 hover:brightness-110"
                                    style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                                >
                                    <Save size={14} /> Save Snippet
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
