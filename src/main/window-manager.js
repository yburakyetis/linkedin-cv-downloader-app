/**
 * Window Manager
 * Handles the creation and management of the Electron browser window.
 */

const { BrowserWindow } = require('electron');
const path = require('path');
const { DEFAULTS } = require('../config/constants');

class WindowManager {
    constructor() {
        this.mainWindow = null;
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: DEFAULTS.WINDOW_WIDTH,
            height: DEFAULTS.WINDOW_HEIGHT,
            webPreferences: {
                // Preload script must be absolute path
                preload: path.join(__dirname, '..', 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false // Ensure preload has access to node requires if needed (though contextIsolation is on)
            }
        });

        // Open DevTools to see console errors
        // this.mainWindow.webContents.openDevTools();

        this.mainWindow.webContents.on('did-finish-load', () => {
            console.log('Window loaded successfully');
        });

        this.mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
            console.error('Preload Error:', preloadPath, error);
        });

        this.mainWindow.loadFile('index.html');
        this.mainWindow.maximize();

        return this.mainWindow;
    }

    getMainWindow() {
        return this.mainWindow;
    }
}

module.exports = new WindowManager();
