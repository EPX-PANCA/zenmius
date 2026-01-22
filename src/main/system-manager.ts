import { ipcMain } from 'electron'
import si from 'systeminformation'

class SystemManager {
    init() {
        ipcMain.handle('system:stats', async () => {
            try {
                const [cpu, mem, fs] = await Promise.all([
                    si.currentLoad(),
                    si.mem(),
                    si.fsSize()
                ])

                // FS: get the main drive (usually mounted on / or C:)
                // On Windows it might be 'C:', on Linux '/', on Mac '/'
                const mainFs = fs.find(d => d.mount === '/' || d.mount === 'C:') || fs[0]

                return {
                    cpu: Math.round(cpu.currentLoad),
                    mem: {
                        total: mem.total,
                        used: mem.active,
                        free: mem.available
                    },
                    storage: {
                        total: mainFs ? mainFs.size : 0,
                        used: mainFs ? mainFs.used : 0,
                        percent: mainFs ? Math.round(mainFs.use) : 0
                    }
                }
            } catch (error) {
                console.error('Failed to get system stats:', error)
                return {
                    cpu: 0,
                    mem: { total: 0, used: 0, free: 0 },
                    storage: { total: 0, used: 0, percent: 0 }
                }
            }
        })
    }
}

export const systemManager = new SystemManager()
