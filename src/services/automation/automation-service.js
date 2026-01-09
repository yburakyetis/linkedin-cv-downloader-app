/**
 * Automation Service
 * Facade that orchestrates the entire download process.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { SELECTORS, TIMEOUTS, PATHS } = require('../../config/constants');
const Logger = require('../../utils/logger');
const BrowserManager = require('./browser-manager');
const PaginationManager = require('./pagination-manager');
const ApplicantProcessor = require('./applicant-processor');

class AutomationService {
    constructor() {
        this.browserManager = null;
        this.processor = null;
        this.pagination = null;
        this.stopped = false;
    }

    /**
     * Main entry point to start the download process.
     * @param {object} config 
     * @param {function} progressCallback 
     */
    async startDownload(config, progressCallback) {
        this.stopped = false;
        const userDataPath = path.join(process.cwd(), PATHS.USER_DATA);

        try {
            // 1. Launch Browser
            progressCallback({ message: 'Launching browser...', type: 'info' });
            this.browserManager = new BrowserManager(userDataPath);
            const { page } = await this.browserManager.launch();

            // 2. Check Session
            progressCallback({ message: 'Checking session status...', type: 'info' });
            const isAuthenticated = await this.checkLogin(page, progressCallback);

            if (!isAuthenticated) {
                // checkLogin handles the wait/manual login logic. 
                // If we are here and still not authenticated (e.g. user closed window), we should probably stop.
                // But checkLogin logic below waits for manual login.
            }

            // 3. Navigate to Applicants Page
            progressCallback({ message: `Navigating to applicants page: ${config.applicantsUrl}`, type: 'info' });
            await page.goto(config.applicantsUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE_APPLICANTS });

            try {
                await page.waitForSelector(SELECTORS.APPLICATION_LIST, { timeout: TIMEOUTS.APPLICANTS_LIST_VISIBLE, state: 'visible' });
            } catch (e) {
                Logger.warn('Application list selector not immediately visible, continuing anyway.');
            }

            // 4. Create Download Folder
            const folderInfo = await this.setupDownloadFolder(page, config.applicantsUrl, progressCallback);

            // 5. Initialize Components
            this.processor = new ApplicantProcessor(page, config, progressCallback, folderInfo.folderPath);
            this.pagination = new PaginationManager(page, progressCallback);

            // 6. Navigate to Start Page (if needed)
            if (config.startPage > 1) {
                await this.pagination.navigateToPage(config.startPage);
            }

            // 7. Start Processing Loop
            progressCallback({
                message: 'Starting CV download process...',
                status: `Processing applicants... (CVs will be saved to: ${folderInfo.folderName})`,
                folderName: folderInfo.folderName,
                folderPath: folderInfo.folderPath
            });

            await this.runProcessingLoop();

            // 8. Cleanup and Report
            await this.browserManager.close();

            const result = {
                totalDownloaded: this.processor.downloadCount,
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
                status: 'Waiting for manual authentication...',
                statusType: 'warning'
            });

            await page.goto('https://www.linkedin.com/login');

            // Wait for manual login
            await page.waitForTimeout(TIMEOUTS.MANUAL_LOGIN_WAIT);

            if (!page.url().includes('/login')) {
                progressCallback({ message: 'Session state saved successfully', type: 'success' });
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
                jobTitle = rawTitle.trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ');
                progressCallback({ message: `Found Job Title: ${jobTitle}`, type: 'info' });
            }
        } catch (err) {
            Logger.warn('Could not extract job title', err);
        }

        // Extract Job ID
        let jobId = 'Unknown';
        const urlMatch = applicantsUrl.match(/\/jobs\/(\d+)\//);
        if (urlMatch) jobId = urlMatch[1];

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

        return { folderName, folderPath, baseDir };
    }

    async runProcessingLoop() {
        do {
            if (this.stopped) break;
            await this.processor.processCurrentPage();
            if (this.stopped) break;

            const hasNext = await this.pagination.isNextPageAvailable();
            if (hasNext) {
                const success = await this.pagination.switchToNextPage();
                if (!success) break;
            } else {
                break;
            }
        } while (!this.stopped);
    }

    stop() {
        this.stopped = true;
        if (this.processor) this.processor.stop();
    }
}

module.exports = new AutomationService();
