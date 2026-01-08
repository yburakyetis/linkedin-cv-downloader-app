const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startDownload: (config) => ipcRenderer.invoke('start-download', config),
  stopDownload: () => ipcRenderer.invoke('stop-download'),
  resetSession: () => ipcRenderer.invoke('reset-session'),
  checkSession: () => ipcRenderer.invoke('check-session'),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  }
});
