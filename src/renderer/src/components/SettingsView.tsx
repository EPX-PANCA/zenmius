import { Settings as SettingsIcon, Shield, Bell, Monitor, Globe, Info, Save, RotateCcw, AlertTriangle, Wifi, Key, X, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { useStore, Settings } from '../store/useStore'
import { useState, useEffect } from 'react'

type SettingsTab = 'general' | 'security' | 'notifications' | 'proxy' | 'about'

export function SettingsView() {
    const { activeTheme, settings, updateSettings, notify } = useStore()
    const [localSettings, setLocalSettings] = useState<Settings>(settings)
    const [activeTab, setActiveTab] = useState<SettingsTab>('general')
    const [isPasswordModalOpen, setPasswordModalOpen] = useState(false)

    const handleSave = () => {
        updateSettings(localSettings)
        notify('success', 'Application settings updated successfully.')
    }

    const handleReset = () => {
        const initialSettings: Settings = {
            hardwareAcceleration: true,
            terminalFontSize: 13,
            autoLockVault: true,
            analyticsEnabled: false,
            syncInterval: 0,
            activeThemeName: activeTheme.name,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timeFormat: '24h',
            gitConfig: { url: '', token: '', username: '' },
            proxyHost: '',
            proxyPort: ''
        }
        setLocalSettings(initialSettings)
        updateSettings(initialSettings)
        notify('info', 'Settings restored to factory defaults.')
    }



    const purgeData = async () => {
        if (confirm('Are you absolutely sure? This will delete all hosts, vault data, and sync configurations. This action cannot be undone.')) {
            notify('error', 'Purging local data... This is a simulated destructive action.')
        }
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <section className="space-y-6 animate-fade-in">
                        <h3 className="text-white font-bold text-lg flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: activeTheme.primary + '20', color: activeTheme.primary }}>
                                <Monitor size={18} />
                            </div>
                            General Interface
                        </h3>

                        <div className="space-y-4">
                            <SettingToggle
                                label="Hardware Acceleration"
                                description="Use GPU for terminal and UI rendering. Recommended for high-refresh monitors."
                                enabled={localSettings.hardwareAcceleration}
                                onToggle={() => setLocalSettings({ ...localSettings, hardwareAcceleration: !localSettings.hardwareAcceleration })}
                            />
                            <SettingToggle
                                label="Analytics"
                                description="Send anonymous usage data to help us improve Zenmius. We never track your commands."
                                enabled={localSettings.analyticsEnabled}
                                onToggle={() => setLocalSettings({ ...localSettings, analyticsEnabled: !localSettings.analyticsEnabled })}
                            />
                            <div className="pt-4 flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <div>
                                    <h4 className="text-white text-sm font-bold">Terminal Font Size</h4>
                                    <p className="text-slate-500 text-[11px] mt-1">Adjust the default font size for all SSH sessions.</p>
                                </div>
                                <input
                                    type="number"
                                    value={localSettings.terminalFontSize}
                                    onChange={(e) => setLocalSettings({ ...localSettings, terminalFontSize: parseInt(e.target.value) })}
                                    className="w-20 bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-center font-bold focus:outline-none focus:ring-1 focus:ring-white/20 text-white"
                                />
                            </div>

                            {/* Time Configuration */}
                            <div className="pt-4 flex flex-col gap-4 p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-white text-sm font-bold">Timezone</h4>
                                        <p className="text-slate-500 text-[11px] mt-1">Set the display timezone for file timestamps.</p>
                                    </div>
                                    <select
                                        value={localSettings.timezone || 'UTC'}
                                        onChange={(e) => setLocalSettings({ ...localSettings, timezone: e.target.value })}
                                        className="w-48 bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-xs text-white outline-none"
                                    >
                                        {(Intl as any).supportedValuesOf('timeZone').map((tz: string) => (
                                            <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="h-px bg-white/5 w-full"></div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-white text-sm font-bold">Time Format</h4>
                                        <p className="text-slate-500 text-[11px] mt-1">Choose between 12-hour or 24-hour clock.</p>
                                    </div>
                                    <div className="flex bg-black/40 border border-white/5 rounded-lg p-1">
                                        <button
                                            onClick={() => setLocalSettings({ ...localSettings, timeFormat: '12h' })}
                                            className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${localSettings.timeFormat === '12h' ? 'text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                                            style={localSettings.timeFormat === '12h' ? { backgroundColor: activeTheme.primary } : {}}
                                        >
                                            12H
                                        </button>
                                        <button
                                            onClick={() => setLocalSettings({ ...localSettings, timeFormat: '24h' })}
                                            className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${localSettings.timeFormat === '24h' ? 'text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                                            style={localSettings.timeFormat === '24h' ? { backgroundColor: activeTheme.primary } : {}}
                                        >
                                            24H
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )
            case 'security':
                return (
                    <section className="space-y-6 animate-fade-in">
                        <h3 className="text-white font-bold text-lg flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <Shield size={18} />
                            </div>
                            Security & Vault
                        </h3>

                        <div className="space-y-4">
                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <h4 className="text-white text-sm font-bold">Master Password</h4>
                                    <p className="text-slate-500 text-[11px] mt-1">The default password is the one you set during the first unlock.</p>
                                </div>
                                <button
                                    onClick={() => setPasswordModalOpen(true)}
                                    className="px-6 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                                >
                                    <Key size={14} /> Change Password
                                </button>
                            </div>

                            <SettingToggle
                                label="Auto-Lock Vault"
                                description="Automatically lock the vault after 15 minutes of inactivity."
                                enabled={localSettings.autoLockVault}
                                onToggle={() => setLocalSettings({ ...localSettings, autoLockVault: !localSettings.autoLockVault })}
                            />

                            <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl space-y-4">
                                <h4 className="text-red-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle size={14} /> Danger Zone
                                </h4>
                                <p className="text-slate-500 text-[11px]">Once you purge your local database, all unbacked-up configurations will be lost forever.</p>
                                <button
                                    onClick={purgeData}
                                    className="px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Purge Local Data
                                </button>
                            </div>
                        </div>
                    </section>
                )
            case 'notifications':
                return (
                    <section className="space-y-6 animate-fade-in">
                        <h3 className="text-white font-bold text-lg flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <Bell size={18} />
                            </div>
                            Notifications
                        </h3>
                        <div className="space-y-4">
                            <SettingToggle
                                label="Sound Effects"
                                description="Play subtle sound effects for notifications and errors."
                                enabled={false}
                                onToggle={() => notify('info', 'Sound effects feature is coming soon.')}
                            />
                            <SettingToggle
                                label="Desktop Notifications"
                                description="Show native OS notifications when Zenmius is in the background."
                                enabled={true}
                                onToggle={() => { }}
                            />
                        </div>
                    </section>
                )

            case 'proxy':
                return (
                    <section className="space-y-6 animate-fade-in">
                        <h3 className="text-white font-bold text-lg flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <Wifi size={18} />
                            </div>
                            Proxy & Network
                        </h3>
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proxy Host</label>
                                <input
                                    type="text"
                                    value={localSettings.proxyHost || ''}
                                    onChange={(e) => setLocalSettings({ ...localSettings, proxyHost: e.target.value })}
                                    placeholder="e.g. 127.0.0.1"
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Port</label>
                                <input
                                    type="text"
                                    value={localSettings.proxyPort || ''}
                                    onChange={(e) => setLocalSettings({ ...localSettings, proxyPort: e.target.value })}
                                    placeholder="e.g. 1080"
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                                />
                            </div>
                        </div>
                    </section>
                )
            case 'about':
                return (
                    <section className="space-y-6 animate-fade-in">
                        <h3 className="text-white font-bold text-lg flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400" style={{ backgroundColor: activeTheme.primary + '10' }}>
                                <Info size={18} />
                            </div>
                            About Zenmius
                        </h3>
                        <div className="p-8 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-[2rem] text-center space-y-4">
                            <h2 className="text-2xl font-black text-white tracking-tight">ZENMIUS CORE</h2>
                            <div className="space-y-1">
                                <p className="font-mono text-xs" style={{ color: activeTheme.primary }}>v1.2.6-stable (2026)</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                                    Developed by <span style={{ color: activeTheme.primary }}>EPX-PANCA</span>
                                </p>
                            </div>
                            <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                                Zenmius is an advanced, open-source SSH, SFTP, VNC, and RDP client designed for the modern DevOps era. Built with Electron, React, and TypeScript.
                            </p>
                            <div className="pt-4 flex justify-center gap-4">
                                <button
                                    onClick={() => window.open('https://github.com/EPX-PANCA/zenmius/releases', '_blank')}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all"
                                >
                                    Check for Updates
                                </button>
                                <button
                                    onClick={() => window.open('https://github.com/EPX-PANCA/zenmius', '_blank')}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all"
                                >
                                    GitHub
                                </button>
                            </div>
                        </div>
                    </section >
                )
            default:
                return null
        }
    }

    return (
        <div className="p-12 max-w-6xl mx-auto space-y-12 animate-fade-in custom-scrollbar overflow-y-auto h-full pb-32 relative">
            <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setPasswordModalOpen(false)} />

            <div className="space-y-2">
                <div className="flex items-center gap-3 font-bold tracking-[0.2em] text-[10px] uppercase" style={{ color: activeTheme.primary }}>
                    <SettingsIcon size={14} /> System Configuration
                </div>
                <h2 className="text-4xl font-extrabold text-white tracking-tight">Settings</h2>
                <p className="text-slate-500 font-medium leading-relaxed max-w-2xl">
                    Fine-tune your Zenmius experience, manage security protocols, and configure global environment variables.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                {/* Navigation Sidebar */}
                <div className="md:col-span-3 space-y-2">
                    <SettingsLink active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={<Monitor size={18} />} label="General" />
                    <SettingsLink active={activeTab === 'security'} onClick={() => setActiveTab('security')} icon={<Shield size={18} />} label="Security" />
                    <SettingsLink active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} icon={<Bell size={18} />} label="Notifications" />

                    <SettingsLink active={activeTab === 'proxy'} onClick={() => setActiveTab('proxy')} icon={<Globe size={18} />} label="Proxy & Network" />
                    <SettingsLink active={activeTab === 'about'} onClick={() => setActiveTab('about')} icon={<Info size={18} />} label="About" />
                </div>

                {/* Content Area */}
                <div className="md:col-span-9 space-y-10 min-h-[400px]">
                    {renderContent()}

                    {/* Action Bar */}
                    <div className="flex items-center gap-4 pt-10 border-t border-white/5 mt-auto">
                        <button
                            onClick={handleSave}
                            className="h-12 px-10 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl hover:brightness-110 transition-all active:scale-95"
                            style={{ backgroundColor: activeTheme.primary }}
                        >
                            <Save size={18} /> Save Changes
                        </button>
                        <button
                            onClick={handleReset}
                            className="h-12 px-8 bg-white/[0.03] border border-white/5 text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-white/[0.06] transition-all"
                        >
                            <RotateCcw size={18} /> Reset to Default
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ChangePasswordModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const { notify, activeTheme } = useStore()

    // Reset state on open
    useEffect(() => {
        if (isOpen) {
            setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setIsLoading(false);
        }
    }, [isOpen])

    const handleSubmit = async () => {
        if (newPassword !== confirmPassword) {
            notify('error', 'New passwords do not match');
            return;
        }
        setIsLoading(true);
        const res = await window.electron.ipcRenderer.invoke('vault:change-password', { oldPassword, newPassword });
        if (res.success) {
            notify('success', 'Master Password changed successfully.');
            onClose();
        } else {
            notify('error', 'Failed to change password: ' + res.error);
        }
        setIsLoading(false);
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md border border-white/10 rounded-[2rem] p-8 shadow-2xl space-y-6"
                style={{ backgroundColor: activeTheme?.sidebar || '#14171d' }}
            >
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black text-white">Change Master Password</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl"><X size={18} /></button>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current Password</label>
                        <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
                    </div>
                    <div className="h-px bg-white/5 my-4"></div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">New Password</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Confirm New Password</label>
                        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !oldPassword || !newPassword}
                    className="w-full py-4 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex justify-center gap-2 items-center hover:brightness-110"
                    style={{ backgroundColor: activeTheme.primary }}
                >
                    {isLoading && <Lock size={14} className="animate-spin" />}
                    {isLoading ? 'Updating Vault...' : 'Update Password'}
                </button>
            </motion.div>
        </div>
    )
}

function SettingsLink({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
    const { activeTheme } = useStore()
    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-4 px-6 py-4 rounded-2xl cursor-pointer transition-all ${active ? 'bg-white/[0.05] text-white shadow-inner' : 'text-slate-500 hover:bg-white/[0.02] hover:text-slate-300'
                }`}>
            <div className={active ? '' : 'opacity-40'} style={active ? { color: activeTheme.primary } : {}}>
                {icon}
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
            {active && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeTheme.primary }}></div>}
        </div>
    )
}

function SettingToggle({ label, description, enabled, onToggle }: any) {
    const { activeTheme } = useStore()
    return (
        <div className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-all">
            <div className="max-w-[70%]">
                <h4 className="text-white text-sm font-bold">{label}</h4>
                <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">{description}</p>
            </div>
            <div
                onClick={onToggle}
                className="w-12 h-6 rounded-full relative cursor-pointer flex items-center px-1 transition-all"
                style={{ backgroundColor: enabled ? activeTheme.primary : 'rgba(255,255,255,0.05)' }}
            >
                <div className={`w-4 h-4 bg-white rounded-full shadow-lg transition-all ${enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
        </div>
    )
}
