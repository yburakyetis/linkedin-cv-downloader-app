const fs = require('fs').promises;
const path = require('path');
const { PATHS } = require('../config/constants');
const Logger = require('../utils/logger');

class StateManager {
    constructor() {
        this.userDataPath = path.join(process.cwd(), PATHS.USER_DATA || 'user_data');
        this.stateFilePath = path.join(this.userDataPath, 'app_state.json');
    }

    async _ensureDir() {
        try {
            await fs.mkdir(this.userDataPath, { recursive: true });
        } catch (e) {
            // Ignore error if it exists
        }
    }

    async loadState() {
        try {
            await this._ensureDir();
            const data = await fs.readFile(this.stateFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // Return empty object if file doesn't exist or is invalid
            // Don't log error here as it's normal on first run
            return {};
        }
    }

    async saveState(newState) {
        try {
            await this._ensureDir();
            // Load existing to merge to prevent overwriting other keys
            const current = await this.loadState();
            const merged = { ...current, ...newState };
            await fs.writeFile(this.stateFilePath, JSON.stringify(merged, null, 2));
            return merged;
        } catch (error) {
            Logger.error('Failed to save state:', error);
            return null;
        }
    }
}

module.exports = new StateManager();
