// File: project-root/electron/main.js
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog, shell, Notification: ElectronNotification } = require('electron');
const path =require('path');
const fs = require('fs').promises; 
const fssync = require('fs'); 
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const AutoLaunch = require('auto-launch');

// --- Error Logging Setup ---
const errorLogPath = path.join(app.getPath('userData'), 'main-error.log');

function logError(error, context = 'General') {
  const timestamp = new Date().toISOString();
  let errorMessage = `${timestamp} [${context}] - Error: ${error.message || error}\n`;
  if (error.stack) {
    errorMessage += `Stack: ${error.stack}\n`;
  }
  errorMessage += '---------------------------------------------------\n';
  
  console.error(errorMessage); // Also log to console

  try {
    fssync.appendFileSync(errorLogPath, errorMessage);
  } catch (logWriteError) {
    console.error('Failed to write to error log file:', logWriteError);
  }
}

// Catch unhandled exceptions in the main process
process.on('uncaughtException', (error) => {
  logError(error, 'UncaughtException');
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError(reason, `UnhandledRejection at: ${promise}`);
});


// Conceptual: Import electron-updater - uncomment when ready to implement fully
// const { autoUpdater } = require('electron-updater');

// Initialize electron-store
const storeSchema = {
    autoLaunch: { type: 'boolean', default: false },
    minimizeToTray: { type: 'boolean', default: true },
    windowBounds: {
        type: 'object',
        properties: {
            width: { type: 'number' },
            height: { type: 'number' },
            x: { type: 'number' },
            y: { type: 'number' }
        },
        default: { width: 1280, height: 820 }
    }
};
const store = new Store({ schema: storeSchema, watch: true });


const appName = 'Airdrop Manager';
const appExecutablePath = app.getPath('exe'); 
const autoLauncher = new AutoLaunch({ name: appName, path: appExecutablePath, isHidden: true });

class AirdropManagerApp {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.isQuitting = false;
    this.initializeApp();
  }

  initializeApp() {
    try {
        const gotTheLock = app.requestSingleInstanceLock();
        if (!gotTheLock) {
          app.quit();
          return;
        }
        app.on('second-instance', () => {
          if (this.mainWindow) {
            if (this.mainWindow.isMinimized()) this.mainWindow.restore();
            this.mainWindow.focus();
          }
        });

        if (isDev) {
          try {
            console.log("Development mode: Enabling electron-reload.");
            require('electron-reload')(__dirname, {
              electron: path.join(app.getAppPath(), 'node_modules', '.bin', 'electron'),
              hardResetMethod: 'exit'
            });
          } catch (e) {
            console.warn('Electron-reload failed to load. This might happen if it is not a dev dependency or path is incorrect.', e);
          }
        }
        if (require('electron-squirrel-startup')) { app.quit(); return; }

        app.whenReady().then(() => {
          this.createWindow();
          this.createTray();
          this.setupAutoLaunch();
          this.setupNativeInteractions(); 
          this.setupAutoUpdater(); 
        }).catch(err => logError(err, "AppReady"));

        app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
        app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) this.createWindow(); });
        
        app.on('before-quit', () => {
          this.isQuitting = true;
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            store.set('windowBounds', this.mainWindow.getBounds());
          }
        });

    } catch(err) {
        logError(err, "AppInitialize");
    }
  }

  sendToMainWindow(channel, ...args) {
    if (this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.webContents) {
        this.mainWindow.webContents.send(channel, ...args);
    } else {
        console.log(`Main Process: mainWindow not available or destroyed. Cannot send message on channel ${channel}`);
    }
  }
  
  setupAutoUpdater() {
    ipcMain.on('check-for-updates', () => {
        console.log('Main: Received check-for-updates request.');
        this.sendToMainWindow('update-message', 'Checking for updates...');
        // Conceptual: autoUpdater.checkForUpdatesAndNotify();
        if (isDev) { 
            this.sendToMainWindow('update-message', 'Update check simulated in dev mode (no actual check).');
        } else {
            setTimeout(() => this.sendToMainWindow('update-message', 'No update available (simulated).'), 5000);
        }
    });
    // --- Uncomment and configure these when electron-updater is integrated ---
    // autoUpdater.on('checking-for-update', () => { /* ... */ });
    // autoUpdater.on('update-available', (info) => { /* ... */ });
    // autoUpdater.on('update-not-available', (info) => { /* ... */ });
    // autoUpdater.on('error', (err) => { /* ... */ });
    // autoUpdater.on('download-progress', (progressObj) => { /* ... */ });
    // autoUpdater.on('update-downloaded', (info) => { /* ... */ });
  }


  createWindow() {
    try {
        const { width, height, x, y } = store.get('windowBounds');
        const iconPath = path.join(__dirname, 'assets/icon.png');
        let windowOptions = {
          width: width, 
          height: height,
          x: x, 
          y: y,
          minWidth: 900,
          minHeight: 700,
          webPreferences: {
            nodeIntegration: false, 
            contextIsolation: true, 
            preload: path.join(__dirname, 'preload.js')
          },
          titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
          show: false, 
          backgroundColor: '#111827'
        };

        if (fssync.existsSync(iconPath)) {
            windowOptions.icon = iconPath;
        } else {
            console.warn(`Main application icon not found at ${iconPath}. Using default icon.`);
        }

        this.mainWindow = new BrowserWindow(windowOptions);
        const startUrl = isDev ? 'http://localhost:3000' : `file://${path.join(app.getAppPath(), 'build/index.html')}`;
        this.mainWindow.loadURL(startUrl).catch(err => logError(err, "MainWindowLoadURL"));

        this.mainWindow.once('ready-to-show', () => { 
            this.mainWindow.show();
            if (isDev) {
                this.mainWindow.webContents.openDevTools();
            }
        });
        const saveBounds = () => { 
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                store.set('windowBounds', this.mainWindow.getBounds());
            }
        };
        this.mainWindow.on('resized', saveBounds);
        this.mainWindow.on('moved', saveBounds);
        this.mainWindow.on('close', (event) => { 
            if (!this.isQuitting && store.get('minimizeToTray')) {
                event.preventDefault();
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    store.set('windowBounds', this.mainWindow.getBounds());
                }
                this.mainWindow.hide();
              } else if (!this.isQuitting) {
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    store.set('windowBounds', this.mainWindow.getBounds());
                }
              }
        });
        this.createMenu();
    } catch (err) {
        logError(err, "CreateWindow");
    }
  }

  createTray() {
    try {
        const trayIconPath = path.join(__dirname, 'assets/tray-icon.png'); 
        let trayIcon;

        if (fssync.existsSync(trayIconPath)) { 
            trayIcon = nativeImage.createFromPath(trayIconPath);
        } else {
            console.warn(`Tray icon not found at ${trayIconPath}. Tray will not be created.`);
            return; 
        }
        
        this.tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
        const contextMenu = Menu.buildFromTemplate([
          { label: `Show ${appName}`, click: () => { if(this.mainWindow && !this.mainWindow.isDestroyed()) { this.mainWindow.show(); this.mainWindow.focus(); } } },
          { label: 'Settings', click: () => { if(this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.webContents.send('navigate-to-settings'); } },
          { type: 'separator' },
          { label: 'Sign Out', click: () => { if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.webContents.send('trigger-firebase-signout'); } },
          { label: 'Quit', click: () => { this.isQuitting = true; app.quit(); } }
        ]);
        this.tray.setContextMenu(contextMenu);
        this.tray.setToolTip(appName);
        this.tray.on('double-click', () => { 
            if(this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.show();
                this.mainWindow.focus();
            }
        });
    } catch (err) {
        logError(err, "CreateTray");
    }
  }

  async handleClearAppDataAndReset() { 
    try {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) { 
            console.warn("Cannot clear app data, main window is not available.");
            return; 
        }
        const result = await dialog.showMessageBox(this.mainWindow, { 
            type: 'warning',
            buttons: ['Cancel', 'Clear and Relaunch'],
            defaultId: 0,
            title: 'Clear App Data',
            message: 'Are you sure you want to clear all app settings and preferences?',
            detail: 'This will sign you out, reset window size/position, auto-launch settings, and other stored preferences. Your task data in the cloud will NOT be affected. The app will relaunch after clearing.'
        });
        if (result.response === 1) { 
            console.log('Requesting Firebase sign-out from renderer...');
            this.mainWindow.webContents.send('request-firebase-signout-for-reset');
            const signOutTimeout = setTimeout(() => { 
                if (!app.isQuitting()) { 
                    console.warn('Firebase sign-out confirmation timeout. Proceeding with reset and relaunch.');
                    ipcMain.removeAllListeners('firebase-signout-for-reset-complete'); 
                    store.clear();
                    app.relaunch();
                    app.exit();
                }
            }, 10000); 
            ipcMain.once('firebase-signout-for-reset-complete', () => { 
                clearTimeout(signOutTimeout); 
                console.log('Firebase sign-out confirmed by renderer.');
                console.log('Clearing app data from electron-store...');
                store.clear(); 
                
                console.log('App data cleared. Relaunching application...');
                app.relaunch();
                app.exit();
            });
        } else {
            console.log('Clear app data cancelled by user.');
        }
    } catch (err) {
        logError(err, "HandleClearAppDataAndReset");
    }
  }


  createMenu() {
    try {
        const template = [
            ...(process.platform === 'darwin' ? [{
                label: app.name,
                submenu: [
                  { role: 'about' },
                  { type: 'separator' },
                  { 
                    label: 'Preferences...', 
                    accelerator: 'CmdOrCtrl+,',
                    click: () => { if(this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.webContents.send('navigate-to-settings');}
                  },
                  { type: 'separator' },
                  { 
                    label: 'Check for Updates...',
                    click: () => {
                        console.log('Menu: Check for Updates clicked (App Menu)');
                        this.sendToMainWindow('update-message', 'Manually checking for updates...');
                        // if (autoUpdater) autoUpdater.checkForUpdates(); else console.warn("autoUpdater not available");
                         if(isDev) { this.sendToMainWindow('update-message', 'Update check simulated in dev mode.'); }
                         else { setTimeout(() => this.sendToMainWindow('update-message', 'No updates found (manual check).'), 3000); }
                    }
                  },
                  { type: 'separator' },
                  { role: 'services' },
                  { type: 'separator' },
                  { role: 'hide' },
                  { role: 'hideOthers' },
                  { role: 'unhide' },
                  { type: 'separator' },
                  { role: 'quit' }
                ]
              }] : []),
          {
            label: 'File',
            submenu: [
              { 
                label: 'Import Tasks...', 
                accelerator: 'CmdOrCtrl+O',
                click: () => { if(this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.webContents.send('trigger-import-tasks'); }
              },
              { 
                label: 'Export Tasks...', 
                accelerator: 'CmdOrCtrl+S',
                click: () => { if(this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.webContents.send('trigger-export-tasks'); }
              },
              { type: 'separator' },
              { 
                label: 'Sign Out', 
                click: () => { if (this.mainWindow && !this.mainWindow.isDestroyed()) this.mainWindow.webContents.send('trigger-firebase-signout'); }
              },
              { type: 'separator' }, 
              {
                label: 'Open Configuration File Location', 
                click: () => {
                  try {
                    shell.showItemInFolder(store.path);
                  } catch (e) {
                    logError(e, "OpenConfigFileLocation");
                    dialog.showErrorBox("Error", "Could not open the configuration file location.");
                  }
                }
              },
              { 
                label: 'Clear App Data & Reset...', 
                click: async () => { await this.handleClearAppDataAndReset(); } 
              },
              { type: 'separator' }, 
              process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
            ]
          },
          {
            label: 'Edit',
            submenu: [ 
                { role: 'undo' }, { role: 'redo' }, { type: 'separator' }, 
                { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
                ...(process.platform === 'darwin' ? [
                    { role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }, 
                    { type: 'separator' }, { label: 'Speech', submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }] }
                ] : [ { role: 'delete' }, { type: 'separator' }, { role: 'selectAll' } ])
            ]
          },
          {
            label: 'View',
            submenu: [ 
                { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' },
                { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, 
                { role: 'togglefullscreen' }
            ]
          },
          {
            label: 'Window',
            submenu: [ 
                { role: 'minimize' }, { role: 'zoom' },
                ...(process.platform === 'darwin' ? [ { type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' } ] : [ { role: 'close' } ])
            ]
          },
          {
            role: 'help',
            submenu: [
              ...(process.platform !== 'darwin' ? [
                {
                    label: 'Check for Updates...',
                    click: () => {
                        console.log('Menu: Check for Updates clicked (Help Menu)');
                        this.sendToMainWindow('update-message', 'Manually checking for updates...');
                        // if (autoUpdater) autoUpdater.checkForUpdates(); else console.warn("autoUpdater not available");
                        if(isDev) { this.sendToMainWindow('update-message', 'Update check simulated in dev mode.'); }
                        else { setTimeout(() => this.sendToMainWindow('update-message', 'No updates found (manual check).'), 3000); }
                    }
                },
                { type: 'separator'}
              ] : []),
              {
                label: 'Learn More', 
                click: async () => {
                  await shell.openExternal('https://github.com/your-username/your-project-repo'); 
                }
              }
            ]
          }
        ];
        
        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    } catch (err) {
        logError(err, "CreateMenu");
    }
  }

  setupAutoLaunch() {
    try {
        autoLauncher.isEnabled().then(isEnabled => {
          const storedPreference = store.get('autoLaunch'); 
          if (isEnabled && !storedPreference) {
            autoLauncher.disable().catch(err => logError(err, "AutoLaunchDisable"));
          } else if (!isEnabled && storedPreference) {
            autoLauncher.enable().catch(err => logError(err, "AutoLaunchEnable"));
          }
        }).catch(err => logError(err, "AutoLaunchIsEnabledCheck"));

        ipcMain.handle('set-auto-launch', async (event, enable) => { 
            try { if (enable) { await autoLauncher.enable(); store.set('autoLaunch', true); } else { await autoLauncher.disable(); store.set('autoLaunch', false); } return { success: true }; } catch (err) { logError(err, "SetAutoLaunchIPC"); return { success: false, error: err.message }; }
        });
        ipcMain.handle('get-auto-launch-status', async () => { return store.get('autoLaunch', false); });
    } catch (err) {
        logError(err, "SetupAutoLaunch");
    }
  }

  setupNativeInteractions() {
    try {
        ipcMain.on('show-native-notification', (event, { title, body, icon }) => { if (ElectronNotification.isSupported()) new ElectronNotification({ title: title || appName, body: body || 'Notification', icon: icon || path.join(__dirname, 'assets/icon.png') }).show(); });
        ipcMain.on('update-badge-count', (event, count) => { if (app.dock && typeof app.dock.setBadge === 'function') app.dock.setBadge(count > 0 ? count.toString() : ''); });
        ipcMain.on('open-external-link', (event, url) => { if (url && (url.startsWith('http:') || url.startsWith('https:'))) shell.openExternal(url); else console.warn('Attempted to open invalid external link:', url); });
        ipcMain.handle('show-open-dialog', async (event, options) => { if (!this.mainWindow || this.mainWindow.isDestroyed()) return { canceled: true, filePaths: [] }; return await dialog.showOpenDialog(this.mainWindow, options); });
        ipcMain.handle('show-save-dialog', async (event, options) => { if (!this.mainWindow || this.mainWindow.isDestroyed()) return { canceled: true, filePath: undefined }; return await dialog.showSaveDialog(this.mainWindow, options); });
        ipcMain.handle('read-file', async (event, filePath) => { try { const content = await fs.readFile(filePath, 'utf-8'); return { success: true, content }; } catch (error) { logError(error, `ReadFileIPC: ${filePath}`); return { success: false, error: error.message }; } });
        ipcMain.handle('write-file', async (event, filePath, content) => { try { await fs.writeFile(filePath, content, 'utf-8'); return { success: true }; } catch (error) { logError(error, `WriteFileIPC: ${filePath}`); return { success: false, error: error.message }; } });
        ipcMain.handle('get-minimize-to-tray-status', async () => { return store.get('minimizeToTray', true); });
        ipcMain.handle('set-minimize-to-tray', async (event, enable) => { try { store.set('minimizeToTray', enable); return { success: true }; } catch (err) { logError(err, "SetMinimizeToTrayIPC"); return { success: false, error: err.message }; } });
    } catch (err) {
        logError(err, "SetupNativeInteractions");
    }
  }
}

new AirdropManagerApp();
