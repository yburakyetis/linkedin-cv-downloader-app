/**
 * IPC Handlers
 * Registers all IPC event handlers for the application.
 */

const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const automationService = require('../services/automation/automation-service');
const WindowManager = require('./window-manager');
const { PATHS } = require('../config/constants');
const Logger = require('../utils/logger');

class IpcHandlers {
    static register() {
        // Start Download
        ipcMain.handle('start-download', async (event, config) => {
            try {
                const mainWindow = WindowManager.getMainWindow();
                const result = await automationService.startDownload(config, (progress) => {
                    if (mainWindow) {
                        mainWindow.webContents.send('download-progress', progress);
                    }
                });
                return { success: true, result };
            } catch (error) {
                Logger.error('Start download handler failed', error);
                return { success: false, error: error.message };
            }
        });

        // Stop Download
        ipcMain.handle('stop-download', async () => {
            try {
                automationService.stop();
                return { success: true };
            } catch (error) {
                Logger.error('Stop download handler failed', error);
                return { success: false, error: error.message };
            }
        });

        // Reset Session
        ipcMain.handle('reset-session', async () => {
            try {
                const userDataPath = path.join(process.cwd(), PATHS.USER_DATA);
                await fs.rm(userDataPath, { recursive: true, force: true });
                return { success: true };
            } catch (error) {
                Logger.error('Reset session handler failed', error);
                return { success: false, error: error.message };
            }
        });

        // Check Session (basic check if user_data exists)
        ipcMain.handle('check-session', async () => {
            try {
                const userDataPath = path.join(process.cwd(), PATHS.USER_DATA);
                try {
                    await fs.access(userDataPath);
                    const files = await fs.readdir(userDataPath);
                    return { exists: files.length > 0 };
                } catch {
                    return { exists: false };
                }
            } catch (error) {
                return { exists: false };
            }
        });
    }
}

module.exports = IpcHandlers;
