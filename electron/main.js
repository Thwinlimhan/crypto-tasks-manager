// File: project-root/electron/main.js
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog, shell, Notification: ElectronNotification } = require('electron');
const path =require('path');
const fs = require('fs').promises; 
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const AutoLaunch = require('auto-launch');

const store = new Store({
  defaults: { autoLaunch: false, minimizeToTray: true }
});

const appName = 'Airdrop Manager';
const appExecutablePath = app.getPath('exe');
const autoLauncher = new AutoLaunch({ name: appName, path: appExecutablePath, isHidden: true });

class AirdropManagerApp {
  constructor() {
    this.mainWindow = null; this.tray = null; this.isQuitting = false;
    this.initializeApp();
  }

  initializeApp() {
    if (isDev) {
      require('electron-reload')(__dirname, {
        electron: path.join(app.getAppPath(), 'node_modules', '.bin', 'electron'),
        hardResetMethod: 'exit'
      });
    }
    app.whenReady().then(() => {
      this.createWindow(); this.createTray(); this.setupAutoLaunch(); this.setupNativeInteractions(); 
    });
    app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) this.createWindow(); });
    app.on('before-quit', () => { this.isQuitting = true; });
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1280, height: 820, minWidth: 900, minHeight: 700,
      webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
      icon: path.join(__dirname, 'assets/icon.png'),
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      show: false, backgroundColor: '#111827'
    });
    const startUrl = isDev ? 'http://localhost:3000' : `file://${path.join(app.getAppPath(), 'build/index.html')}`;
    this.mainWindow.loadURL(startUrl);
    this.mainWindow.once('ready-to-show', () => { this.mainWindow.show(); if (isDev) this.mainWindow.webContents.openDevTools(); });
    this.mainWindow.on('close', (event) => { if (!this.isQuitting && store.get('minimizeToTray', true)) { event.preventDefault(); this.mainWindow.hide(); } });
    this.createMenu();
  }

  createTray() {
    const trayIconPath = path.join(__dirname, 'assets/tray-icon.png'); 
    const trayIcon = nativeImage.createFromPath(trayIconPath);
    this.tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
    const contextMenu = Menu.buildFromTemplate([
      { label: `Show ${appName}`, click: () => { if(this.mainWindow) { this.mainWindow.show(); this.mainWindow.focus(); } } },
      { label: 'Settings', click: () => { if(this.mainWindow) this.mainWindow.webContents.send('navigate-to-settings'); } },
      { type: 'separator' },
      { label: 'Sign Out', click: () => { if (this.mainWindow) this.mainWindow.webContents.send('trigger-firebase-signout'); } },
      { label: 'Quit', click: () => { this.isQuitting = true; app.quit(); } }
    ]);
    this.tray.setContextMenu(contextMenu); this.tray.setToolTip(appName);
    this.tray.on('double-click', () => { if(this.mainWindow) { this.mainWindow.show(); this.mainWindow.focus(); } });
  }

  createMenu() {
    const template = [
        ...(process.platform === 'darwin' ? [{
            label: app.name,
            submenu: [ { role: 'about' }, { type: 'separator' }, { label: 'Preferences...', accelerator: 'CmdOrCtrl+,', click: () => { if(this.mainWindow) this.mainWindow.webContents.send('navigate-to-settings');}}, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' } ]
          }] : []),
      { label: 'File', submenu: [ { label: 'Import Tasks...', click: () => { if(this.mainWindow) this.mainWindow.webContents.send('trigger-import-tasks'); }}, { label: 'Export Tasks...', click: () => { if(this.mainWindow) this.mainWindow.webContents.send('trigger-export-tasks'); }}, { type: 'separator' }, { label: 'Sign Out', click: () => { if (this.mainWindow) this.mainWindow.webContents.send('trigger-firebase-signout'); } }, process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' } ] },
      { label: 'Edit', submenu: [ { role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }]},
      { label: 'View', submenu: [ { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }]},
      { label: 'Window', submenu: [ { role: 'minimize' }, { role: 'zoom' }, ...(process.platform === 'darwin' ? [ { type: 'separator' }, { role: 'front' } ] : [ { role: 'close' } ])]}
    ];
    const menu = Menu.buildFromTemplate(template); Menu.setApplicationMenu(menu);
  }

  setupAutoLaunch() {
    autoLauncher.isEnabled().then(isEnabled => {
      const storedPreference = store.get('autoLaunch');
      if (isEnabled && !storedPreference) autoLauncher.disable();
      else if (!isEnabled && storedPreference) autoLauncher.enable();
    });
    ipcMain.handle('set-auto-launch', async (event, enable) => { try { if (enable) { await autoLauncher.enable(); store.set('autoLaunch', true); } else { await autoLauncher.disable(); store.set('autoLaunch', false); } return { success: true }; } catch (err) { console.error('Failed to update auto-launch:', err); return { success: false, error: err.message }; } });
    ipcMain.handle('get-auto-launch-status', async () => { return store.get('autoLaunch', false); });
  }

  setupNativeInteractions() {
    ipcMain.on('show-native-notification', (event, { title, body, icon }) => { if (ElectronNotification.isSupported()) new ElectronNotification({ title: title || appName, body: body || 'Notification', icon: icon || path.join(__dirname, 'assets/icon.png') }).show(); });
    ipcMain.on('update-badge-count', (event, count) => { if (app.dock && typeof app.dock.setBadge === 'function') app.dock.setBadge(count > 0 ? count.toString() : ''); });
    ipcMain.on('open-external-link', (event, url) => { if (url && (url.startsWith('http:') || url.startsWith('https:'))) shell.openExternal(url); else console.warn('Invalid external link:', url); });
    ipcMain.handle('show-open-dialog', async (event, options) => { if (!this.mainWindow) return { canceled: true, filePaths: [] }; return await dialog.showOpenDialog(this.mainWindow, options); });
    ipcMain.handle('show-save-dialog', async (event, options) => { if (!this.mainWindow) return { canceled: true, filePath: undefined }; return await dialog.showSaveDialog(this.mainWindow, options); });
    ipcMain.handle('read-file', async (event, filePath) => { try { const content = await fs.readFile(filePath, 'utf-8'); return { success: true, content }; } catch (error) { console.error('Read file error:', filePath, error); return { success: false, error: error.message }; } });
    ipcMain.handle('write-file', async (event, filePath, content) => { try { await fs.writeFile(filePath, content, 'utf-8'); return { success: true }; } catch (error) { console.error('Write file error:', filePath, error); return { success: false, error: error.message }; } });
  }
}
new AirdropManagerApp();