import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, renameSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { sshManager } from './ssh-manager'
import { vaultManager } from './vault-manager'
import { gitManager } from './git-manager'
import { dbManager } from './db-manager'
import { systemManager } from './system-manager'
import { remoteManager } from './remote-manager'
import icon from '../../resources/icon.png?asset'

// Keep the user-data directory stable across platforms and releases.
app.setName('zenmius')

function migrateLegacyUserData(): void {
    const userDataPath = app.getPath('userData')
    const legacyPath = join(app.getPath('appData'), 'Zenmius')

    if (!existsSync(userDataPath) && existsSync(legacyPath) && legacyPath !== userDataPath) {
        renameSync(legacyPath, userDataPath)
        console.log(`[App] Migrated user data from ${legacyPath} to ${userDataPath}`)
    }
}

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        title: 'Zenmius',
        icon: icon,
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

app.whenReady().then(() => {
    migrateLegacyUserData()

    // Initialize Managers
    sshManager.init()
    vaultManager.init()
    gitManager.init()
    dbManager.init()
    systemManager.init()
    remoteManager.init()

    // Set app user model id for windows
    electronApp.setAppUserModelId('com.zenmius.app')

    if (process.platform === 'darwin') {
        app.dock.setIcon(icon)
    }

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// IPC Handlers
ipcMain.handle('ping', () => 'pong')
