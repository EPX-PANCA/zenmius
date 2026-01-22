import { create } from 'zustand'

export interface Host {
    id: string
    name: string
    host: string
    port: number
    username: string
    tags: string[]
    folder: string | null
    lastConnected?: string
}

export interface Theme {
    name: string
    primary: string
    bg: string
    sidebar: string
}

export interface Notification {
    id: string
    type: 'success' | 'error' | 'info'
    message: string
}

export interface GitConfig {
    url: string
    token: string
    username: string
}

export interface Settings {
    hardwareAcceleration: boolean
    terminalFontSize: number
    autoLockVault: boolean
    analyticsEnabled: boolean
    syncInterval: number // 0 = manual, others = ms
    activeThemeName: string
    timezone: string
    timeFormat: '12h' | '24h'
    gitConfig: GitConfig
    proxyHost: string
    proxyPort: string
}

export interface LogEntry {
    id: string
    timestamp: string
    type: 'info' | 'success' | 'error' | 'warning'
    action: string
    message: string
    module: string
    details?: string
}

interface AppState {
    hosts: Host[]
    logs: LogEntry[] // New
    vaultLocked: boolean
    isInitialized: boolean
    activeTheme: Theme
    isAddHostModalOpen: boolean
    notifications: Notification[]
    settings: Settings
    loadData: () => Promise<void>
    addHost: (host: Host) => Promise<void>
    removeHost: (id: string) => Promise<void>
    setVaultLocked: (locked: boolean) => void
    setInitialized: (val: boolean) => void
    setTheme: (theme: Theme) => void
    setAddHostModalOpen: (open: boolean) => void
    notify: (type: 'success' | 'error' | 'info', message: string) => void
    addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void // New
    receiveLog: (log: LogEntry) => void // New
    removeNotification: (id: string) => void
    updateSettings: (settings: Partial<Settings>) => Promise<void>
    updateHost: (host: Host) => Promise<void>
}

const defaultThemes: Theme[] = [
    { name: 'Indigo Night', primary: '#6366f1', bg: '#0a0c10', sidebar: '#050608' },
    { name: 'Emerald Forest', primary: '#10b981', bg: '#060d0b', sidebar: '#020504' },
    { name: 'Crimson Peak', primary: '#f43f5e', bg: '#0f0a0a', sidebar: '#080505' },
    { name: 'Cyberpunk', primary: '#f0abfc', bg: '#0d0d1a', sidebar: '#070710' },
    { name: 'Slated Grey', primary: '#94a3b8', bg: '#0f172a', sidebar: '#020617' },
    { name: 'Amber Gold', primary: '#f59e0b', bg: '#0d0a05', sidebar: '#050402' }
]

const initialSettings: Settings = {
    hardwareAcceleration: true,
    terminalFontSize: 13,
    autoLockVault: true,
    analyticsEnabled: false,
    syncInterval: 0,
    activeThemeName: 'Indigo Night',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timeFormat: '24h',
    gitConfig: { url: '', token: '', username: '' },
    proxyHost: '',
    proxyPort: ''
}

export const useStore = create<AppState>((set, get) => ({
    hosts: [],
    logs: [], // Initialize
    vaultLocked: true,
    isInitialized: false,
    activeTheme: defaultThemes[0],
    isAddHostModalOpen: false,
    notifications: [],
    settings: initialSettings,

    loadData: async () => {
        // ... existing loadData ...
        try {
            const hosts = await window.electron.ipcRenderer.invoke('db:get-hosts')
            const settings = await window.electron.ipcRenderer.invoke('db:get-settings')
            const logs = await window.electron.ipcRenderer.invoke('db:get-logs')

            const loadedSettings = settings ? { ...initialSettings, ...settings } : initialSettings

            // Validate critical settings
            if (!loadedSettings.timezone) {
                loadedSettings.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
            }

            // Restore theme
            const savedTheme = defaultThemes.find(t => t.name === loadedSettings.activeThemeName)

            set({
                hosts: hosts || [],
                logs: logs || [],
                settings: loadedSettings,
                activeTheme: savedTheme || defaultThemes[0]
            })

            // Log startup
            get().addLog({
                type: 'info',
                module: 'System',
                action: 'Startup',
                message: 'Application loaded successfully',
                details: 'User session initialized'
            })
        } catch (error: any) {
            console.error('Failed to load data:', error)
            get().addLog({
                type: 'error',
                module: 'Database',
                action: 'Load Data',
                message: 'Failed to load initial data',
                details: error.message
            })
        }
    },

    // ... addHost ...
    addHost: async (host) => {
        set((state) => ({ hosts: [host, ...state.hosts] }))
        try {
            await window.electron.ipcRenderer.invoke('db:add-host', host)
            get().addLog({
                type: 'success',
                module: 'Host Manager',
                action: 'Add Host',
                message: `Host ${host.name} added`,
                details: JSON.stringify(host, null, 2)
            })
        } catch (error: any) {
            console.error('Failed to save host:', error)
            set((state) => ({ hosts: state.hosts.filter(h => h.id !== host.id) }))
            get().notify('error', 'Failed to save host to database')
            get().addLog({
                type: 'error',
                module: 'Host Manager',
                action: 'Add Host',
                message: `Failed to add host ${host.name}`,
                details: error.message
            })
        }
    },

    // ... removeHost ...
    removeHost: async (id) => {
        const previousHosts = get().hosts
        const hostName = previousHosts.find(h => h.id === id)?.name || id
        set((state) => ({ hosts: state.hosts.filter(h => h.id !== id) }))
        try {
            await window.electron.ipcRenderer.invoke('db:remove-host', id)
            get().addLog({
                type: 'info',
                module: 'Host Manager',
                action: 'Remove Host',
                message: `Host ${hostName} removed`,
                details: `Host ID: ${id}`
            })
        } catch (error: any) {
            set({ hosts: previousHosts })
            get().notify('error', 'Failed to delete host')
            get().addLog({
                type: 'error',
                module: 'Host Manager',
                action: 'Remove Host',
                message: `Failed to remove host ${hostName}`,
                details: error.message
            })
        }
    },

    setVaultLocked: (locked) => {
        set({ vaultLocked: locked })
        const settings = get().settings
        const timeZone = settings.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        const formattedDate = new Date().toLocaleString('en-US', {
            timeZone,
            hour12: settings.timeFormat === '12h'
        })
        get().addLog({
            type: locked ? 'warning' : 'success',
            module: 'Vault',
            action: locked ? 'Lock' : 'Unlock',
            message: locked ? 'Vault Locked' : 'Vault Unlocked',
            details: `Vault status changed at ${formattedDate}`
        })
    },
    setInitialized: (val) => set({ isInitialized: val }),
    setTheme: (theme) => {
        set({ activeTheme: theme })
        get().updateSettings({ activeThemeName: theme.name })
    },
    setAddHostModalOpen: (open) => set({ isAddHostModalOpen: open }),

    notify: (type, message) => {
        const id = Math.random().toString(36).substring(7)
        set((state) => ({ notifications: [...state.notifications, { id, type, message }] }))
        setTimeout(() => {
            set((state) => ({ notifications: state.notifications.filter(n => n.id !== id) }))
        }, 5000)
    },

    addLog: (entry) => {
        const log: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            ...entry
        }

        // Optimistically update UI
        set((state) => {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            const freshLogs = state.logs.filter(l => new Date(l.timestamp) > sevenDaysAgo)
            return { logs: [log, ...freshLogs].slice(0, 1000) }
        })

        // Persist to DB
        try {
            window.electron.ipcRenderer.invoke('db:add-log', log)
        } catch (e) {
            console.error('Failed to persist log:', e)
        }
    },

    // New: Handle incoming logs from backend (broadcasts)
    receiveLog: (log: LogEntry) => {
        set((state) => {
            // Deduplicate: If log with same ID exists, ignore (it was likely our own optimistic update)
            if (state.logs.some(l => l.id === log.id)) return {}

            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            const freshLogs = state.logs.filter(l => new Date(l.timestamp) > sevenDaysAgo)
            return { logs: [log, ...freshLogs].slice(0, 1000) }
        })
    },

    removeNotification: (id) => set((state) => ({ notifications: state.notifications.filter(n => n.id !== id) })),

    updateSettings: async (newSettings) => {
        const updated = { ...get().settings, ...newSettings }
        set({ settings: updated })
        try {
            await window.electron.ipcRenderer.invoke('db:update-settings', updated)
            get().addLog({
                type: 'info',
                module: 'Settings',
                action: 'Update',
                message: 'Settings updated',
                details: JSON.stringify(newSettings, null, 2)
            })
        } catch (error: any) {
            get().notify('error', 'Failed to save settings')
            get().addLog({
                type: 'error',
                module: 'Settings',
                action: 'Update',
                message: 'Failed to update settings',
                details: error.message
            })
        }
    },

    updateHost: async (host) => {
        set((state) => ({ hosts: state.hosts.map(h => h.id === host.id ? host : h) }))
        try {
            await window.electron.ipcRenderer.invoke('db:update-host', host)
            get().addLog({
                type: 'info',
                module: 'Host Manager',
                action: 'Update Host',
                message: `Host ${host.name} updated`,
                details: JSON.stringify(host, null, 2)
            })
        } catch (error: any) {
            get().loadData() // Re-sync on failure
            get().notify('error', 'Failed to update host in database')
            get().addLog({
                type: 'error',
                module: 'Host Manager',
                action: 'Update Host',
                message: `Failed to update host ${host.name}`,
                details: error.message
            })
        }
    }
}))
