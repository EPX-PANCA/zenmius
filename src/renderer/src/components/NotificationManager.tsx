import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'

export function NotificationManager() {
    const { notifications, removeNotification } = useStore()

    return (
        <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                    <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, x: 20 }}
                        className={`
              pointer-events-auto min-w-[320px] p-4 rounded-2xl shadow-2xl border flex items-center gap-4 bg-[#14171d]/90 backdrop-blur-xl transition-all
              ${n.type === 'success' ? 'border-emerald-500/30' : n.type === 'error' ? 'border-red-500/30' : 'border-indigo-500/30'}
            `}
                    >
                        <div className={`p-2 rounded-xl ${n.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                                n.type === 'error' ? 'bg-red-500/10 text-red-500' :
                                    'bg-indigo-500/10 text-indigo-500'
                            }`}>
                            {n.type === 'success' ? <CheckCircle2 size={18} /> :
                                n.type === 'error' ? <AlertCircle size={18} /> :
                                    <Info size={18} />}
                        </div>

                        <div className="flex-1">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                                {n.type === 'error' ? 'System Fault' : 'Notification'}
                            </p>
                            <p className="text-xs font-bold text-white">{n.message}</p>
                        </div>

                        <button
                            onClick={() => removeNotification(n.id)}
                            className="p-1.5 hover:bg-white/5 rounded-lg text-slate-600 hover:text-white transition-all"
                        >
                            <X size={14} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
