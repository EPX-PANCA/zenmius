import { useStore } from '../store/useStore'
import { Server, MoreVertical, Folder, Plus, Search, ShieldCheck, Activity, Layers, Filter, Terminal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AddHostModal } from './AddHostModal'
import { useState, useMemo } from 'react'

export function HostGallery({ onConnect }: { onConnect: (host: any) => void }) {
    const { hosts, isAddHostModalOpen, setAddHostModalOpen, removeHost, notify, activeTheme } = useStore()
    const [searchQuery, setSearchQuery] = useState('')
    const [activeGroup, setActiveGroup] = useState<string | null>(null)
    const [activeTag, setActiveTag] = useState<string | null>(null)
    const [hostToEdit, setHostToEdit] = useState<any>(null)

    // Extract unique folders (groups) and tags
    const groups = useMemo(() => Array.from(new Set(hosts.map(h => h.folder).filter(Boolean))), [hosts])
    const allTags = useMemo(() => Array.from(new Set(hosts.flatMap(h => h.tags))), [hosts])

    // Filter logic
    const filteredHosts = hosts.filter(host => {
        const matchesSearch = host.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            host.host.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesGroup = activeGroup ? host.folder === activeGroup : true
        const matchesTag = activeTag ? host.tags.includes(activeTag) : true
        return matchesSearch && matchesGroup && matchesTag
    })

    const handleEdit = (host: any) => {
        setHostToEdit(host)
        setAddHostModalOpen(true)
    }

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this host?')) {
            removeHost(id)
            notify('info', 'Host removed successfully')
        }
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in relative pb-12">
            <AddHostModal
                isOpen={isAddHostModalOpen}
                onClose={() => { setAddHostModalOpen(false); setHostToEdit(null) }}
                hostToEdit={hostToEdit}
            />

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 font-bold tracking-[0.2em] text-[10px] uppercase" style={{ color: activeTheme.primary }}>
                        <Activity size={14} />
                        Live Dashboard
                    </div>
                    <h2 className="text-4xl font-extrabold text-white tracking-tight">Resource Gallery</h2>
                    <p className="text-slate-500 font-medium max-w-lg">
                        Manage and monitor your decentralized infrastructure across multi-cloud environments.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-white transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search hosts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/[0.03] border border-white/5 rounded-2xl py-3 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/20 w-72 transition-all placeholder:text-slate-700 font-medium text-white"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white"
                            >
                                x
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => { setHostToEdit(null); setAddHostModalOpen(true) }}
                        className="h-12 px-6 rounded-2xl text-sm font-bold text-white transition-all flex items-center gap-2 active:scale-95 shadow-xl hover:brightness-110"
                        style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                    >
                        <Plus size={18} /> <span className="uppercase tracking-widest text-xs">NEW</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-4 py-4 overflow-x-auto no-scrollbar">
                {/* Group Filters */}
                <div className="flex items-center gap-2 p-1 bg-white/[0.03] border border-white/5 rounded-xl">
                    <button
                        onClick={() => setActiveGroup(null)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${!activeGroup ? 'text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        style={!activeGroup ? { backgroundColor: activeTheme.primary } : {}}
                    >
                        <Layers size={12} /> All Groups
                    </button>
                    {groups.map(group => (
                        <button
                            key={group as string}
                            onClick={() => setActiveGroup(activeGroup === group ? null : group as string)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeGroup === group ? 'text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            style={activeGroup === group ? { backgroundColor: activeTheme.primary } : {}}
                        >
                            <Folder size={12} /> {group as string}
                        </button>
                    ))}
                </div>

                <div className="w-px h-8 bg-white/5 mx-2"></div>

                {/* Tag Filters */}
                <div className="flex items-center gap-2">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mr-2 flex items-center gap-2">
                        <Filter size={12} /> Tags:
                    </div>
                    {allTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${activeTag === tag ? 'text-white border-transparent' : 'bg-transparent text-slate-600 border-dashed border-white/10 hover:text-slate-400'}`}
                            style={activeTag === tag ? { backgroundColor: activeTheme.primary } : {}}
                        >
                            #{tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredHosts.map((host) => (
                        <motion.div
                            layout
                            key={host.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={{ y: -5 }}
                            onClick={() => onConnect(host)}
                            className="group relative bg-white/[0.02] border border-white/[0.03] rounded-[2.5rem] p-6 transition-all duration-500 shadow-2xl overflow-hidden cursor-pointer"
                            style={{ borderColor: 'rgba(255,255,255,0.03)' }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = activeTheme.primary + '60'
                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)'
                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'
                            }}
                        >
                            {/* Glossy Overlay */}
                            <div className="absolute top-0 left-0 right-0 h-[100px] bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>

                            <div className="flex justify-between items-start mb-6">
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner group-hover:scale-110"
                                    style={{ backgroundColor: activeTheme.primary + '20', color: activeTheme.primary }}>
                                    <Server size={28} />
                                </div>
                                <div className="flex flex-col items-end gap-2 text-white">
                                    <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                                        style={{ backgroundColor: activeTheme.primary + '15', color: activeTheme.primary }}>
                                        SSH
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleEdit(host) }}
                                        className="p-2 hover:bg-white/10 rounded-lg text-slate-600 hover:text-white transition-colors"
                                    >
                                        <MoreVertical size={16} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-1 truncate">{host.name}</h3>
                            <div className="text-xs text-slate-500 font-mono mb-4 truncate flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {host.username}@{host.host}
                            </div>

                            <div className="flex flex-wrap gap-2 mt-auto mb-6 min-h-[24px]">
                                {host.folder && (
                                    <span className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-white/5">
                                        <Folder size={12} /> {host.folder}
                                    </span>
                                )}
                                {host.tags.map(tag => (
                                    <span key={tag} className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/5 text-slate-500 border border-white/5">#{tag}</span>
                                ))}
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); onConnect(host) }}
                                className="w-full py-3.5 bg-[#1e2330] border border-white/10 text-slate-300 rounded-2xl text-[11px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = activeTheme.primary
                                    e.currentTarget.style.borderColor = activeTheme.primary
                                    e.currentTarget.style.color = '#ffffff'
                                    e.currentTarget.style.boxShadow = `0 10px 20px -10px ${activeTheme.primary}40`
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#1e2330'
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                                    e.currentTarget.style.color = 'rgb(203, 213, 225)'
                                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                                }}
                            >
                                <Terminal size={14} /> Connect SSH
                            </button>
                            <ShieldCheck size={80} className="text-white absolute bottom-6 right-6 opacity-10 group-hover:opacity-20 transition-opacity" />
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Add New Resource Card (Dashed) */}
                <motion.div
                    layout
                    whileHover={{ scale: 0.98 }}
                    onClick={() => { setHostToEdit(null); setAddHostModalOpen(true) }}
                    className="border-2 border-dashed border-white/[0.05] rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-slate-600 transition-all cursor-pointer bg-white/[0.01] min-h-[300px]"
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = activeTheme.primary + '50'
                        e.currentTarget.style.color = activeTheme.primary
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
                        e.currentTarget.style.color = 'rgb(71, 85, 105)'
                    }}
                >
                    <Plus size={48} className="mb-4 stroke-[1px]" />
                    <span className="text-xs font-black uppercase tracking-widest">Register Host</span>
                </motion.div>
            </div>

            {filteredHosts.length === 0 && (
                <div className="w-full py-20 flex flex-col items-center justify-center opacity-50">
                    <Search size={48} className="text-slate-600 mb-4" />
                    <p className="text-slate-500 font-bold">No hosts match your filter.</p>
                    <button onClick={() => { setSearchQuery(''); setActiveGroup(null); setActiveTag(null) }} className="mt-4 text-xs hover:underline" style={{ color: activeTheme.primary }}>Clear all filters</button>
                </div>
            )}
        </div>
    )
}
