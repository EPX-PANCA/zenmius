import { Clock, AlertCircle, Info, CheckCircle2, Search, ChevronRight, ChevronDown, Copy, Activity } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'

export function LogsView() {
    const { settings, notify, logs } = useStore() // Real logs from store
    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

    const formatTime = (isoString: string) => {
        try {
            return new Intl.DateTimeFormat('en-US', {
                timeZone: settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: settings.timeFormat === '12h'
            }).format(new Date(isoString))
        } catch (e) {
            return new Date(isoString).toLocaleString() // Fallback
        }
    }

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesFilter = filter === 'all' || log.type === filter
            const matchesSearch = log.message.toLowerCase().includes(search.toLowerCase()) ||
                log.action.toLowerCase().includes(search.toLowerCase()) ||
                log.module.toLowerCase().includes(search.toLowerCase())
            return matchesFilter && matchesSearch
        })
    }, [logs, filter, search])

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle2 size={14} className="text-emerald-500" />
            case 'error': return <AlertCircle size={14} className="text-red-500" />
            case 'warning': return <AlertCircle size={14} className="text-amber-500" />
            default: return <Info size={14} className="text-blue-500" />
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        notify('success', 'Log details copied to clipboard')
    }

    return (
        <div className="flex flex-col h-full bg-[#0c0e14] text-slate-300 p-6 animate-fade-in gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <Activity size={24} className="text-indigo-500" /> System Activity Logs
                    </h2>
                    <p className="text-slate-500 text-xs font-mono mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live Monitoring • {settings.timezone || 'Local System'}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-[#14171d] border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-indigo-500/50 w-64 transition-all"
                        />
                    </div>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="bg-[#14171d] border border-white/5 rounded-xl px-4 py-2 text-xs outline-none focus:border-indigo-500/50"
                    >
                        <option value="all">All Events</option>
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="error">Errors</option>
                        <option value="warning">Warnings</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 rounded-2xl bg-[#0a0c10] border border-white/5 overflow-hidden flex flex-col shadow-2xl">
                <div className="flex items-center px-6 py-3 bg-white/[0.02] border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-slate-500">
                    <div className="w-8"></div>
                    <div className="w-48">Timestamp</div>
                    <div className="w-24">Level</div>
                    <div className="w-32">Module</div>
                    <div className="w-40">Action</div>
                    <div className="flex-1">Message</div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filteredLogs.map((log) => (
                        <div key={log.id} className="group">
                            <div
                                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                className={`flex items-center px-4 py-3 rounded-lg transition-all text-xs font-mono cursor-pointer border border-transparent ${expandedLogId === log.id ? 'bg-white/[0.04] border-white/5' : 'hover:bg-white/[0.02]'
                                    }`}
                            >
                                <div className="w-8 text-slate-600 flex justify-center">
                                    {expandedLogId === log.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </div>
                                <div className="w-48 text-slate-500 flex items-center gap-2 font-bold opacity-80">
                                    <Clock size={12} />
                                    {formatTime(log.timestamp)}
                                </div>
                                <div className="w-24 flex items-center gap-2 uppercase font-bold text-[10px]">
                                    {getIcon(log.type)}
                                    <span className={
                                        log.type === 'error' ? 'text-red-500' :
                                            log.type === 'success' ? 'text-emerald-500' :
                                                log.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
                                    }>{log.type}</span>
                                </div>
                                <div className="w-32 text-indigo-400 font-bold text-[10px] uppercase tracking-wider">{log.module}</div>
                                <div className="w-40 text-slate-400 font-bold">{log.action}</div>
                                <div className="flex-1 text-slate-300 truncate group-hover:text-white transition-colors">{log.message}</div>
                            </div>

                            {/* Expanded Details */}
                            {expandedLogId === log.id && (
                                <div className="px-12 py-4 bg-black/40 border-b border-l border-r border-white/5 mx-2 rounded-b-xl mb-2 -mt-1 relative animate-in slide-in-from-top-2 duration-200">
                                    <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                                        <Activity size={12} /> Event Payload & Stack Trace
                                    </h4>
                                    <div className="relative group/code">
                                        <pre className="text-[10px] text-slate-400 font-mono bg-[#050608] p-4 rounded-xl border border-white/5 overflow-x-auto selection:bg-indigo-500/30">
                                            {log.details}
                                        </pre>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(log.details || 'No details available') }}
                                            className="absolute top-2 right-2 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all opacity-0 group-hover/code:opacity-100"
                                            title="Copy Details"
                                        >
                                            <Copy size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {filteredLogs.length === 0 && (
                        <div className="py-20 text-center text-slate-600 italic">No logs found matching your criteria.</div>
                    )}
                </div>
            </div>
        </div>
    )
}
