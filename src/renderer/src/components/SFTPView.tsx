import { useState, useEffect } from 'react'
import { Folder, File, ArrowLeft, RefreshCw, Trash2, Download, Upload, HardDrive, AlertCircle, FilePlus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'

// SFTP View Component - Integrated with Theme System
interface FileItem {
    filename: string
    longname: string
    attrs: {
        mode: number
        uid: number
        gid: number
        size: number
        atime: number
        mtime: number
    }
}

interface ProgressState {
    active: boolean
    type: 'upload' | 'download'
    percent: number
    filename: string
}

export function SFTPView({ id, onReconnect, isConnected }: { id: string, onReconnect?: () => void, isConnected?: boolean }) {
    const [path, setPath] = useState('/')
    const [files, setFiles] = useState<FileItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { notify, settings, activeTheme } = useStore()

    const [progress, setProgress] = useState<ProgressState>({ active: false, type: 'upload', percent: 0, filename: '' })

    // Drag & Drop State
    const [isDragOver, setIsDragOver] = useState(false)

    // Modals State
    const [isNewFolderOpen, setIsNewFolderOpen] = useState(false)
    const [isNewFileOpen, setIsNewFileOpen] = useState(false)
    const [newItemName, setNewItemName] = useState('')

    const loadDirectory = async (targetPath: string) => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await window.electron.ipcRenderer.invoke('sftp:list', { id, path: targetPath })
            if (res.success) {
                const sorted = res.list.sort((a: FileItem, b: FileItem) => {
                    const aIsDir = (a.attrs.mode & 0o040000) !== 0
                    const bIsDir = (b.attrs.mode & 0o040000) !== 0
                    if (aIsDir && !bIsDir) return -1
                    if (!aIsDir && bIsDir) return 1
                    return a.filename.localeCompare(b.filename)
                })
                setFiles(sorted)
                setPath(targetPath)
            } else {
                setError(res.error)
                notify('error', res.error)
            }
        } catch (e: any) {
            notify('error', 'Critical SFTP Fault: ' + e.message)
        }
        setIsLoading(false)
    }

    useEffect(() => {
        if (isConnected) {
            loadDirectory('/')
        }

        // Listen for progress
        const removeProgressListener = window.electron.ipcRenderer.on(`sftp:progress:${id}`, (_, data: any) => {
            setProgress({ active: true, type: data.type, percent: data.percent, filename: data.filename })
            if (data.percent >= 100) {
                setTimeout(() => setProgress(prev => ({ ...prev, active: false })), 1000)
            }
        })

        return () => {
            removeProgressListener()
        }
    }, [id, isConnected])

    const navigateUp = () => {
        if (path === '/') return
        const parts = path.split('/').filter(p => p !== '')
        parts.pop()
        loadDirectory('/' + parts.join('/'))
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatDate = (timestamp: number) => {
        try {
            return new Date(timestamp * 1000).toLocaleString('en-US', {
                timeZone: settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                hour12: settings.timeFormat === '12h',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch (e) {
            return new Date(timestamp * 1000).toLocaleString()
        }
    }

    const handleDelete = async (filename: string, isDir: boolean) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return
        const fullPath = path === '/' ? `/${filename}` : `${path}/${filename}`
        const res = await window.electron.ipcRenderer.invoke('sftp:remove', { id, path: fullPath, isDir })
        if (res.success) {
            notify('success', `Successfully deleted ${filename}`)
            loadDirectory(path)
        } else {
            notify('error', `Failed to delete: ${res.error}`)
        }
    }

    const handleUploadClick = async () => {
        const { canceled, filePaths } = await window.electron.ipcRenderer.invoke('dialog:open-file')
        if (canceled || !filePaths) return

        setIsLoading(true)
        for (const localPath of filePaths) {
            // Extract filename from path (cross-platform approach)
            const parts = localPath.split(/[/\\]/)
            const filename = parts[parts.length - 1]
            const remotePath = path === '/' ? `/${filename}` : `${path}/${filename}`

            setProgress({ active: true, type: 'upload', percent: 0, filename })
            const res = await window.electron.ipcRenderer.invoke('sftp:upload', { id, localPath, remotePath })
            if (res.success) {
                notify('success', `Uploaded ${filename}`)
            } else {
                notify('error', `Upload failed: ${res.error}`)
            }
        }
        setProgress(prev => ({ ...prev, active: false }))
        loadDirectory(path)
        setIsLoading(false)
    }

    const handleDownload = async (filename: string) => {
        const { canceled, filePath } = await window.electron.ipcRenderer.invoke('dialog:save-file', { defaultName: filename })
        if (canceled || !filePath) return

        const remotePath = path === '/' ? `/${filename}` : `${path}/${filename}`

        setIsLoading(true)
        setProgress({ active: true, type: 'download', percent: 0, filename })
        const res = await window.electron.ipcRenderer.invoke('sftp:download', { id, remotePath, localPath: filePath })

        if (res.success) {
            notify('success', `Downloaded ${filename}`)
        } else {
            notify('error', `Download failed: ${res.error}`)
        }
        setProgress(prev => ({ ...prev, active: false }))
        setIsLoading(false)
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)

        const droppedFiles = Array.from(e.dataTransfer.files)
        if (droppedFiles.length === 0) return

        setIsLoading(true)
        for (const file of droppedFiles) {
            const localPath = (file as any).path
            if (!localPath) {
                notify('error', `Could not get path for ${file.name}. Drag & drop usually requires local files.`)
                continue
            }

            const remotePath = path === '/' ? `/${file.name}` : `${path}/${file.name}`
            setProgress({ active: true, type: 'upload', percent: 0, filename: file.name })
            const res = await window.electron.ipcRenderer.invoke('sftp:upload', { id, localPath, remotePath })

            if (res.success) {
                notify('success', `Uploaded ${file.name}`)
            } else {
                notify('error', `Upload failed: ${res.error}`)
            }
        }
        setProgress(prev => ({ ...prev, active: false }))
        loadDirectory(path)
        setIsLoading(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
    }

    const handleCreateFolder = async () => {
        if (!newItemName.trim()) return
        const folderPath = path === '/' ? `/${newItemName}` : `${path}/${newItemName}`

        setIsLoading(true)
        const res = await window.electron.ipcRenderer.invoke('sftp:mkdir', { id, path: folderPath })
        if (res.success) {
            notify('success', `Created folder '${newItemName}'`)
            setNewItemName('')
            setIsNewFolderOpen(false)
            loadDirectory(path)
        } else {
            notify('error', `Failed to create folder: ${res.error}`)
        }
        setIsLoading(false)
    }

    const handleCreateFile = async () => {
        if (!newItemName.trim()) return
        const filePath = path === '/' ? `/${newItemName}` : `${path}/${newItemName}`

        setIsLoading(true)
        const res = await window.electron.ipcRenderer.invoke('sftp:create-file', { id, path: filePath })
        if (res.success) {
            notify('success', `Created file '${newItemName}'`)
            setNewItemName('')
            setIsNewFileOpen(false)
            loadDirectory(path)
        } else {
            notify('error', `Failed to create file: ${res.error}`)
        }
        setIsLoading(false)
    }

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center h-full bg-[#0a0c10] text-slate-500 gap-3">
                <RefreshCw className="animate-spin" size={18} />
                <span className="text-[10px] font-black uppercase tracking-widest">Waiting for SSH Connection...</span>
            </div>
        )
    }

    return (
        <div
            className="flex flex-col h-full bg-[#0a0c10] text-slate-300 relative"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            {/* Drag Overlay */}
            <AnimatePresence>
                {isDragOver && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-black/80 border-2 border-dashed backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none"
                        style={{ borderColor: activeTheme.primary }}
                    >
                        <Upload size={64} className="text-white mb-4 animate-bounce" style={{ color: activeTheme.primary }} />
                        <h2 className="text-2xl font-black text-white uppercase tracking-widest drop-shadow-lg">Drop Files to Upload</h2>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Upload Progress Bar (Persistent Toast) */}
            <AnimatePresence>
                {progress.active && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        className="absolute bottom-6 right-6 z-50 bg-[#1a1d24] border border-white/10 p-4 rounded-xl shadow-2xl w-80"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">
                                {progress.type === 'upload' ? 'Uploading...' : 'Downloading...'}
                            </span>
                            <span className="text-xs font-mono" style={{ color: activeTheme.primary }}>{progress.percent}%</span>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-300 ease-out"
                                style={{ width: `${progress.percent}%`, backgroundColor: activeTheme.primary }}
                            ></div>
                        </div>
                        <div className="mt-2 text-[9px] text-slate-500 truncate font-mono">
                            {progress.filename}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Modal (Shared UI for File/Folder) */}
            <AnimatePresence>
                {(isNewFolderOpen || isNewFileOpen) && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#1a1d24] border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl"
                        >
                            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                                {isNewFolderOpen ? <Folder style={{ color: activeTheme.primary }} /> : <File style={{ color: activeTheme.primary }} />}
                                {isNewFolderOpen ? 'New Folder' : 'New File'}
                            </h3>
                            <input
                                type="text"
                                autoFocus
                                placeholder={isNewFolderOpen ? "Folder Name" : "File Name"}
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (isNewFolderOpen ? handleCreateFolder() : handleCreateFile())}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-1 transition-colors mb-6 font-medium text-sm"
                                style={{ '--tw-ring-color': activeTheme.primary } as any}
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => { setIsNewFolderOpen(false); setIsNewFileOpen(false); setNewItemName(''); }}
                                    className="px-4 py-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={isNewFolderOpen ? handleCreateFolder : handleCreateFile}
                                    disabled={!newItemName.trim()}
                                    className="px-4 py-2 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ backgroundColor: activeTheme.primary }}
                                >
                                    Create
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* SFTP Toolbar */}
            <div className="h-14 border-b border-white/5 bg-black/20 flex items-center px-6 justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <button
                        onClick={navigateUp}
                        disabled={path === '/'}
                        className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl px-4 py-1.5 flex-1 max-w-2xl">
                        <Folder size={14} style={{ color: activeTheme.primary }} />
                        <span className="text-xs font-mono text-slate-400 truncate">{path}</span>
                    </div>

                    <button
                        onClick={() => loadDirectory(path)}
                        className={`p-2 hover:bg-white/5 rounded-lg transition-all ${isLoading ? 'animate-spin' : ''}`}
                        style={isLoading ? { color: activeTheme.primary } : {}}
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-3 ml-6">
                    <div className="flex bg-white/[0.03] rounded-xl p-0.5 border border-white/5">
                        <button
                            onClick={() => { setNewItemName(''); setIsNewFileOpen(true); }}
                            className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white text-slate-400 transition-all flex items-center gap-2"
                        >
                            <FilePlus size={14} /> File
                        </button>
                        <button
                            onClick={() => { setNewItemName(''); setIsNewFolderOpen(true); }}
                            className="h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white text-slate-400 transition-all flex items-center gap-2 border-l border-white/5"
                        >
                            <Folder size={14} /> Folder
                        </button>
                    </div>

                    <button
                        onClick={handleUploadClick}
                        className="h-9 px-4 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 flex items-center gap-2 brightness-110 hover:brightness-125 transition-all"
                        style={{ backgroundColor: activeTheme.primary, boxShadow: `0 10px 30px -10px ${activeTheme.primary}40` }}
                    >
                        <Upload size={14} /> Upload
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {
                error && (
                    <div className="m-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col gap-4 text-red-400 text-xs font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-4">
                            <AlertCircle size={18} />
                            <span>Error: {error}</span>
                        </div>
                        {(error.toLowerCase().includes('session') || error.toLowerCase().includes('connect')) && onReconnect && (
                            <button
                                onClick={() => { setError(null); onReconnect(); setTimeout(() => loadDirectory(path), 1500); }}
                                className="self-start px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-lg transition-all flex items-center gap-2"
                            >
                                <RefreshCw size={14} /> Reconnect Session
                            </button>
                        )}
                    </div>
                )
            }

            {/* File List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b border-white/5 mb-2">
                    <div className="col-span-4">Name</div>
                    <div className="col-span-2">Size</div>
                    <div className="col-span-3">Modified</div>
                    <div className="col-span-2">Permissions</div>
                    <div className="col-span-1 text-right"></div>
                </div>

                <div className="space-y-1">
                    <AnimatePresence mode="popLayout">
                        {files.map(file => {
                            const isDir = (file.attrs.mode & 0o040000) !== 0
                            return (
                                <motion.div
                                    key={file.filename}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-white/[0.03] rounded-xl transition-all group cursor-pointer border border-transparent hover:border-white/5"
                                    onDoubleClick={() => isDir && loadDirectory(path === '/' ? `/${file.filename}` : `${path}/${file.filename}`)}
                                >
                                    <div className="col-span-4 flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isDir ? 'bg-white/5' : 'bg-slate-500/10 text-slate-500'}`}
                                            style={isDir ? { color: activeTheme.primary, backgroundColor: activeTheme.primary + '15' } : {}}>
                                            {isDir ? <Folder size={16} /> : <File size={16} />}
                                        </div>
                                        <span className={`text-xs font-medium truncate ${isDir ? 'text-slate-200' : 'text-slate-400'}`}>
                                            {file.filename}
                                        </span>
                                    </div>

                                    <div className="col-span-2 flex items-center text-[10px] font-mono text-slate-500">
                                        {isDir ? '--' : formatSize(file.attrs.size)}
                                    </div>

                                    <div className="col-span-3 flex items-center text-[10px] font-mono text-slate-500">
                                        {formatDate(file.attrs.mtime)}
                                    </div>

                                    <div className="col-span-2 flex items-center text-[10px] font-mono text-slate-500">
                                        {file.attrs.mode.toString(8).slice(-3)}
                                    </div>

                                    <div className="col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!isDir && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDownload(file.filename); }}
                                                className="p-2 hover:bg-white/5 rounded-lg text-slate-500 transition-all"
                                                style={{ '&:hover': { color: activeTheme.primary } } as any}
                                                onMouseEnter={(e) => e.currentTarget.style.color = activeTheme.primary}
                                                onMouseLeave={(e) => e.currentTarget.style.color = 'inherit'}
                                                title="Download"
                                            >
                                                <Download size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(file.filename, isDir); }}
                                            className="p-2 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-500 transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>

                    {files.length === 0 && !isLoading && (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-600 gap-4">
                            <HardDrive size={48} className="opacity-20" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Directory is empty</span>
                        </div>
                    )}
                </div>
            </div>

            {/* SFTP Footer / Status */}
            <div className="h-10 border-t border-white/5 bg-black/40 flex items-center px-6 justify-between text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">
                <div className="flex items-center gap-6">
                    <span>{files.length} Objects</span>
                    <span>{files.filter(f => (f.attrs.mode & 0o040000) === 0).length} Files</span>
                    <span>{files.filter(f => (f.attrs.mode & 0o040000) !== 0).length} Directories</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeTheme.primary }}></div>
                    SFTP v3 ACTIVE
                </div>
            </div>
        </div >
    )
}
