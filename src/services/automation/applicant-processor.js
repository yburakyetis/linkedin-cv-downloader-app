/**
 * Applicant Processor
 * Handles processing of individual applicants on a page.
 */

const fs = require('fs').promises;
const path = require('path');
const { SELECTORS, TIMEOUTS } = require('../../config/constants');
const InteractionUtils = require('./interaction-utils');
const Logger = require('../../utils/logger');

class ApplicantProcessor {

    constructor(page, config, progressCallback, downloadDir) {
        this.page = page;
        this.config = config;
        this.progressCallback = progressCallback;
        this.downloadDir = downloadDir;

        this.downloadCount = 0;
        this.stopped = false;
    }

    stop() {
        this.stopped = true;
    }

    async processCurrentPage() {
        const applicants = this.page.locator(SELECTORS.APPLICATION_LIST);
        const count = await applicants.count();

        this.log(`Number of applicants on current page: ${count}`, 'info');

        for (let i = 0; i < count; i++) {
            // Check limits and stop signals
            if (this.downloadCount >= this.config.maxCvCount) {
                this.log(`Maximum CV download limit reached: ${this.config.maxCvCount}`, 'warning');
                return;
            }

            if (this.stopped) {
                this.log('Process stopped by user.', 'warning');
                return;
            }

            try {
                await this.processSingleApplicant(applicants.nth(i));
            } catch (error) {
                Logger.error(`Error processing applicant ${i}`, error);
                // Continue to next applicant even if one fails
            }

            // Post-applicant wait
            await InteractionUtils.randomWait(this.config.minWait, this.config.maxWait);
        }
    }

    async processSingleApplicant(applicantLocator) {
        // Natural scroll to element
        await InteractionUtils.smoothScrollTo(this.page, applicantLocator);
        await InteractionUtils.microPause();

        // Specific move to THIS applicant's locator (not generic list)
        // Previous generic selector caused mouse to go to the FIRST item always.
        // Now it goes exactly to this specific applicant card.
        await InteractionUtils.slowMouseMove(this.page, applicantLocator);

        // Manual click at current mouse position (prevents snap-to-center teleports)
        // We assume slowMouseMove left the cursor over the element.
        // We verify overlap or just click. Safer is page.mouse.click via coordinates, 
        // but simple page.mouse.down/up is good too.
        await this.page.mouse.down();
        await InteractionUtils.microPause();
        await this.page.mouse.up();

        await this.waitForDetailsPanel();
        await this.scrollToDownloadSection();
        await this.tryDownloadCv();
    }

    async waitForDetailsPanel() {
        try {
            await this.page.locator(SELECTORS.DETAILS_PANEL).waitFor({
                timeout: TIMEOUTS.DETAILS_PANEL
            });
        } catch (error) {
            Logger.warn('Details panel timeout');
        }
    }

    async scrollToDownloadSection() {
        const downloadBtn = this.page
            .locator(SELECTORS.DETAILS_PANEL)
            .locator(SELECTORS.DOWNLOAD_BUTTON);

        try {
            await downloadBtn.first().waitFor({
                state: 'attached',
                timeout: TIMEOUTS.DOWNLOAD_BUTTON_ATTACH
            });

            const count = await downloadBtn.count();
            if (count > 0) {
                await downloadBtn.first().scrollIntoViewIfNeeded();
                await InteractionUtils.microPause();
            }
        } catch (error) {
            // Download button might not exist for this applicant, which is fine
        }
    }

    async tryDownloadCv() {
        const downloadBtn = this.page.locator(SELECTORS.DOWNLOAD_BUTTON);

        const count = await downloadBtn.count();
        const isVisible = count > 0 ? await downloadBtn.first().isVisible() : false;

        if (count === 0 || !isVisible) {
            // Silent log or debug log to avoid cluttering UI
            // this.log('No downloadable CV available for this applicant', 'info');
            return;
        }

        try {
            // Ensure download directory exists
            await fs.mkdir(this.downloadDir, { recursive: true });

            // Set download path listener
            const downloadPathPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.DOWNLOAD_EVENT });

            // Slow mouse movement before clicking download
            await InteractionUtils.slowMouseMove(this.page, SELECTORS.DOWNLOAD_BUTTON);
            await downloadBtn.first().click();

            const download = await downloadPathPromise;
            const suggestedFilename = download.suggestedFilename();
            const filePath = path.join(this.downloadDir, suggestedFilename);

            await download.saveAs(filePath);

            this.downloadCount++;
            const msg = `CV downloaded and saved: ${suggestedFilename}`;
            Logger.info(msg);
            this.log(msg, 'success');

            this.updateProgress();

        } catch (error) {
            Logger.error('Failed to download CV', error);
            this.log(`Failed to download CV: ${error.message}`, 'error');
        }
    }

    updateProgress() {
        const percent = Math.min(100, (this.downloadCount / this.config.maxCvCount) * 100);
        this.progressCallback({
            progress: percent,
            currentCount: this.downloadCount,
            totalCount: this.config.maxCvCount,
            type: 'info'
        });
    }

    log(message, type = 'info') {
        this.progressCallback({
            message,
            type
        });
    }
}

module.exports = ApplicantProcessor;
