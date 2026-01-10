/**
 * IPC Handlers
 * Registers all IPC event handlers for the application.
 */

const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const automationService = require('../services/automation/automation-service');
const StateManager = require('../services/state-manager');
const WindowManager = require('./window-manager');
const { PATHS } = require('../config/constants');
const Logger = require('../utils/logger');

class IpcHandlers {
    static register() {

        ipcMain.handle('start-download', async (event, config) => {
            try {
                const mainWindow = WindowManager.getMainWindow();
                const result = await automationService.startDownload(config, (data) => {
                    if (mainWindow) {
                        mainWindow.webContents.send('download-progress', data);

                        if (data.failure) {
                            // Determine failure type/reason
                            const reason = data.failure.reason || 'Unknown Error';
                            const name = data.failure.name || 'Unknown Applicant';
                            const page = data.failure.page;

                            // Add to Renderer UI log
                            mainWindow.webContents.send('add-failure-log', { name, reason, page });
                        }
                    }
                });
                return { success: true, result };
            } catch (error) {
                Logger.error('Start download handler failed', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('stop-download', async () => {
            try {
                await automationService.stop();
                return { success: true };
            } catch (error) {
                Logger.error('Stop download handler failed', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('reset-session', async () => {
            try {
                const userDataPath = require('electron').app.getPath('userData');
                await fs.rm(userDataPath, { recursive: true, force: true });
                return { success: true };
            } catch (error) {
                Logger.error('Reset session handler failed', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('pause-download', async () => {
            try {
                await automationService.pause();
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('resume-download', async () => {
            try {
                await automationService.resume();
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('check-resume-state', async () => {
            try {
                const state = await StateManager.loadState();
                return { canResume: !!state, state };
            } catch (error) {
                return { canResume: false };
            }
        });

        ipcMain.handle('discard-resume-state', async () => {
            await StateManager.clearState();
            return { success: true };
        });

        // Check Session (basic check if user_data exists)
        ipcMain.handle('check-session', async () => {
            try {
                const userDataPath = require('electron').app.getPath('userData');
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
