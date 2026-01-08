/**
 * Main Process Entry Point
 * Initializes the Electron application.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const WindowManager = require('./window-manager');
const IpcHandlers = require('./ipc-handlers');
const Logger = require('../utils/logger');

// Register IPC handlers immediately
IpcHandlers.register();

app.whenReady().then(() => {
    Logger.info('App starting...');
    WindowManager.createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            WindowManager.createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
