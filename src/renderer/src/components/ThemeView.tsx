import { Palette, CheckCircle2, Layout, Monitor, MousePointer2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useStore, Theme } from '../store/useStore'
import { useEffect } from 'react'

const availableThemes: Theme[] = [
    { name: 'Indigo Night', primary: '#6366f1', bg: '#0a0c10', sidebar: '#050608' },
    { name: 'Emerald Forest', primary: '#10b981', bg: '#060d0b', sidebar: '#020504' },
    { name: 'Crimson Peak', primary: '#f43f5e', bg: '#0f0a0a', sidebar: '#080505' },
    { name: 'Cyberpunk', primary: '#f0abfc', bg: '#0d0d1a', sidebar: '#070710' },
    { name: 'Slated Grey', primary: '#94a3b8', bg: '#0f172a', sidebar: '#020617' },
    { name: 'Amber Gold', primary: '#f59e0b', bg: '#0d0a05', sidebar: '#050402' }
]

export function ThemeView() {
    const { activeTheme, setTheme } = useStore()

    useEffect(() => {
        document.documentElement.style.setProperty('--bg-main', activeTheme.bg)
        document.documentElement.style.setProperty('--bg-sidebar', activeTheme.sidebar)
        document.documentElement.style.setProperty('--bg-accent', activeTheme.primary)

        // Update body background specifically to avoid white flashes
        document.body.style.backgroundColor = activeTheme.bg
    }, [activeTheme])

    return (
        <div className="p-12 max-w-6xl mx-auto space-y-12 animate-fade-in custom-scrollbar overflow-y-auto h-full pb-24">
            <div className="space-y-2">
                <div className="flex items-center gap-3 font-bold tracking-[0.2em] text-[10px] uppercase" style={{ color: activeTheme.primary }}>
                    <Palette size={14} /> Aesthetics & Personalization
                </div>
                <h2 className="text-4xl font-extrabold text-white tracking-tight">Theme Studio</h2>
                <p className="text-slate-500 font-medium leading-relaxed max-w-2xl">
                    Customize your workspace with handcrafted themes. All themes are optimized for long-form terminal operations and contrast accessibility.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-white">
                {availableThemes.map(theme => (
                    <motion.div
                        key={theme.name}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setTheme(theme)}
                        className={`relative cursor-pointer rounded-[2.5rem] p-8 border-2 transition-all duration-500 overflow-hidden ${activeTheme.name === theme.name
                            ? 'bg-white/[0.03] shadow-2xl'
                            : 'border-white/5 bg-transparent hover:border-white/10'
                            }`}
                        style={{
                            borderColor: activeTheme.name === theme.name ? theme.primary : '',
                            boxShadow: activeTheme.name === theme.name ? `0 25px 50px -12px ${theme.primary}20` : ''
                        }}
                    >
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <h3 className="text-xl font-black text-white">{theme.name}</h3>
                            {activeTheme.name === theme.name && (
                                <CheckCircle2 size={24} style={{ color: theme.primary }} />
                            )}
                        </div>

                        <div className="flex gap-4 mb-8 relative z-10">
                            <div className="w-12 h-12 rounded-2xl border border-white/10 shadow-lg" style={{ backgroundColor: theme.bg }}></div>
                            <div className="w-12 h-12 rounded-2xl border border-white/10 shadow-lg" style={{ backgroundColor: theme.sidebar }}></div>
                            <div className="w-12 h-12 rounded-2xl border border-white/10 shadow-lg" style={{ backgroundColor: theme.primary }}></div>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: '66.6%' }}
                                    className="h-full"
                                    style={{ backgroundColor: theme.primary }}
                                ></motion.div>
                            </div>
                            <div className="flex justify-between text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                <span>Main UI</span>
                                <span>Sidebar</span>
                                <span>Accent</span>
                            </div>
                        </div>

                        {/* Background Glow */}
                        <div
                            className="absolute -bottom-12 -right-12 w-32 h-32 blur-[60px] rounded-full opacity-20 pointer-events-none transition-all duration-700"
                            style={{ backgroundColor: theme.primary }}
                        ></div>
                    </motion.div>
                ))}
            </div>

            <div className="pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <div className="space-y-2">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                        <Layout size={20} />
                    </div>
                    <h4 className="text-white font-bold text-sm">Glassmorphism</h4>
                    <p className="text-slate-600 text-xs font-medium">Native-style blur effects across all windows.</p>
                </div>
                <div className="space-y-2">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                        <Monitor size={20} />
                    </div>
                    <h4 className="text-white font-bold text-sm">Retina Ready</h4>
                    <p className="text-slate-600 text-xs font-medium">Sub-pixel font rendering for ultra-sharp text.</p>
                </div>
                <div className="space-y-2">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
                        <MousePointer2 size={20} />
                    </div>
                    <h4 className="text-white font-bold text-sm">GPU Rendered</h4>
                    <p className="text-slate-600 text-xs font-medium">Buttery smooth 120fps UI animations.</p>
                </div>
            </div>
        </div>
    )
}
