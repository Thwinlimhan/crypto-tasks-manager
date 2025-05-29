// File: project-root/electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Notifications
  sendNativeNotification: (options) => ipcRenderer.send('show-native-notification', options),
  updateBadgeCount: (count) => ipcRenderer.send('update-badge-count', count),

  // Auto Launch
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable), 
  getAutoLaunchStatus: () => ipcRenderer.invoke('get-auto-launch-status'),

  // Minimize to Tray
  getMinimizeToTrayStatus: () => ipcRenderer.invoke('get-minimize-to-tray-status'),
  setMinimizeToTray: (enable) => ipcRenderer.invoke('set-minimize-to-tray', enable),

  // File System Dialogs & Operations
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),

  // App/Menu Triggers
  onTriggerFirebaseSignOut: (callback) => ipcRenderer.on('trigger-firebase-signout', callback),
  onTriggerImportTasks: (callback) => ipcRenderer.on('trigger-import-tasks', callback),
  onTriggerExportTasks: (callback) => ipcRenderer.on('trigger-export-tasks', callback),
  onNavigateToSettings: (callback) => ipcRenderer.on('navigate-to-settings', callback), 

  // External Links
  openExternalLink: (url) => ipcRenderer.send('open-external-link', url),

  // Clear App Data & Reset flow
  onFirebaseSignOutRequestForReset: (callback) => {
    const channel = 'request-firebase-signout-for-reset';
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
    return () => ipcRenderer.removeAllListeners(channel); 
  },
  sendFirebaseSignOutCompleteForReset: () => ipcRenderer.send('firebase-signout-for-reset-complete'),

  // Auto Updater IPC
  onUpdateMessage: (callback) => {
    const channel = 'update-message';
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
    return () => ipcRenderer.removeAllListeners(channel); // Cleanup function
  },
  checkForUpdates: () => ipcRenderer.send('check-for-updates'), // To trigger a check from renderer
});

console.log('Electron Preload Script Loaded: electronAPI is available on window.');
