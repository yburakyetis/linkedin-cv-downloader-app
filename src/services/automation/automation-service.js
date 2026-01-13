/**
 * Automation Service
 * Facade that orchestrates the entire download process.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { SELECTORS, TIMEOUTS, PATHS, DEFAULTS } = require('../../config/constants');
const Logger = require('../../utils/logger');
const BrowserManager = require('./browser-manager');
const PaginationManager = require('./pagination-manager');
const ApplicantProcessor = require('./applicant-processor');
const StateManager = require('../state-manager');

const { app } = require('electron');

class AutomationService {
    constructor() {
        this.browserManager = null;
        this.processor = null;
        this.pagination = null;
        this.stopped = false;
    }

    async startDownload(config, progressCallback) {
        this.stopped = false;
        const userDataPath = app.getPath('userData');

        try {
            progressCallback({ message: 'Launching browser...', type: 'info' });
            this.browserManager = new BrowserManager(userDataPath);
            const { page } = await this.browserManager.launch({ headless: config.headless });

            progressCallback({ message: 'Checking session status...', type: 'info' });
            const isAuthenticated = await this.checkLogin(page, progressCallback);

            if (!isAuthenticated) {
                // checkLogin waits for manual login, so if we return false here, 
                // it implies the user closed the window or authentication failed.
            }

            progressCallback({ message: `Navigating to applicants page: ${config.applicantsUrl}`, type: 'info' });

            // Sanitize URL: ensure it has https:// protocol
            let sanitizedUrl = config.applicantsUrl;
            if (!sanitizedUrl.startsWith('http://') && !sanitizedUrl.startsWith('https://')) {
                sanitizedUrl = 'https://' + sanitizedUrl;
                Logger.info(`Added protocol to URL: ${sanitizedUrl}`);
            }

            try {
                await page.goto(sanitizedUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE_APPLICANTS });
            } catch (error) {
                if (this.stopped || error.message.includes('ERR_ABORTED') || error.message.includes('Timeout')) {
                    Logger.info('Navigation interrupted by user stop or timeout. Cleaning up...');
                    if (this.browserManager) await this.browserManager.close();
                    return { totalDownloaded: 0, failedCount: 0, stopped: true };
                }
                throw error;
            }

            try {
                await page.waitForSelector(SELECTORS.APPLICATION_LIST, { timeout: TIMEOUTS.APPLICANTS_LIST_VISIBLE, state: 'visible' });
            } catch (e) {
                Logger.warn('Application list selector not immediately visible, continuing anyway.');
            }
            // 4. Create Download Folder
            // If resuming, use the existing folder from state if available, otherwise create/find
            let folderInfo;
            let resumeState = null;

            if (config.resume) {
                resumeState = await StateManager.loadState();
                if (resumeState && resumeState.folderPath) {
                    folderInfo = {
                        folderName: resumeState.folderName,
                        folderPath: resumeState.folderPath,
                        baseDir: path.dirname(resumeState.folderPath)
                    };
                    progressCallback({ message: 'Resuming previous session...', type: 'info' });
                } else {
                    Logger.warn('Resume requested but no valid state found. Starting fresh.');
                }
            }

            if (!folderInfo) {
                folderInfo = await this.setupDownloadFolder(page, config.applicantsUrl, progressCallback);
                // Save initial state
                await StateManager.saveState({
                    folderName: folderInfo.folderName,
                    folderPath: folderInfo.folderPath,
                    applicantsUrl: config.applicantsUrl,
                    processedApplicants: [],
                    startPage: config.startPage,
                    downloadCount: 0,
                    jobTitle: folderInfo.jobTitle
                });
            }

            // 5. Initialize Components
            const procConfig = { ...config, jobTitle: folderInfo.jobTitle || (resumeState ? resumeState.jobTitle : 'Unknown Position') };
            this.processor = new ApplicantProcessor(page, procConfig, progressCallback, folderInfo.folderPath);
            this.pagination = new PaginationManager(page, procConfig, progressCallback);

            // Hydrate processor with resumed state
            if (resumeState && resumeState.processedApplicants) {
                this.processor.hydrateState(resumeState.processedApplicants, resumeState.downloadCount || 0);
            }

            // 6. Navigate to Start Page (if needed)
            // If resuming, prefer the saved lastPage over config.startPage
            let targetPage = config.startPage;
            if (resumeState && resumeState.lastPage) {
                targetPage = resumeState.lastPage;
                Logger.info(`Resuming from saved page: ${targetPage}`);
            }

            if (targetPage > 1) {
                await this.pagination.navigateToPage(targetPage);
            }

            progressCallback({
                message: 'Starting CV download process...',
                status: `Processing applicants...`,
                folderName: folderInfo.folderName,
                folderPath: folderInfo.folderPath
            });

            await this.runProcessingLoop(progressCallback);

            await this.browserManager.close();

            const result = {
                totalDownloaded: this.processor.downloadCount,
                failedCount: this.processor.failedApplicants.length,
                failedApplicants: this.processor.failedApplicants,
                folderName: folderInfo.folderName,
                folderPath: folderInfo.folderPath
            };

            progressCallback({
                message: 'All processing completed successfully',
                type: 'success',
                status: `Completed! Downloaded ${result.totalDownloaded} CVs.`,
                statusType: 'success',
                ...result
            });

            return result;

        } catch (error) {
            Logger.error('Fatal error in automation service', error);
            if (this.browserManager) await this.browserManager.close();
            throw error;
        }
    }

    async checkLogin(page, progressCallback) {
        await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { });

        const currentUrl = page.url();
        const needsLogin = currentUrl.includes('/login') || currentUrl.includes('/uas/login');

        if (needsLogin) {
            progressCallback({
                message: 'Login required. Please log in to LinkedIn in the browser window.',
                type: 'warning',
                status: 'Waiting for manual authentication (Max 5 mins)...',
                statusType: 'warning'
            });

            await page.goto('https://www.linkedin.com/login');

            // Wait for manual login (Dynamic Polling)
            const startTime = Date.now();
            let loggedIn = false;

            while (Date.now() - startTime < TIMEOUTS.MANUAL_LOGIN_WAIT) {
                const url = page.url();
                if (!url.includes('/login') && !url.includes('/uas/login')) {
                    loggedIn = true;
                    break;
                }
                await page.waitForTimeout(1000);
            }

            if (loggedIn) {
                progressCallback({ message: 'Login detected! Session state saved.', type: 'success' });
                // Give it a moment to settle cookies/redirects
                await page.waitForTimeout(2000);
                return true;
            }
            return false;
        } else {
            progressCallback({ message: 'Using existing session', type: 'info' });
            return true;
        }
    }

    async setupDownloadFolder(page, applicantsUrl, progressCallback) {
        progressCallback({ message: 'Creating download folder...', type: 'info' });

        let jobTitle = null;
        try {
            const titleElement = await page.$(SELECTORS.JOB_TITLE);
            if (titleElement) {
                const rawTitle = await titleElement.innerText();
                // Clean: Remove "Job title" label if present, replace invalid chars, trim
                jobTitle = rawTitle.replace(/^(İş unvanı|Job title)\s*/i, '')
                    .replace(/[\\/:*?"<>|]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                progressCallback({ message: `Found Job Title: ${jobTitle}`, type: 'info' });
            }
        } catch (err) {
            Logger.warn('Could not extract job title', err);
        }

        // Extract Job ID
        let jobId = 'Unknown';
        const urlMatch = applicantsUrl.match(/\/jobs\/(\d+)\//);
        if (urlMatch) jobId = urlMatch[1];

        const now = new Date();

        // Create timestamp in target timezone
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: DEFAULTS.TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const parts = formatter.formatToParts(now);
        const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
        const timestamp = `${map.year}-${map.month}-${map.day}_${map.hour}-${map.minute}`;

        const folderName = jobTitle
            ? `${jobTitle}_${timestamp}`
            : `Job_${jobId}_${timestamp}`;

        const baseDir = path.join(os.homedir(), 'Downloads', PATHS.DOWNLOADS_BASE_DIR);
        const folderPath = path.join(baseDir, folderName);

        // Create directories
        await fs.mkdir(baseDir, { recursive: true });
        await fs.mkdir(folderPath, { recursive: true });

        return { folderName, folderPath, baseDir, jobTitle };
    }

    async runProcessingLoop(progressCallback) {
        progressCallback({ processingStarted: true });

        while (!this.stopped) {
            // Get current page number for logging
            let currentPage = 1;
            try {
                currentPage = await this.pagination.getActivePageNumber();
            } catch (e) { }

            const msg = `Processing applicants on Page ${currentPage}...`;
            Logger.info(msg);
            progressCallback({ message: msg, type: 'info' });

            await this.processor.processCurrentPage();

            if (this.stopped || this.processor.stopped) break;

            const hasNext = await this.pagination.isNextPageAvailable();

            if (hasNext) {
                // Ensure the user knows we are switching
                progressCallback({ message: `Page ${currentPage} complete. Switching to next page...`, type: 'info' });

                const success = await this.pagination.switchToNextPage();
                if (!success) {
                    Logger.warn('Failed to switch to next page despite hasNext=true');
                    break;
                }

                // Optimization: Periodic Memory Cleanup
                // User Request: Reload on every page to ensure clean state and prevent memory leaks.
                const newPage = await this.pagination.getActivePageNumber();

                if (newPage > 1) {
                    const memMsg = `Periodic system cleanup (Page ${newPage}). reloading to free memory...`;
                    Logger.info(memMsg);
                    progressCallback({ message: memMsg, type: 'info' });

                    try {
                        await this.processor.page.reload({ waitUntil: 'domcontentloaded' });
                        await this.processor.page.waitForTimeout(2000); // Settle
                    } catch (e) {
                        Logger.warn('Error during memory cleanup reload', e);
                    }
                }

                // Save new page number
                await StateManager.saveState({ lastPage: newPage });
            } else {
                Logger.info('No next page available. Reached end of applicant list.');
                progressCallback({
                    message: 'No more pages available. Job Complete.',
                    type: 'success',
                    status: 'Job Complete: All pages processed.',
                    statusType: 'success'
                });
                break;
            }
        }
    }

    async stop() {
        this.stopped = true;
        if (this.processor) {
            await this.processor.stop();
        }

        // Give the loop a moment to notice the 'stopped' flag and exit gracefully
        await new Promise(resolve => setTimeout(resolve, 500));

        if (this.browserManager) {
            try {
                await this.browserManager.close();
            } catch (e) {
                // If it's already closed, ignore the error
                if (!e.message.includes('closed')) {
                    Logger.warn('Error closing browser during stop', e);
                }
            }
        }
    }

    async pause() {
        this.paused = true;
        if (this.processor) this.processor.pause();
    }

    async resume() {
        this.paused = false;
        if (this.processor) this.processor.resume();
    }
}

module.exports = new AutomationService();
