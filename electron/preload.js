// File: project-root/electron/preload.js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  sendNativeNotification: (options) => ipcRenderer.send('show-native-notification', options),
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable), 
  getAutoLaunchStatus: () => ipcRenderer.invoke('get-auto-launch-status'),
  updateBadgeCount: (count) => ipcRenderer.send('update-badge-count', count),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  onTriggerFirebaseSignOut: (callback) => ipcRenderer.on('trigger-firebase-signout', callback),
  onTriggerImportTasks: (callback) => ipcRenderer.on('trigger-import-tasks', callback),
  onTriggerExportTasks: (callback) => ipcRenderer.on('trigger-export-tasks', callback),
  openExternalLink: (url) => ipcRenderer.send('open-external-link', url),
});
console.log('Electron Preload Script Loaded: electronAPI is available on window.');