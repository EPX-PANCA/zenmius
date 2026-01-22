import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, X, Lock } from 'lucide-react'

interface PasswordModalProps {
    isOpen: boolean
    hostName: string
    onClose: () => void
    onSubmit: (password: string) => void
}

export function PasswordModal({ isOpen, hostName, onClose, onSubmit }: PasswordModalProps) {
    const [password, setPassword] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSubmit(password)
        setPassword('')
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-md bg-[#14171d] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                    >
                        {/* Close Button */}
                        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-xl text-slate-500 hover:bg-white/5 hover:text-white transition-all">
                            <X size={18} />
                        </button>

                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 shadow-[0_0_30px_-10px_rgba(99,102,241,0.3)] border border-indigo-500/20">
                                <Key size={32} />
                            </div>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider mb-2">Authentication Required</h2>
                            <p className="text-slate-500 text-xs font-medium">
                                Enter password for <span className="text-white font-bold">{hostName}</span>
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">SSH Password</label>
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                        <Lock size={16} />
                                    </div>
                                    <input
                                        type="password"
                                        autoFocus
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full h-12 bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-700 font-bold"
                                        placeholder="••••••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={!password}
                                className="w-full h-12 premium-gradient-bg text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                            >
                                Connect Securely
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
