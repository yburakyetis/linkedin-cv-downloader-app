const { contextBridge, ipcRenderer } = require('electron');
const { DEFAULTS } = require('./config/constants');

const electronAPI = {
  defaults: DEFAULTS,
  startDownload: (config) => ipcRenderer.invoke('start-download', config),
  stopDownload: () => ipcRenderer.invoke('stop-download'),
  pauseDownload: () => ipcRenderer.invoke('pause-download'),
  resumeDownload: () => ipcRenderer.invoke('resume-download'),
  checkResumeState: () => ipcRenderer.invoke('check-resume-state'),
  discardResumeState: () => ipcRenderer.invoke('discard-resume-state'),
  resetSession: () => ipcRenderer.invoke('reset-session'),
  checkSession: () => ipcRenderer.invoke('check-session'),
  onDownloadProgress: (callback) => {
    // Wrap callback to ensure it persists
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('download-progress', subscription);
    return () => {
      ipcRenderer.removeListener('download-progress', subscription);
    };
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
