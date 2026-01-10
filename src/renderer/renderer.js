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
            pauseBtn: document.getElementById('pauseBtn'), // Added
            resetBtn: document.getElementById('resetBtn'),
            statusBox: document.getElementById('statusBox'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            logOutput: document.getElementById('logOutput'),
            folderInfoBox: document.getElementById('folderInfoBox'),
            folderName: document.getElementById('folderName'), // Renamed from folderNameEl
            folderPath: document.getElementById('folderPath'), // Renamed from folderPathEl
            statsBox: document.getElementById('statsBox'),
            downloadCounter: document.getElementById('downloadCounter'),
            // Inputs
            urlInput: document.getElementById('applicantsUrl'), // Renamed from applicantsUrl
            maxCvCount: document.getElementById('maxCvCount'),
            minWait: document.getElementById('minWait'),
            maxWait: document.getElementById('maxWait'),
            startPage: document.getElementById('startPage'),
            // Resume Session elements
            resumeBanner: document.getElementById('resumeBanner'), // Added
            resumeSessionBtn: document.getElementById('resumeSessionBtn'), // Added
            resumeSessionBtn: document.getElementById('resumeSessionBtn'), // Added
            discardSessionBtn: document.getElementById('discardSessionBtn'), // Added
            // Stealth Inputs
            breakInterval: document.getElementById('breakInterval'),
            breakDurationMin: document.getElementById('breakDurationMin'),
            breakDurationMax: document.getElementById('breakDurationMax')
        };
    }

    getConfig() {
        return {
            applicantsUrl: this.elements.urlInput.value,
            maxCvCount: parseInt(this.elements.maxCvCount.value),
            minWait: parseInt(this.elements.minWait.value),
            maxWait: parseInt(this.elements.maxWait.value),
            startPage: parseInt(this.elements.startPage.value) || 1,
            // Stealth Config
            breakInterval: parseInt(this.elements.breakInterval.value),
            breakDurationMin: parseInt(this.elements.breakDurationMin.value),
            breakDurationMax: parseInt(this.elements.breakDurationMax.value)
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

        // Check if user is near the bottom (within 50px)
        const output = this.elements.logOutput;
        const isNearBottom = output.scrollHeight - output.scrollTop - output.clientHeight < 50;

        const logLine = document.createElement('div');
        logLine.className = `log-line ${type}`;
        logLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.elements.logOutput.appendChild(logLine);

        // Auto-scroll only if they were already at the bottom
        if (isNearBottom) {
            output.scrollTop = output.scrollHeight;
        }
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
        this.elements.folderName.textContent = folderName; // Updated
        this.elements.folderPath.textContent = folderPath; // Updated
        this.elements.folderInfoBox.classList.add('active');
    }

    hideFolderInfo() {
        this.elements.folderInfoBox.classList.remove('active');
        this.elements.folderName.textContent = '-'; // Updated
        this.elements.folderPath.textContent = '-'; // Updated
    }

    updateCounter(current, total) {
        this.elements.statsBox.style.display = 'flex';
        this.elements.downloadCounter.textContent = `${current} / ${total}`;
    }

    setRunningState(isRunning) {
        this.elements.startBtn.disabled = isRunning;
        this.elements.stopBtn.disabled = !isRunning;
        this.elements.resetBtn.disabled = isRunning;
        this.elements.urlInput.disabled = isRunning;

        // Pause always starts disabled, waits for 'processingStarted' event
        this.elements.pauseBtn.disabled = true;

        if (!isRunning) {
            // Reset Pause button to default state
            this.elements.pauseBtn.textContent = 'Pause';
            this.elements.pauseBtn.style.backgroundColor = '#ecc94b';
            this.elements.pauseBtn.style.color = '#744210';
            window.isPaused = false;
        }
    }

    setResettingState(isResetting) {
        this.elements.resetBtn.disabled = isResetting;
    }
}

// Initialize Controller
const ui = new UiController();
window.isPaused = false;

// Form Submission
async function startDownloadProcess(isResume = false) {
    const config = ui.getConfig();
    config.resume = isResume; // Add resume flag to config

    if (!config.applicantsUrl) {
        ui.showStatus('Please enter a valid URL', 'error');
        return;
    }

    ui.setRunningState(true);
    ui.clearLog();
    ui.resetProgress();
    ui.hideFolderInfo();
    ui.updateCounter(0, config.maxCvCount);
    ui.showStatus(isResume ? 'Resuming previous session...' : 'Starting download process...', 'info');
    ui.addLog(isResume ? 'Resuming automation...' : 'Initializing automation...', 'info');

    try {
        const result = await window.electronAPI.startDownload(config);

        if (result.success) {
            const { folderName, folderPath, totalDownloaded, failedCount, failedApplicants } = result.result || {};

            if (folderName) ui.showFolderInfo(folderName, folderPath || '');

            const successMsg = `Download completed! Success: ${totalDownloaded || 0}, Failed: ${failedCount || 0}`;
            ui.showStatus(successMsg, 'success');
            ui.addLog(successMsg, 'success');

            if (folderName) ui.addLog(`CVs saved to folder: ${folderName}`, 'success');

            // Show Report
            let report = `Process Completed!\n\nSuccessful Downloads: ${totalDownloaded || 0}\nFailed Downloads: ${failedCount || 0}`;

            if (failedCount > 0 && failedApplicants && failedApplicants.length > 0) {
                report += `\n\nFailed Applicants:\n` + failedApplicants.map(f => `- ${f.name} (Page: ${f.page || '?'}) - ${f.reason}`).join('\n');
            }

            alert(report);

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
}

ui.elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await startDownloadProcess(false);
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

// Logout / Reset Button
ui.elements.resetBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to log out and clear all session data? You will need to log in again next time.')) return;

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

// Pause/Resume Toggle
ui.elements.pauseBtn.addEventListener('click', async () => {
    if (!window.isPaused) {
        await window.electronAPI.pauseDownload();
        window.isPaused = true;
        ui.elements.pauseBtn.textContent = 'Continue';
        ui.elements.pauseBtn.style.backgroundColor = '#48bb78'; // Green
        ui.elements.pauseBtn.style.color = 'white';
        ui.showStatus('Process paused. Click Continue to resume.', 'warning');
        ui.addLog('Requesting pause...', 'warning');
    } else {
        await window.electronAPI.resumeDownload();
        window.isPaused = false;
        ui.elements.pauseBtn.textContent = 'Pause';
        ui.elements.pauseBtn.style.backgroundColor = '#ecc94b'; // Yellow
        ui.elements.pauseBtn.style.color = '#744210';
        ui.showStatus('Resuming process...', 'info');
        ui.addLog('Resuming process...', 'info');
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
    if (data.processingStarted) {
        ui.elements.pauseBtn.disabled = false;
    }
});

// Check Session & Load Defaults on Load
window.addEventListener('DOMContentLoaded', async () => {
    // Load Defaults
    try {
        const defaults = window.electronAPI.defaults;
        if (defaults) {
            if (ui.elements.minWait) ui.elements.minWait.value = defaults.MIN_WAIT_SECONDS;
            if (ui.elements.maxWait) ui.elements.maxWait.value = defaults.MAX_WAIT_SECONDS;
            if (ui.elements.maxCvCount) ui.elements.maxCvCount.value = defaults.MAX_CV_COUNT;

            // Stealth Defaults
            if (ui.elements.breakInterval) ui.elements.breakInterval.value = defaults.BREAK_INTERVAL;
            if (ui.elements.breakDurationMin) ui.elements.breakDurationMin.value = defaults.BREAK_DURATION_MIN;
            if (ui.elements.breakDurationMax) ui.elements.breakDurationMax.value = defaults.BREAK_DURATION_MAX;
            // can set other defaults if needed
        }
    } catch (error) {
        console.error('Failed to load defaults', error);
    }

    try {
        const result = await window.electronAPI.checkSession();
        if (result.exists) {
            ui.elements.statusBox.textContent = 'Existing session found. You may skip login if already authenticated.'; // Simple init status
            // ui.addLog('Existing session found. You may skip login if already authenticated.', 'info');
        } else {
            // ui.addLog('No existing session. You will be prompted to log in.', 'warning');
        }
    } catch (error) {
        ui.addLog('Could not check session status', 'warning');
    }
});
