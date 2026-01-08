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
                nodeIntegration: false
            }
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
