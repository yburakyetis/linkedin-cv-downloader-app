/**
 * State Manager
 * Handles persistent state saving and loading for pause/resume functionality.
 */

const fs = require('fs').promises;
const path = require('path');
const { PATHS } = require('../config/constants');
const Logger = require('../utils/logger');

class StateManager {
    constructor() {
        this.userDataPath = require('electron').app.getPath('userData');
        this.stateFilePath = path.join(this.userDataPath, 'job_state.json');
        this.state = null;
    }

    async saveState(data) {
        try {
            await fs.mkdir(this.userDataPath, { recursive: true });
            const stateToSave = {
                timestamp: new Date().toISOString(),
                ...data
            };
            await fs.writeFile(this.stateFilePath, JSON.stringify(stateToSave, null, 2));
            this.state = stateToSave;
        } catch (error) {
            Logger.error('Failed to save state', error);
        }
    }

    async loadState() {
        try {
            await fs.access(this.stateFilePath);
            const data = await fs.readFile(this.stateFilePath, 'utf8');
            this.state = JSON.parse(data);
            return this.state;
        } catch (error) {
            // No state file exists, which is normal for a fresh start
            return null;
        }
    }

    async clearState() {
        try {
            await fs.rm(this.stateFilePath, { force: true });
            this.state = null;
        } catch (error) {
            Logger.warn('Failed to clear state file', error);
        }
    }

    getState() {
        return this.state;
    }
}

module.exports = new StateManager();
