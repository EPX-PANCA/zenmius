import Database from 'better-sqlite3'
import { app, ipcMain } from 'electron'
import { join } from 'path'

class DatabaseManager {
    private db: Database.Database | null = null

    init() {
        const dbPath = join(app.getPath('userData'), 'zenmius.db')
        this.db = new Database(dbPath)
        this.initSchema()
        this.setupHandlers()
    }

    private initSchema() {
        if (!this.db) return

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS hosts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                folder TEXT,
                tags TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS snippets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                command TEXT NOT NULL,
                tags TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS remote_connections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                protocol TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT,
                password TEXT,
                resolution TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Migration for missing columns
        try {
            this.db.exec('ALTER TABLE remote_connections ADD COLUMN password TEXT')
        } catch (e) { }

        try {
            this.db.exec('ALTER TABLE remote_connections ADD COLUMN resolution TEXT')
        } catch (e) { }
    }

    private seedDefaultSnippets() {
        if (!this.db) return

        const count = this.db.prepare('SELECT COUNT(*) as count FROM snippets').get() as any
        if (count.count === 0) {
            const defaults = [
                { id: '1', name: 'Update & Clean', command: 'sudo apt update && sudo apt upgrade -y && sudo apt autoremove', tags: ['ubuntu', 'ops'] },
                { id: '2', name: 'Docker Cleanup', command: 'docker system prune -a --volumes -f', tags: ['docker', 'dev'] },
                { id: '3', name: 'K8s Logs Tail', command: 'kubectl logs -f -l app=$APP --all-containers', tags: ['k8s', 'logs'] },
                { id: '4', name: 'Nginx Restart', command: 'sudo systemctl restart nginx && sudo nginx -t', tags: ['nginx', 'web'] },
                { id: '5', name: 'Disk Usage', command: 'du -sh * | sort -hr | head -n 10', tags: ['sys', 'debug'] }
            ]

            const stmt = this.db.prepare(`
                INSERT INTO snippets (id, name, command, tags, created_at)
                VALUES (@id, @name, @command, @tags, @created_at)
            `)

            const now = new Date().toISOString()
            for (const s of defaults) {
                stmt.run({ ...s, tags: JSON.stringify(s.tags), created_at: now })
            }
        }
    }

    public exportData() {
        if (!this.db) return { hosts: [], settings: null, snippets: [] }

        const hosts = this.db.prepare('SELECT * FROM hosts').all()
        const snippets = this.db.prepare('SELECT * FROM snippets').all()
        const settingsRow = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('app_settings') as any
        const remoteConnections = this.db.prepare('SELECT * FROM remote_connections').all()

        return {
            hosts: hosts.map((h: any) => ({ ...h, tags: JSON.parse(h.tags || '[]') })),
            snippets: snippets.map((s: any) => ({ ...s, tags: JSON.parse(s.tags || '[]') })),
            settings: settingsRow ? JSON.parse(settingsRow.value) : null,
            remoteConnections
        }
    }

    public importData(data: any) {
        if (!this.db || !data) return

        const importTx = this.db.transaction(() => {
            // Import Hosts
            if (Array.isArray(data.hosts)) {
                const stmt = this.db!.prepare(`
                    INSERT OR REPLACE INTO hosts (id, name, host, port, username, folder, tags, created_at)
                    VALUES (@id, @name, @host, @port, @username, @folder, @tags, @created_at)
                `)
                for (const host of data.hosts) {
                    stmt.run({
                        ...host,
                        tags: JSON.stringify(host.tags),
                        created_at: host.created_at || new Date().toISOString()
                    })
                }
            }

            // Import Snippets
            if (Array.isArray(data.snippets)) {
                const stmt = this.db!.prepare(`
                    INSERT OR REPLACE INTO snippets (id, name, command, tags, created_at)
                    VALUES (@id, @name, @command, @tags, @created_at)
                `)
                for (const s of data.snippets) {
                    stmt.run({
                        ...s,
                        tags: JSON.stringify(s.tags),
                        created_at: s.created_at || new Date().toISOString()
                    })
                }
            }

            // Import Settings
            if (data.settings) {
                const currentSettingsRow = this.db!.prepare('SELECT value FROM settings WHERE key = ?').get('app_settings') as any
                const currentSettings = currentSettingsRow ? JSON.parse(currentSettingsRow.value) : {}
                const newSettings = { ...data.settings }

                if (currentSettings.gitConfig && currentSettings.gitConfig.token) {
                    newSettings.gitConfig = currentSettings.gitConfig
                }

                const stmt = this.db!.prepare(`
                    INSERT INTO settings (key, value) VALUES ('app_settings', @value)
                    ON CONFLICT(key) DO UPDATE SET value = @value
                `)
                stmt.run({ value: JSON.stringify(newSettings) })
            }

            // Import Remote Connections
            if (Array.isArray(data.remoteConnections)) {
                const stmt = this.db!.prepare(`
                    INSERT OR REPLACE INTO remote_connections (id, name, protocol, host, port, username, password, resolution, created_at)
                    VALUES (@id, @name, @protocol, @host, @port, @username, @password, @resolution, @created_at)
                `)
                for (const rc of data.remoteConnections) {
                    stmt.run({
                        ...rc,
                        created_at: rc.created_at || new Date().toISOString()
                    })
                }
            }
        })

        importTx()
    }

    private setupHandlers() {
        ipcMain.handle('db:get-hosts', () => {
            const stmt = this.db!.prepare('SELECT * FROM hosts ORDER BY created_at DESC')
            const hosts = stmt.all()
            return hosts.map((h: any) => ({ ...h, tags: h.tags ? JSON.parse(h.tags) : [] }))
        })

        ipcMain.handle('db:get-snippets', () => {
            // Seed if empty on first fetch attempt strictly to be safe, though init() calls it.
            this.seedDefaultSnippets()
            const stmt = this.db!.prepare('SELECT * FROM snippets ORDER BY created_at DESC')
            const snippets = stmt.all()
            return snippets.map((s: any) => ({ ...s, tags: s.tags ? JSON.parse(s.tags) : [] }))
        })

        ipcMain.handle('db:save-snippet', (_, snippet) => {
            const stmt = this.db!.prepare(`
                INSERT OR REPLACE INTO snippets (id, name, command, tags, created_at)
                VALUES (@id, @name, @command, @tags, COALESCE((SELECT created_at FROM snippets WHERE id=@id), @created_at))
            `)
            try {
                stmt.run({
                    ...snippet,
                    tags: JSON.stringify(snippet.tags || []),
                    created_at: new Date().toISOString()
                })
                return { success: true }
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('db:delete-snippet', (_, id) => {
            const stmt = this.db!.prepare('DELETE FROM snippets WHERE id = ?')
            try {
                stmt.run(id)
                return { success: true }
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('db:add-host', (_, host) => {
            const stmt = this.db!.prepare(`
                INSERT INTO hosts (id, name, host, port, username, folder, tags)
                VALUES (@id, @name, @host, @port, @username, @folder, @tags)
            `)
            try {
                stmt.run({
                    ...host,
                    tags: JSON.stringify(host.tags || [])
                })
                return { success: true }
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('db:remove-host', (_, id) => {
            const stmt = this.db!.prepare('DELETE FROM hosts WHERE id = ?')
            try {
                stmt.run(id)
                return { success: true }
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('db:update-host', (_, host) => {
            const stmt = this.db!.prepare(`
                UPDATE hosts SET name = @name, host = @host, port = @port, 
                username = @username, folder = @folder, tags = @tags
                WHERE id = @id
            `)
            try {
                stmt.run({
                    ...host,
                    tags: JSON.stringify(host.tags || [])
                })
                return { success: true }
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('db:get-settings', () => {
            const stmt = this.db!.prepare('SELECT value FROM settings WHERE key = ?')
            const row = stmt.get('app_settings') as any
            return row ? JSON.parse(row.value) : null
        })

        ipcMain.handle('db:update-settings', (_, settings) => {
            const stmt = this.db!.prepare(`
                  INSERT INTO settings (key, value) VALUES ('app_settings', @value)
                  ON CONFLICT(key) DO UPDATE SET value = @value
              `)
            try {
                stmt.run({ value: JSON.stringify(settings) })
                return { success: true }
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        // Remote Connections Handlers
        ipcMain.handle('db:get-remote-connections', () => {
            // Explicitly select all columns, specifically including password
            const stmt = this.db!.prepare('SELECT id, name, protocol, host, port, username, password, resolution, created_at FROM remote_connections ORDER BY created_at DESC')
            return stmt.all()
        })

        ipcMain.handle('db:save-remote-connection', (_, conn) => {
            const stmt = this.db!.prepare(`
                INSERT OR REPLACE INTO remote_connections (id, name, protocol, host, port, username, password, resolution, created_at)
                VALUES (@id, @name, @protocol, @host, @port, @username, @password, @resolution, COALESCE((SELECT created_at FROM remote_connections WHERE id=@id), @created_at))
            `)
            try {
                stmt.run({
                    ...conn,
                    password: conn.password || '',
                    resolution: conn.resolution || 'smart', // Default to smart/dynamic
                    created_at: new Date().toISOString()
                })
                return { success: true }
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })

        ipcMain.handle('db:delete-remote-connection', (_, id) => {
            const stmt = this.db!.prepare('DELETE FROM remote_connections WHERE id = ?')
            try {
                stmt.run(id)
                return { success: true }
            } catch (e: any) {
                return { success: false, error: e.message }
            }
        })
    }
}

export const dbManager = new DatabaseManager()
