/**
 * Renderer Process
 * Handles UI interactions and IPC communication.
 */

class UiController {
    constructor() {
        this.elements = {
            form: document.getElementById('downloadForm'),
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            resetBtn: document.getElementById('resetBtn'),
            resetBtn: document.getElementById('resetBtn'),
            // statusBox removed
            logOutput: document.getElementById('logOutput'),
            downloadLogsBtn: document.getElementById('downloadLogsBtn'),
            folderInfoBox: document.getElementById('folderInfoBox'),
            folderName: document.getElementById('folderName'),
            folderPath: document.getElementById('folderPath'),

            // Dashboard Elements
            dashboardGrid: document.getElementById('dashboardGrid'),
            statSuccess: document.getElementById('statSuccess'),
            statFailed: document.getElementById('statFailed'),
            failedListContainer: document.getElementById('failedListContainer'),
            failedList: document.getElementById('failedList'),

            // Inputs
            urlInput: document.getElementById('applicantsUrl'),
            maxCvCount: document.getElementById('maxCvCount'),
            minWait: document.getElementById('minWait'),
            maxWait: document.getElementById('maxWait'),
            startPage: document.getElementById('startPage'),
            // Resume Session elements
            resumeBanner: document.getElementById('resumeBanner'),
            resumeSessionBtn: document.getElementById('resumeSessionBtn'),
            discardSessionBtn: document.getElementById('discardSessionBtn'),
            // Stealth Inputs
            breakInterval: document.getElementById('breakInterval'),
            breakDurationMin: document.getElementById('breakDurationMin'),
            breakDurationMax: document.getElementById('breakDurationMax'),
            pageWaitMin: document.getElementById('pageWaitMin'),
            pageWaitMax: document.getElementById('pageWaitMax')
        };
    }

    getConfig() {
        return {
            applicantsUrl: this.elements.urlInput.value,
            maxCvCount: parseInt(this.elements.maxCvCount.value),
            minWait: parseInt(this.elements.minWait.value),
            maxWait: parseInt(this.elements.maxWait.value),
            startPage: parseInt(this.elements.startPage.value) || 1,
            breakInterval: parseInt(this.elements.breakInterval.value),
            breakDurationMin: parseInt(this.elements.breakDurationMin.value),
            breakDurationMax: parseInt(this.elements.breakDurationMax.value),
            pageWaitMin: parseInt(this.elements.pageWaitMin.value),
            pageWaitMax: parseInt(this.elements.pageWaitMax.value)
        };
    }

    showStatus(message, type = 'info') {
        // Disabled per user request (UI simplification)
        // this.elements.statusBox.textContent = message;
        // this.elements.statusBox.className = `status-box active ${type}`;
    }

    hideStatus() {
        // this.elements.statusBox.className = 'status-box';
    }

    addLog(message, type = 'info') {
        this.elements.logOutput.classList.add('active');
        const output = this.elements.logOutput;
        const isNearBottom = output.scrollHeight - output.scrollTop - output.clientHeight < 50;

        const logLine = document.createElement('div');
        logLine.className = `log-line ${type}`;
        logLine.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.elements.logOutput.appendChild(logLine);

        // Performance: Limit log history to last 300 lines
        if (output.children.length > 300) {
            output.removeChild(output.firstElementChild);
        }

        if (isNearBottom) {
            output.scrollTop = output.scrollHeight;
        }
    }

    clearLog() {
        this.elements.logOutput.innerHTML = '';
    }

    downloadLogs() {
        const logLines = this.elements.logOutput.querySelectorAll('.log-line');
        if (logLines.length === 0) {
            this.showStatus('No logs to download', 'warning');
            return;
        }

        let logContent = 'LinkedIn CV Downloader - Log Export\n';
        logContent += `Export Date: ${new Date().toLocaleString()}\n`;
        logContent += '----------------------------------------\n\n';

        logLines.forEach(line => {
            logContent += line.textContent + '\n';
        });

        try {
            const blob = new Blob([logContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `log_export_${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.addLog('Logs downloaded successfully.', 'success');
        } catch (e) {
            this.showStatus('Failed to download logs', 'error');
            this.addLog(`Log download error: ${e.message}`, 'error');
        }
    }

    // Dashboard Methods
    resetDashboard() {
        this.elements.dashboardGrid.style.display = 'grid';
        this.elements.statSuccess.textContent = '0';
        this.elements.statFailed.textContent = '0';
        this.elements.failedListContainer.style.display = 'none';
        this.elements.failedList.innerHTML = '';
    }

    updateDashboard(stats) {
        if (!stats) return;
        this.elements.dashboardGrid.style.display = 'grid';
        this.elements.statSuccess.textContent = stats.success || 0;
        this.elements.statFailed.textContent = stats.failed || 0;
    }

    addFailureLog(name, reason, page) {
        this.elements.failedListContainer.style.display = 'block';
        const item = document.createElement('div');
        item.className = 'failed-item';

        const pageText = (page && page !== '?') ? ` (Page: ${page})` : '';
        item.innerHTML = `<span>❌ ${name}${pageText}</span><span class="failed-reason">${reason}</span>`;

        this.elements.failedList.prepend(item);
    }

    showFolderInfo(folderName, folderPath) {
        // this.elements.folderName.textContent = folderName; // Redundant
        this.elements.folderPath.textContent = folderPath;
        this.elements.folderInfoBox.classList.add('active');
    }

    hideFolderInfo() {
        this.elements.folderInfoBox.classList.remove('active');
        this.elements.folderName.textContent = '-';
        this.elements.folderPath.textContent = '-';
    }

    setRunningState(isRunning) {
        this.elements.startBtn.disabled = isRunning;
        this.elements.stopBtn.disabled = !isRunning;
        this.elements.resetBtn.disabled = isRunning;
        this.elements.urlInput.disabled = isRunning;
        this.elements.pauseBtn.disabled = true;

        if (!isRunning) {
            this.elements.pauseBtn.textContent = 'Pause';
            this.elements.pauseBtn.style.backgroundColor = '#ecc94b';
            this.elements.pauseBtn.style.color = '#744210';
            window.isPaused = false;
        }
    }

    setResettingState(isResetting) {
        this.elements.resetBtn.disabled = isResetting;
    }

    showReportModal(data) {
        const modal = document.getElementById('reportModal');
        const body = document.getElementById('reportBody');
        const closeBtn = document.getElementById('closeReportBtn');

        // Build HTML
        let html = `
            <div class="report-stat">${this.t('stat.success')}: ${data.totalDownloaded || 0}</div>
            <div class="report-stat">${this.t('stat.failed')}: ${data.failedCount || 0}</div>
        `;

        if (data.failedApplicants && data.failedApplicants.length > 0) {
            html += `
                <div class="report-list">
                    <strong>${this.t('header.failedList')}:</strong>
                    <ul>
                        ${data.failedApplicants.map(f => `<li>${f.name} (Page: ${f.page || '?'}) - ${f.reason}</li>`).join('')}
                    </ul>
                </div>
            `;
        } else {
            html += `<div style="margin-top:15px; color:green;">${this.t('msg.noFailures')}</div>`;
        }

        body.innerHTML = html;
        modal.style.display = 'flex';

        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
}

const ui = new UiController();
window.isPaused = false;

async function startDownloadProcess(isResume = false) {
    const config = ui.getConfig();
    config.resume = isResume;

    if (!config.applicantsUrl) {
        ui.showStatus('Please enter a valid URL', 'error');
        return;
    }

    ui.setRunningState(true);
    ui.clearLog();
    ui.resetDashboard(); // Reset new dashboard
    ui.hideFolderInfo();
    ui.showStatus(isResume ? ui.t('msg.resuming') : ui.t('msg.starting'), 'info');
    ui.addLog(isResume ? 'Resuming automation...' : 'Initializing automation...', 'info');

    try {
        const result = await window.electronAPI.startDownload(config);

        if (result.success) {
            const { folderName, folderPath, totalDownloaded, failedCount, failedApplicants } = result.result || {};
            if (folderName) ui.showFolderInfo(folderName, folderPath || '');

            const successMsg = `${ui.t('msg.completed')} ${ui.t('stat.success')}: ${totalDownloaded || 0}, ${ui.t('stat.failed')}: ${failedCount || 0}`;
            ui.showStatus(successMsg, 'success');
            ui.addLog(successMsg, 'success');
            if (folderName) ui.addLog(`CVs saved to folder: ${folderName}`, 'success');

            // Custom Modal Report
            if (ui.showReportModal) {
                ui.showReportModal({
                    totalDownloaded,
                    failedCount,
                    failedApplicants
                });
            } else {
                // Fallback if modal not ready
                alert(`${ui.t('msg.completed')} Success: ${totalDownloaded}, Failed: ${failedCount}`);
            }

        } else {
            ui.showStatus(`${ui.t('msg.error')} ${result.error}`, 'error');
            ui.addLog(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        ui.showStatus(`Unexpected error: ${error.message}`, 'error');
        ui.addLog(`Unexpected error: ${error.message}`, 'error');
    } finally {
        ui.setRunningState(false);
        ui.elements.stopBtn.textContent = ui.t('btn.stop');
    }
}

// Event Listeners
// Event Listeners linked in DOMContentLoaded
// ui.elements.form.addEventListener('submit', async (e) => { ... }); moved down

ui.elements.stopBtn.addEventListener('click', async () => {
    if (!confirm(ui.t('prompt.stop'))) return;
    ui.elements.stopBtn.disabled = true;
    ui.elements.stopBtn.textContent = ui.t('msg.stopping');
    ui.showStatus(ui.t('msg.stopping'), 'warning');
    ui.addLog('Stopping download...', 'warning');
    try {
        await window.electronAPI.stopDownload();
    } catch (error) {
        ui.addLog(`Error stopping: ${error.message}`, 'error');
        ui.elements.stopBtn.textContent = ui.t('btn.stop');
    }
});

ui.elements.downloadLogsBtn.addEventListener('click', () => {
    ui.downloadLogs();
});

ui.elements.resetBtn.addEventListener('click', async () => {
    if (!confirm(ui.t('prompt.reset'))) return;
    ui.setResettingState(true);
    ui.showStatus('Resetting session...', 'info');
    try {
        const result = await window.electronAPI.resetSession();
        if (result.success) {
            ui.showStatus('Session reset successfully.', 'success');
        } else {
            ui.showStatus(`Error resetting session: ${result.error}`, 'error');
        }
    } catch (error) {
        ui.showStatus(`Unexpected error: ${error.message}`, 'error');
    } finally {
        ui.setResettingState(false);
    }
});

ui.elements.pauseBtn.addEventListener('click', async () => {
    if (!window.isPaused) {
        await window.electronAPI.pauseDownload();
        window.isPaused = true;
        ui.elements.pauseBtn.textContent = ui.t('btn.continue');
        ui.elements.pauseBtn.style.backgroundColor = '#48bb78';
        ui.showStatus(ui.t('msg.paused'), 'warning');
    } else {
        await window.electronAPI.resumeDownload();
        window.isPaused = false;
        ui.elements.pauseBtn.textContent = ui.t('btn.pause');
        ui.elements.pauseBtn.style.backgroundColor = '#ecc94b';
        ui.showStatus(ui.t('msg.resuming'), 'info');
    }
});

// IPC Listeners
window.electronAPI.onDownloadProgress((data) => {
    if (data.message) ui.addLog(data.message, data.type || 'info');
    if (data.status) ui.showStatus(data.status, data.statusType || 'info');
    if (data.folderName) ui.showFolderInfo(data.folderName, data.folderPath || '');

    // Stats Update
    if (data.stats) {
        ui.updateDashboard(data.stats);
    }

    // Failure Log Update
    if (data.failure) {
        ui.addFailureLog(data.failure.name, data.failure.reason);
    }

    if (data.processingStarted) {
        ui.elements.pauseBtn.disabled = false;
    }
});

// Init
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Language Init
    const langSwitch = document.getElementById('langSwitch');
    const langItems = document.querySelectorAll('.lang-item');
    window.currentLang = 'tr'; // Default

    function t(key) {
        if (window.locales && window.locales[window.currentLang] && window.locales[window.currentLang][key]) {
            return window.locales[window.currentLang][key];
        }
        return key;
    }

    // Expose t to UI Controller
    ui.t = t;

    function setLanguage(lang) {
        window.currentLang = lang;

        // Update Switch UI
        langItems.forEach(item => {
            if (item.dataset.lang === lang) item.classList.add('active');
            else item.classList.remove('active');
        });

        // Update Text Elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = t(key);
        });

        // Update Tooltips
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = t(key);
        });

        // Update Placeholders
        const urlInput = document.getElementById('applicantsUrl');
        if (urlInput) urlInput.placeholder = t('placeholder.url');

        // Update Buttons (Dynamic text might override, but good for init)
        const stopBtn = document.getElementById('stopBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        if (!stopBtn.disabled) stopBtn.textContent = t('btn.stop');
        if (pauseBtn.textContent.includes('Pause') || pauseBtn.textContent.includes('Duraklat')) {
            pauseBtn.textContent = window.isPaused ? t('btn.continue') : t('btn.pause');
        }
    }

    // Click Handlers
    langItems.forEach(item => {
        item.addEventListener('click', () => {
            setLanguage(item.dataset.lang);
        });
    });

    // Initial Set
    setLanguage('tr');


    try {
        const defaults = window.electronAPI.defaults;
        if (defaults) {
            if (ui.elements.minWait) ui.elements.minWait.value = defaults.MIN_WAIT_SECONDS;
            if (ui.elements.maxWait) ui.elements.maxWait.value = defaults.MAX_WAIT_SECONDS;
            if (ui.elements.maxCvCount) ui.elements.maxCvCount.value = defaults.MAX_CV_COUNT;
            if (ui.elements.breakInterval) ui.elements.breakInterval.value = defaults.BREAK_INTERVAL;
            if (ui.elements.breakDurationMin) ui.elements.breakDurationMin.value = defaults.BREAK_DURATION_MIN;
            if (ui.elements.breakDurationMax) ui.elements.breakDurationMax.value = defaults.BREAK_DURATION_MAX;
            if (ui.elements.pageWaitMin) ui.elements.pageWaitMin.value = defaults.PAGE_WAIT_MIN;
            if (ui.elements.pageWaitMax) ui.elements.pageWaitMax.value = defaults.PAGE_WAIT_MAX;
        }
    } catch (e) {
        console.error('Failed to load defaults', e);
    }

    // Check for existing session
    try {
        const result = await window.electronAPI.checkSession();
        if (result.exists) {
            window.hasActiveSession = true;
            document.getElementById('resumeBanner').style.display = 'block';
        }
    } catch (e) { }

    // Start Button Logic (Auto-resume if session exists)
    // Start Button Logic
    ui.elements.form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let shouldResume = false;

        if (window.hasActiveSession) {
            // Ask user: Resume or Start Fresh?
            const userChoice = confirm(ui.t('prompt.resume'));
            shouldResume = userChoice; // True = Resume, False = New Session
        }

        await startDownloadProcess(shouldResume);

        // If user chose New Session (shouldResume=false), update UI state
        if (!shouldResume && window.hasActiveSession) {
            window.hasActiveSession = false;
            document.getElementById('resumeBanner').style.display = 'none';
        }
    });

    // Discard Session Logic
    ui.elements.discardSessionBtn.addEventListener('click', async () => {
        if (!confirm(ui.t('prompt.reset'))) return;
        ui.setResettingState(true);
        try {
            const result = await window.electronAPI.resetSession();
            if (result.success) {
                ui.showStatus('Session discarded. Ready for new login.', 'success');
                window.hasActiveSession = false;
                document.getElementById('resumeBanner').style.display = 'none';
            } else {
                ui.showStatus(`Error discarding: ${result.error}`, 'error');
            }
        } catch (error) {
            ui.showStatus(`Error: ${error.message}`, 'error');
        } finally {
            ui.setResettingState(false);
        }
    });

    // Theme Toggle Logic
    const themeToggle = document.getElementById('themeToggle');
    const themeOptions = themeToggle.querySelectorAll('span');

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('appTheme', theme);

        themeOptions.forEach(option => {
            if (option.dataset.theme === theme) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            setTheme(option.dataset.theme);
        });
    });

    // Initialize theme from localStorage or default to light
    const savedTheme = localStorage.getItem('appTheme') || 'light';
    setTheme(savedTheme);
});
