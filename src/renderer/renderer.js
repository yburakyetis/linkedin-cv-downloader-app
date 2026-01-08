/**
 * Renderer Process
 * Handles UI interactions and IPC communication.
 * Note: Merged with UiController to avoid 'require' issues in non-node-integrated renderer.
 */

class UiController {
    constructor() {
        this.elements = {
            form: document.getElementById('downloadForm'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            resetBtn: document.getElementById('resetBtn'),
            statusBox: document.getElementById('statusBox'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            logOutput: document.getElementById('logOutput'),
            folderInfoBox: document.getElementById('folderInfoBox'),
            folderNameEl: document.getElementById('folderName'),
            folderPathEl: document.getElementById('folderPath'),
            statsBox: document.getElementById('statsBox'),
            downloadCounter: document.getElementById('downloadCounter'),
            // Inputs
            applicantsUrl: document.getElementById('applicantsUrl'),
            maxCvCount: document.getElementById('maxCvCount'),
            minWait: document.getElementById('minWait'),
            maxWait: document.getElementById('maxWait'),
            startPage: document.getElementById('startPage'),
        };
    }

    getConfig() {
        return {
            applicantsUrl: this.elements.applicantsUrl.value,
            maxCvCount: parseInt(this.elements.maxCvCount.value),
            minWait: parseInt(this.elements.minWait.value),
            maxWait: parseInt(this.elements.maxWait.value),
            startPage: parseInt(this.elements.startPage.value) || 1
        };
    }

    showStatus(message, type = 'info') {
        this.elements.statusBox.textContent = message;
        this.elements.statusBox.className = `status-box active ${type}`;
    }

    hideStatus() {
        this.elements.statusBox.className = 'status-box';
    }

    addLog(message, type = 'info') {
        this.elements.logOutput.classList.add('active');
        const logLine = document.createElement('div');
        logLine.className = `log-line ${type}`;
        logLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.elements.logOutput.appendChild(logLine);
        this.elements.logOutput.scrollTop = this.elements.logOutput.scrollHeight;
    }

    clearLog() {
        this.elements.logOutput.innerHTML = '';
    }

    updateProgress(percent) {
        this.elements.progressBar.classList.add('active');
        this.elements.progressFill.style.width = `${percent}%`;
    }

    resetProgress() {
        this.elements.progressBar.classList.remove('active');
        this.elements.progressFill.style.width = '0%';
    }

    showFolderInfo(folderName, folderPath) {
        this.elements.folderNameEl.textContent = folderName;
        this.elements.folderPathEl.textContent = folderPath;
        this.elements.folderInfoBox.classList.add('active');
    }

    hideFolderInfo() {
        this.elements.folderInfoBox.classList.remove('active');
        this.elements.folderNameEl.textContent = '-';
        this.elements.folderPathEl.textContent = '-';
    }

    updateCounter(current, total) {
        this.elements.statsBox.style.display = 'flex';
        this.elements.downloadCounter.textContent = `${current} / ${total}`;
    }

    setRunningState(isRunning) {
        this.elements.startBtn.disabled = isRunning;
        this.elements.stopBtn.disabled = !isRunning;
        this.elements.resetBtn.disabled = isRunning;
    }

    setResettingState(isResetting) {
        this.elements.resetBtn.disabled = isResetting;
    }
}

// Initialize Controller
const ui = new UiController();

// Form Submission
ui.elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const config = ui.getConfig();

    ui.setRunningState(true);
    ui.clearLog();
    ui.resetProgress();
    ui.hideFolderInfo();
    ui.updateCounter(0, config.maxCvCount);
    ui.showStatus('Starting download process...', 'info');
    ui.addLog('Initializing automation...', 'info');

    try {
        const result = await window.electronAPI.startDownload(config);

        if (result.success) {
            const { folderName, folderPath, totalDownloaded } = result.result || {};

            if (folderName) ui.showFolderInfo(folderName, folderPath || '');

            const successMsg = `Download completed successfully! Total CVs downloaded: ${totalDownloaded || 0}`;
            ui.showStatus(successMsg, 'success');
            ui.addLog(successMsg, 'success');

            if (folderName) ui.addLog(`CVs saved to folder: ${folderName}`, 'success');

        } else {
            ui.showStatus(`Error: ${result.error}`, 'error');
            ui.addLog(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        ui.showStatus(`Unexpected error: ${error.message}`, 'error');
        ui.addLog(`Unexpected error: ${error.message}`, 'error');
    } finally {
        ui.setRunningState(false);
        ui.updateProgress(100);
        ui.elements.stopBtn.textContent = 'Stop'; // Reset stop button text
    }
});

// Stop Button
ui.elements.stopBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to stop the download?')) return;

    ui.elements.stopBtn.disabled = true;
    ui.elements.stopBtn.textContent = 'Stopping...';
    ui.showStatus('Stopping download process... Please wait for the current action to complete.', 'warning');
    ui.addLog('Stopping download... (Waiting for current action to finish)', 'warning');

    try {
        await window.electronAPI.stopDownload();
    } catch (error) {
        ui.addLog(`Error stopping: ${error.message}`, 'error');
        // If error, revert button state (though submit handler will likely handle it)
        ui.elements.stopBtn.textContent = 'Stop';
    }
});

// Reset Button
ui.elements.resetBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset the session? This will require you to log in again.')) return;

    ui.setResettingState(true);
    ui.showStatus('Resetting session...', 'info');
    ui.addLog('Deleting session data...', 'info');

    try {
        const result = await window.electronAPI.resetSession();
        if (result.success) {
            ui.showStatus('Session reset successfully. Please log in again on next download.', 'success');
            ui.addLog('Session data deleted successfully', 'success');
        } else {
            ui.showStatus(`Error resetting session: ${result.error}`, 'error');
            ui.addLog(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        ui.showStatus(`Unexpected error: ${error.message}`, 'error');
        ui.addLog(`Unexpected error: ${error.message}`, 'error');
    } finally {
        ui.setResettingState(false);
    }
});

// Listen for progress
window.electronAPI.onDownloadProgress((data) => {
    if (data.message) ui.addLog(data.message, data.type || 'info');
    if (data.progress !== undefined) ui.updateProgress(data.progress);
    if (data.status) ui.showStatus(data.status, data.statusType || 'info');
    if (data.folderName) ui.showFolderInfo(data.folderName, data.folderPath || '');
    if (data.currentCount !== undefined && data.totalCount !== undefined) {
        ui.updateCounter(data.currentCount, data.totalCount);
    }
});

// Check Session on Load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const result = await window.electronAPI.checkSession();
        if (result.exists) {
            ui.addLog('Existing session found. You may skip login if already authenticated.', 'info');
        } else {
            ui.addLog('No existing session. You will be prompted to log in.', 'warning');
        }
    } catch (error) {
        ui.addLog('Could not check session status', 'warning');
    }
});
