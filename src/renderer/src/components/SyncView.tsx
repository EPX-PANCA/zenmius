import { useState, useEffect } from 'react'
import { Github, Globe, Key, Cloud, RefreshCw, AlertCircle, Save, Database, ArrowRightLeft, UploadCloud, DownloadCloud, Zap } from 'lucide-react'
import { useStore } from '../store/useStore'

export function SyncView() {
    const { settings, updateSettings, notify, loadData, activeTheme } = useStore()
    const [url, setUrl] = useState(settings.gitConfig?.url || '')
    const [username, setUsername] = useState(settings.gitConfig?.username || '')
    const [token, setToken] = useState(settings.gitConfig?.token || '')

    const [isSyncing, setIsSyncing] = useState(false)
    const [isChecking, setIsChecking] = useState(false)
    const [repoStatus, setRepoStatus] = useState<{ checked: boolean; isEmpty: boolean; error: string | null }>({
        checked: false,
        isEmpty: true,
        error: null
    })

    useEffect(() => {
        setUrl(settings.gitConfig?.url || '')
        setUsername(settings.gitConfig?.username || '')
        setToken(settings.gitConfig?.token || '')
    }, [settings.gitConfig])

    const handleSaveConfig = async () => {
        await updateSettings({
            gitConfig: { url, username, token }
        })
        await loadData() // Verify persistence
        notify('success', 'Git configuration saved locally.')
    }

    const checkStatus = async () => {
        if (!url || !token) {
            notify('error', 'URL and Token are required to check status.')
            return
        }
        setIsChecking(true)
        setRepoStatus({ ...repoStatus, checked: false, error: null })
        try {
            const res = await window.electron.ipcRenderer.invoke('git:check-status', { url, token, username })
            if (res.success) {
                setRepoStatus({ checked: true, isEmpty: res.isEmpty, error: null })
                notify('info', res.isEmpty ? 'Repository is empty and ready for initialization.' : 'Repository contains existing data.')
            } else {
                setRepoStatus({ checked: true, isEmpty: true, error: res.error })
                notify('error', `Connection Check Failed: ${res.error}`)
            }
        } catch (e: any) {
            setRepoStatus({ checked: true, isEmpty: true, error: e.message })
        }
        setIsChecking(false)
    }

    const handleSyncAction = async (mode: 'merge' | 'push' | 'pull') => {
        setIsSyncing(true)
        try {
            // Auto-save configuration before syncing to ensure persistence
            await updateSettings({
                gitConfig: { url, username, token }
            })

            // Format timestamp for commit message
            const options: Intl.DateTimeFormatOptions = {
                timeZone: settings.timezone || undefined,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: settings.timeFormat === '12h'
            }
            const timestamp = new Intl.DateTimeFormat('en-US', options).format(new Date())
            const commitMessage = `Sync [${mode.toUpperCase()}]: ${timestamp}`

            const res = await window.electron.ipcRenderer.invoke('git:sync', {
                url, token, username, mode, commitMessage
            })
            if (res.success) {
                await loadData() // RELOAD DATA FROM DB TO UI
                notify('success', `Sync completed [Mode: ${mode.toUpperCase()}]. Data is now consistent.`)
                setRepoStatus({ ...repoStatus, isEmpty: false })
            } else {
                notify('error', `Sync Failed: ${res.error}`)
            }
        } catch (e: any) {
            notify('error', `Sync Error: ${e.message}`)
        }
        setIsSyncing(false)
    }

    return (
        <div className="p-12 max-w-5xl mx-auto space-y-12 animate-fade-in custom-scrollbar overflow-y-auto h-full pb-24">
            <div className="space-y-2">
                <div className="flex items-center gap-3 font-bold tracking-[0.2em] text-[10px] uppercase" style={{ color: activeTheme.primary }}>
                    <Cloud size={14} /> Cloud Synchronization
                </div>
                <h2 className="text-4xl font-extrabold text-white tracking-tight">Git Sync</h2>
                <p className="text-slate-500 font-medium leading-relaxed">
                    Synchronize your encrypted vault, command snippets, and host configurations across devices using any Git provider.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden" style={{ backgroundColor: activeTheme.sidebar }}>
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                        {url.includes('gitlab') ? <Globe size={80} /> : <Github size={80} />}
                    </div>

                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Database size={16} style={{ color: activeTheme.primary }} /> Configuration
                    </h3>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Repository URL</label>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://gitlab.com/username/repo.git"
                                className="w-full h-12 bg-black/30 border border-white/5 rounded-xl px-4 text-sm focus:outline-none focus:ring-1 focus:ring-white/20 text-white"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Git Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Optional"
                                    className="w-full h-12 bg-black/30 border border-white/5 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Token</label>
                                <input
                                    type="password"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    placeholder="glpat-xxxxxxxxxxxx"
                                    className="w-full h-12 bg-black/30 border border-white/5 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleSaveConfig}
                            className="flex-1 h-12 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-white text-[10px] font-bold uppercase tracking-widest rounded-xl"
                        >
                            <Save size={16} /> Save Config
                        </button>
                        <button
                            onClick={checkStatus}
                            disabled={isChecking || !url}
                            className="flex-1 h-12 flex items-center justify-center gap-2 border hover:bg-white/5 active:scale-95 transition-all text-[10px] font-bold uppercase tracking-widest rounded-xl disabled:opacity-50"
                            style={{
                                borderColor: activeTheme.primary + '60',
                                color: activeTheme.primary
                            }}
                        >
                            {isChecking ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            Check Connection
                        </button>
                    </div>
                </div>

                {/* Status & Actions Panel */}
                <div className="border border-white/5 rounded-[2.5rem] p-8 space-y-6 shadow-2xl flex flex-col justify-between" style={{ backgroundColor: activeTheme.sidebar }}>
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-6">
                            <ArrowRightLeft size={16} className="text-emerald-400" /> Sync Actions
                        </h3>

                        {!repoStatus.checked ? (
                            <div className="flex flex-col items-center justify-center h-48 border border-dashed border-white/10 rounded-3xl space-y-3 opacity-30">
                                <AlertCircle size={32} />
                                <span className="text-[10px] uppercase font-bold tracking-widest">Run Connection Check First</span>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className={`p-5 rounded-2xl border transition-all duration-500 ${repoStatus.error ? 'bg-red-500/5 border-red-500/20 text-red-400' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'}`}>
                                    <div className="text-[10px] uppercase font-black tracking-widest opacity-50 mb-1.5 flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full animate-pulse ${repoStatus.error ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                        Remote Status
                                    </div>
                                    <div className="text-[11px] font-bold leading-relaxed uppercase tracking-wide">
                                        {repoStatus.error ? `Error: ${repoStatus.error}` : (repoStatus.isEmpty ? 'Empty Repository Detected' : 'Remote Data Found')}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {repoStatus.isEmpty ? (
                                        <button
                                            onClick={() => handleSyncAction('push')}
                                            disabled={isSyncing}
                                            className="w-full h-14 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all hover:brightness-110 disabled:opacity-50"
                                            style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                                        >
                                            <UploadCloud size={18} /> Push Local to Remote
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleSyncAction('merge')}
                                                disabled={isSyncing}
                                                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
                                                style={{ color: activeTheme.primary, borderColor: activeTheme.primary + '40' }}
                                            >
                                                <Zap size={18} className="text-yellow-400" /> Sync & Merge
                                            </button>

                                            <div className="flex items-center gap-4 py-2">
                                                <div className="h-px bg-white/5 flex-1" />
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] whitespace-nowrap">Advanced Actions</span>
                                                <div className="h-px bg-white/5 flex-1" />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => handleSyncAction('pull')}
                                                    disabled={isSyncing}
                                                    className="h-14 px-2 border border-white/5 bg-white/[0.02] text-slate-400 rounded-2xl font-bold text-[9px] uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 active:scale-95 transition-all disabled:opacity-30"
                                                    title="Overwrite local data with remote data"
                                                >
                                                    <DownloadCloud size={14} className="shrink-0" />
                                                    <span className="whitespace-nowrap">Pull & Replace</span>
                                                </button>
                                                <button
                                                    onClick={() => handleSyncAction('push')}
                                                    disabled={isSyncing}
                                                    className="h-14 px-2 border border-white/5 bg-white/[0.02] text-slate-400 rounded-2xl font-bold text-[9px] uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/20 active:scale-95 transition-all disabled:opacity-30"
                                                    title="Overwrite remote data with local data"
                                                >
                                                    <UploadCloud size={14} className="shrink-0" />
                                                    <span className="whitespace-nowrap">Push & Replace</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* Bottom Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2rem] space-y-4">
                    <h4 className="text-white font-bold uppercase tracking-widest text-[11px] flex items-center gap-2">
                        <Database size={14} style={{ color: activeTheme.primary }} /> Synchronization Logic
                    </h4>
                    <ul className="text-slate-500 text-[10px] space-y-3 font-medium leading-relaxed uppercase tracking-wider">
                        <li>• <span className="text-white">Merge:</span> Combines remote changes with your local hosts, snippets, and vault safely.</li>
                        <li>• <span className="text-red-400">Replace Local:</span> Deletes local configurations and loads from Git.</li>
                        <li>• <span className="text-amber-500">Replace Remote:</span> Overwrites Git repository with your current state.</li>
                    </ul>
                </div>
                <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2rem] space-y-4">
                    <h4 className="text-white font-bold uppercase tracking-widest text-[11px] flex items-center gap-2">
                        <Key size={14} style={{ color: activeTheme.primary }} /> Security Notice
                    </h4>
                    <p className="text-slate-500 text-[10px] leading-relaxed uppercase tracking-wider font-medium">
                        Your configurations are encrypted with your Master Password <span className="text-white">before</span> being pushed to Git. Even the Git provider cannot see your passwords or SSH keys.
                    </p>
                </div>
            </div>
        </div>
    )
}
