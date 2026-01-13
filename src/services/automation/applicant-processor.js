/**
 * Applicant Processor
 * Handles processing of individual applicants on a page.
 */

const fs = require('fs').promises;
const path = require('path');
const { SELECTORS, TIMEOUTS, DEFAULTS } = require('../../config/constants');
const InteractionUtils = require('./interaction-utils');
const Logger = require('../../utils/logger');
const StateManager = require('../state-manager');
const ApplicantNameExtractor = require('./applicant-name-extractor');

class ApplicantProcessor {

    constructor(page, config, progressCallback, downloadDir) {
        this.page = page;
        this.config = config;
        this.progressCallback = progressCallback;
        this.downloadDir = downloadDir;

        this.downloadCount = 0;
        this.processedCount = 0; // Total processed (skipped + downloaded)
        this.failedApplicants = []; // Track failed downloads
        this.stopped = false;
        this.paused = false;
        this.processedApplicants = new Set();
        this.virusScanRedirectCount = 0; // Track reloads per applicant
        this.debugScreenshotCount = 0; // Limit debug screenshots causing hangs
    }

    async stop() {
        this.stopped = true;
        await this._saveProgress(true); // Force save on stop
    }

    async pause() {
        this.paused = true;
        this.log('Process paused.', 'info');
        await this._saveProgress(true); // Force save on pause
    }

    resume() {
        this.paused = false;
        this.log('Process resumed.', 'info');
    }

    async _checkForPause() {
        if (this.paused && !this.stopped) {
            this.log('Pausing actions...', 'debug');
            while (this.paused && !this.stopped) {
                await this.page.waitForTimeout(500);
            }
            this.log('Resuming actions...', 'debug');
        }
    }

    hydrateState(processedList, count) {
        if (Array.isArray(processedList)) {
            this.processedApplicants = new Set(processedList);
        }
        this.downloadCount = count;
        this.log(`State hydrated: ${this.processedApplicants.size} applicants previously processed.`, 'info');
    }

    async _cleanUI() {
        try {
            await this.page.evaluate((selectors) => {
                const overlays = [
                    selectors.MSG_OVERLAY,
                    '#artdeco-modal-outlet',
                    '.artdeco-toasts_toasts',
                    '.artdeco-toast-container'
                ];
                overlays.forEach(selector => {
                    const el = document.querySelector(selector);
                    if (el) el.remove();
                });
            }, SELECTORS);
        } catch (e) {
            // Ignore cleanup errors
        }
    }

    async processCurrentPage() {
        let processedIndex = 0;
        let isPageComplete = false;

        this.log('Starting dynamic applicant processing...', 'info');
        await this._cleanUI(); // Initial cleanup

        while (!this.stopped && !isPageComplete) {
            // Handle Pause
            while (this.paused && !this.stopped) {
                await this.page.waitForTimeout(1000);
            }

            // 0. Ensure Page Context (Fix for Premium/Survey Redirects)
            try {
                await this._ensurePageContext(processedIndex);
            } catch (ctxErr) {
                this.log(`Critical context error: ${ctxErr.message}. Aborting page processing.`, 'error');
                break;
            }

            const applicants = this.page.locator(SELECTORS.APPLICATION_LIST);
            const currentCount = await applicants.count();

            if (processedIndex >= currentCount) {
                this.log('Reached end of list, trying to load more applicants...', 'debug');
                const previousCount = currentCount;

                try {
                    const listContainer = applicants.first().locator('..');
                    // Force scroll to bottom to reveal loading spinner
                    await listContainer.evaluate(el => el.scrollTop = el.scrollHeight);

                    await this.page.waitForTimeout(3000);

                    const newCount = await applicants.count();

                    if (newCount > previousCount) {
                        this.log(`Lazy load successful: Found ${newCount - previousCount} new applicants.`, 'info');
                        continue;
                    } else {
                        this.log('No new applicants loaded. End of page reached.', 'info');
                        isPageComplete = true;
                        break;
                    }
                } catch (e) {
                    isPageComplete = true;
                    break;
                }
            }

            if (processedIndex < currentCount) {
                this.log(`Processing applicant ${processedIndex + 1} of ${currentCount}...`, 'debug');

                if (this.downloadCount >= this.config.maxCvCount) {
                    this.log(`Maximum CV download limit reached: ${this.config.maxCvCount}`, 'warning');
                    this.stop(); // Signal to stop processing
                    return;
                }

                if (this.stopped) {
                    this.log('Process stopped by user.', 'warning');
                    return;
                }

                try {
                    await this.processSingleApplicant(applicants.nth(processedIndex));
                    this.virusScanRedirectCount = 0; // Reset on success
                } catch (error) {
                    if (error.message === 'VIRUS_SCAN_RELOAD_REQUIRED') {
                        // Check for infinite loop
                        if (this.virusScanRedirectCount >= 3) {
                            const errName = (await this._getApplicantName()) || 'Unknown';
                            const pageNum = await this._getCurrentPageNumber();

                            this.log(`Persistent virus scan after ${this.virusScanRedirectCount} reloads. Skipping applicant: ${errName}`, 'error');

                            this.failedApplicants.push({
                                name: errName,
                                reason: 'Persistent Virus Scan (Max Retries Exceeded)',
                                page: pageNum
                            });

                            // Real-time failure log
                            if (this.progressCallback) {
                                this.progressCallback({
                                    failure: { name: errName, reason: 'Persistent Virus Scan' },
                                    stats: { processed: this.processedCount, success: this.downloadCount, failed: this.failedApplicants.length }
                                });
                            }

                            this.virusScanRedirectCount = 0;
                            processedIndex++; // Skip this applicant
                            continue;
                        }

                        this.virusScanRedirectCount++;
                        const triggerName = error.applicantName || 'Unknown Applicant';

                        if (triggerName && this.processedApplicants.has(triggerName)) {
                            this.processedApplicants.delete(triggerName);
                        }

                        this.log(`Virus scan detected for "${triggerName}" (Attempt ${this.virusScanRedirectCount}/3). Performing full page reload...`, 'warning');

                        // 1. Reload the page
                        try {
                            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE_APPLICANTS });
                        } catch (reloadErr) {
                            this.log(`Reload timed out: ${reloadErr.message}. Stopping hard load to recover...`, 'warning');
                            try { await this.page.evaluate(() => window.stop()); } catch (e) { }
                        }

                        // 2. Wait for list to be visible again
                        try {
                            await this.page.waitForSelector(SELECTORS.APPLICATION_LIST, { timeout: TIMEOUTS.APPLICANTS_LIST_VISIBLE });
                        } catch (e) {
                            this.log('Timeout waiting for list after reload', 'error');
                        }

                        this.log('Recovering scroll position...', 'debug');

                        // 3. Scroll recovery loop
                        try {
                            await this._recoverListState(processedIndex);
                        } catch (recErr) {
                            this.log(`Recovery failed: ${recErr.message}`, 'error');
                            // If recovery fails, we might just have to continue and let the next loop handle it or break
                        }
                    } // End of virus scan block

                    this.virusScanRedirectCount = 0;
                    Logger.error(`Error processing applicant ${processedIndex}: ${error.message}`, error);
                }

                processedIndex++;

                // --- STEALTH MODIFICATIONS ---
                if (Math.random() > 0.7) {
                    await InteractionUtils.performRandomIdle(this.page);
                }

                const breakInterval = this.config.breakInterval || DEFAULTS.BREAK_INTERVAL;
                const breakMin = this.config.breakDurationMin || DEFAULTS.BREAK_DURATION_MIN;
                const breakMax = this.config.breakDurationMax || DEFAULTS.BREAK_DURATION_MAX;

                if (this.downloadCount > 0 && this.downloadCount % breakInterval === 0) {
                    const breakSeconds = Math.floor(
                        breakMin + Math.random() * (breakMax - breakMin)
                    );
                    const msg = `Taking a break for ${Math.floor(breakSeconds / 60)}m ${breakSeconds % 60}s to act human...`;
                    this.log(msg, 'info');

                    await this.page.waitForTimeout(breakSeconds * 1000);
                }

                await InteractionUtils.randomWait(this.config.minWait, this.config.maxWait);
                await this._saveProgress();
            }
        }
    }

    /**
     * Verifies if the selected applicant in the details panel matches the clickable item.
     * Uses fuzzy matching to handle partial name matches (e.g. "Edip Emre Bodur" vs "Edip Bodur").
     */
    async verifySelectionWithRetry(applicantName, applicantIndex) {
        let attempts = 0;
        while (attempts < 3) {
            try {
                // Get name from details panel
                const detailsNameEl = this.page.locator('.artdeco-entity-lockup__title').first();
                await detailsNameEl.waitFor({ state: 'visible', timeout: 5000 });
                const detailsName = (await detailsNameEl.innerText()).trim();

                // Normalize names for comparison
                // 1. Lowercase
                // 2. Remove extra spaces
                // 3. Remove titles like "Mr.", "Mrs.", "Dr."
                // 4. Remove punctuation
                const normalize = (str) => str.toLowerCase()
                    .replace(/\./g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                const n1 = normalize(applicantName);
                const n2 = normalize(detailsName);

                // Exact match check
                if (n1 === n2) return true;

                // Fuzzy match check (Feature: Fuzzy Match)
                // Check if one contains the other (e.g. "Edip Emre Bodur" includes "Edip Bodur" parts)
                const parts1 = n1.split(' ');
                const parts2 = n2.split(' ');

                // Count matching parts
                let matches = 0;
                for (const p1 of parts1) {
                    if (parts2.includes(p1)) matches++;
                }

                // If more than 50% of the words match, consider it verified
                // Example: "Edip (match) Emre Bodur (match)" -> 2/3 matches against "Edip Bodur"
                const threshold = Math.min(parts1.length, parts2.length) * 0.5;

                if (matches >= threshold) {
                    this.log(`Fuzzy match verified: List="${applicantName}" vs Panel="${detailsName}"`, 'debug');
                    return true;
                }

                this.log(`Name mismatch (Attempt ${attempts + 1}): List="${applicantName}" vs Panel="${detailsName}"`, 'warning');
                attempts++;
                await this.page.waitForTimeout(1000);
            } catch (e) {
                this.log(`Verification error: ${e.message}`, 'debug');
                attempts++;
            }
        }
        return false;
    }

    async processSingleApplicant(applicantLocator) {
        await this._checkForPause();

        const clickTarget = applicantLocator;
        const applicantName = await ApplicantNameExtractor.extractName(applicantLocator);

        if (applicantName && this.processedApplicants.has(applicantName)) {
            if (applicantName && this.processedApplicants.has(applicantName)) {
                this.log(`Skipping duplicate applicant: ${applicantName}`, 'debug');

                // Increment processedIndex even if we skip, so we don't get stuck? 
                // processedIndex is loop counter. 
                // Actually, if we return here, we exit processSingleApplicant.
                // The CALLER (processCurrentPage) loop increments processedIndex.
                return;
            }
            return;
        }

        if (applicantName) {
            this.log(`Processing applicant: ${applicantName}`, 'info');
        }

        await this._checkForPause();
        // Reverting to original safe verification method
        const selectionSuccess = await this._selectAndVerifyApplicant(clickTarget, applicantName, applicantLocator);

        if (!selectionSuccess) {
            this.log(`Could not verify selection for "${applicantName}" after retries - skipping`, 'warning');
            if (applicantName) this.processedApplicants.add(applicantName);
            return;
        }

        if (applicantName) this.processedApplicants.add(applicantName);

        await this._checkForPause();

        this.log('Checking for CV...', 'debug');
        await this.scrollToDownloadSection();

        try {
            await this.tryDownloadCv(applicantName, applicantLocator);
        } catch (error) {
            if (!error.applicantName) error.applicantName = applicantName;
            throw error;
        }
    }

    async _selectAndVerifyApplicant(targetLocator, applicantName, fallbackLocator) {
        let selectionSuccess = false;

        for (let attempt = 1; attempt <= DEFAULTS.RETRY_ATTEMPTS; attempt++) {
            await this._checkForPause();

            this.log(`Selection attempt ${attempt}...`, 'debug');
            this.log('Scrolling to applicant...', 'debug');
            try {
                await targetLocator.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
            } catch (e) {
                await targetLocator.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.SCROLL_TIMEOUT });
            }
            await InteractionUtils.microPause();

            if (attempt === 1) {
                this.log('Moving mouse to applicant...', 'debug');
                await InteractionUtils.slowMouseMove(this.page, targetLocator);
                await this.page.waitForTimeout(100 + Math.random() * 200);

                this.log('Clicking applicant (Hybrid)...', 'debug');
                await targetLocator.click();
                await this.page.waitForTimeout(500);
            } else {
                this.log('Retry: Using direct JS click on CONTAINER...', 'warning');
                if (fallbackLocator) {
                    await fallbackLocator.click({ force: true });
                } else {
                    await targetLocator.click({ force: true });
                }
            }

            this.log('Verifying selection...', 'debug');
            selectionSuccess = await this.waitForDetailsPanel(applicantName);

            if (selectionSuccess) break;

            if (!selectionSuccess && attempt < DEFAULTS.RETRY_ATTEMPTS) {
                this.log(`Verification failed for "${applicantName}". Retrying...`, 'warning');
                await this.page.waitForTimeout(TIMEOUTS.RETRY_WAIT);
            }
        }
        return selectionSuccess;
    }

    async waitForDetailsPanel(expectedName) {
        try {
            const panel = this.page.locator(SELECTORS.DETAILS_PANEL);
            await panel.waitFor({ timeout: 10000 });

            if (expectedName) {
                this.log(`Waiting for details panel to show: ${expectedName}`, 'debug');

                try {
                    await this.page.waitForFunction(
                        ({ selector, name }) => {
                            const el = document.querySelector(selector);
                            if (!el) return false;
                            const text = el.innerText.replace(/\s+/g, ' ').toLowerCase();
                            return text.includes(name.toLowerCase());
                        },
                        { selector: SELECTORS.DETAILS_PANEL, name: expectedName },
                        { timeout: 5000 }
                    );
                    return true;
                } catch (e) {
                    let foundText = 'N/A';
                    try { foundText = (await panel.innerText()).substring(0, 100); } catch (z) { }

                    this.log(`Verification fail. Expected "${expectedName}", found text starting with: "${foundText}..."`, 'warning');
                    return false;
                }
            }
            return true;
        } catch (error) {
            Logger.warn('Details panel timeout or verification error');
            return false;
        }
    }

    async _ensurePageContext(requiredCount) {
        const currentUrl = this.page.url();
        const expectedUrlPart = '/hiring/jobs'; // Basic check
        // Check if we are on a survey or some other non-job page
        if (currentUrl.includes('premium/survey') || !currentUrl.includes(expectedUrlPart)) {
            this.log(`Lost page context (URL: ${currentUrl}). Redirecting back to applicants page...`, 'warning');

            let attempts = 0;
            while (attempts < 3) {
                try {
                    attempts++;
                    await this.page.goto(this.config.applicantsUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE_APPLICANTS });

                    // Wait for a bit and check URL again to ensure we didn't bounce back
                    await this.page.waitForTimeout(3000);

                    if (this.page.url().includes('premium/survey')) {
                        this.log('Still on survey page, retrying navigation...', 'warning');
                        continue;
                    }

                    await this.page.waitForSelector(SELECTORS.APPLICATION_LIST, { timeout: TIMEOUTS.APPLICANTS_LIST_VISIBLE });

                    this.log('Returned to applicants page. Recovering list state...', 'debug');
                    await this._recoverListState(requiredCount);
                    return true; // Context was restored
                } catch (e) {
                    this.log(`Attempt ${attempts} to restore page context failed: ${e.message}`, 'error');
                    if (attempts === 3) throw e;
                }
            }
        }
        return false; // Context was already correct
    }

    async _recoverListState(targetIndex) {
        let recoveredCount = 0;
        let retryScrolls = 0;
        const MAX_SCROLL_RETRIES = 50;
        let lastLogTime = 0;
        let stagnantCount = 0;
        let lastCount = 0;

        while (retryScrolls < MAX_SCROLL_RETRIES) {
            const refreshedApplicants = this.page.locator(SELECTORS.APPLICATION_LIST);
            recoveredCount = await refreshedApplicants.count();

            const now = Date.now();
            if (now - lastLogTime > 5000) {
                const pagePrefix = (await this._getCurrentPageNumber()) || '?';
                this.log(`List Recovery (Page ${pagePrefix}): Loaded ${recoveredCount} of ${targetIndex + 1} required applicants...`, 'debug');
                lastLogTime = now;
            }

            if (recoveredCount > targetIndex) {
                break;
            }

            if (recoveredCount === lastCount) {
                stagnantCount++;
                if (stagnantCount >= 10) {
                    this.log('List recovery stuck (count stagnant). Reloading page again to reset...', 'warning');
                    try {
                        await this.page.reload({ waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE_APPLICANTS });
                    } catch (e) {
                        this.log(`Stuck recovery reload timed out: ${e.message}. Stopping hard load...`, 'warning');
                        try { await this.page.evaluate(() => window.stop()); } catch (stopErr) { }
                    }
                    try { await this.page.waitForSelector(SELECTORS.APPLICATION_LIST, { timeout: TIMEOUTS.APPLICANTS_LIST_VISIBLE }); } catch (e) { }

                    await this.page.waitForTimeout(3000);
                    stagnantCount = 0;
                    retryScrolls = 0;
                    lastCount = 0;
                    continue;
                }
            } else {
                stagnantCount = 0;
            }
            lastCount = recoveredCount;

            try {
                const listContainer = refreshedApplicants.first().locator('..');
                await listContainer.evaluate(el => el.scrollTop = el.scrollHeight);
                await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            } catch (e) { }

            await this.page.waitForTimeout(2000);
            retryScrolls++;
        }

        if (recoveredCount <= targetIndex) {
            throw new Error(`Could not recover list state. Target: ${targetIndex}, Found: ${recoveredCount}`);
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
            Logger.debug('Download button not found within timeout');
        }
    }

    async tryDownloadCv(applicantName, applicantLocator) {
        try {
            await fs.mkdir(this.downloadDir, { recursive: true });
        } catch (e) { /* ignore */ }

        for (let attempt = 1; attempt <= DEFAULTS.RETRY_ATTEMPTS; attempt++) {
            await this._checkForPause();
            let downloadPathPromise;

            try {
                let downloadBtn = this.page.locator(SELECTORS.DOWNLOAD_BUTTON);
                let count = await downloadBtn.count();

                if (count === 0 && SELECTORS.DOWNLOAD_BUTTON_FALLBACK) {
                    const fallbackBtn = this.page.locator(SELECTORS.DOWNLOAD_BUTTON_FALLBACK).first();
                    if (await fallbackBtn.count() > 0) {
                        this.log('Primary download button missing, using fallback...', 'debug');
                        downloadBtn = fallbackBtn;
                        count = 1;
                    }
                }

                const broadBtn = this.page.locator(SELECTORS.DOWNLOAD_BUTTON_BROAD);
                if (await broadBtn.count() > 0) {
                    this.log('Fallback missing, using BROAD selector (PDF/Aria)...', 'debug');
                    downloadBtn = broadBtn;
                    count = 1;
                }

                if (count === 0 && SELECTORS.MORE_ACTIONS_BUTTON) {
                    const moreBtn = this.page.locator(SELECTORS.MORE_ACTIONS_BUTTON).first();
                    if (await moreBtn.count() > 0 && await moreBtn.isVisible()) {
                        this.log('Primary buttons missing, checking "More" menu...', 'debug');
                        try {
                            await moreBtn.click();
                            await this.page.waitForTimeout(500);
                            const menuDownload = this.page.locator(SELECTORS.DOWNLOAD_MENU_ITEM).first();
                            if (await menuDownload.count() > 0) {
                                this.log('Found download link in "More" menu!', 'debug');
                                downloadBtn = menuDownload;
                                count = 1;
                            } else {
                                await this.page.keyboard.press('Escape');
                            }
                        } catch (e) {
                            this.log(`Failed to interact with "More" menu: ${e.message}`, 'debug');
                        }
                    }
                }

                if (count === 0 && SELECTORS.VIRUS_SCAN_SECTION) {
                    const virusScan = this.page.locator(SELECTORS.VIRUS_SCAN_SECTION);
                    if (await virusScan.count() > 0) {
                        throw new Error('VIRUS_SCAN_RELOAD_REQUIRED');
                    }
                }

                if (count === 0) {
                    if (attempt < DEFAULTS.RETRY_ATTEMPTS) {
                        this.log(`CV button not found immediately (Attempt ${attempt}). Re-checking...`, 'debug');
                        await this.scrollToDownloadSection();
                        await this.page.waitForTimeout(1500);
                        try {
                            // Move to neutral area (left-middle) to avoid hovering top-right profile
                            await this.page.mouse.move(50, 400);
                            await this.page.mouse.move(100, 100);
                            await this.page.mouse.move(200, 200);
                        } catch (e) { }
                        continue;
                    } else {
                        this.log('No downloadable CV available for this applicant', 'warning');
                        if (this.debugScreenshotCount < 5) {
                            try {
                                const panel = this.page.locator(SELECTORS.DETAILS_PANEL);
                                if (await panel.count() > 0) {
                                    const timestamp = Date.now();
                                    const devPath = path.join(this.downloadDir, `DEBUG_MISSING_CV_${timestamp}.png`);
                                    await panel.screenshot({ path: devPath });
                                    this.log(`Saved debug PNG`, 'debug');
                                    this.debugScreenshotCount++;
                                }
                            } catch (e) { }
                        } else if (this.debugScreenshotCount === 5) {
                            this.log('Max debug screenshots reached.', 'info');
                            this.debugScreenshotCount++;
                        }

                        const name = applicantName || await this._getApplicantName() || 'Unknown Applicant';
                        const pageNum = await this._getCurrentPageNumber();
                        this.failedApplicants.push({ name, reason: 'No CV button found', page: pageNum });
                        return;
                    }
                }

                if (attempt > 1) {
                    this.log(`Retry download attempt ${attempt}/${DEFAULTS.RETRY_ATTEMPTS}...`, 'info');
                }

                downloadPathPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.DOWNLOAD_EVENT });

                await InteractionUtils.slowMouseMove(this.page, downloadBtn.first());
                const activeBtn = downloadBtn.first();

                // CRITICAL: Check href before clicking to prevent premium survey redirect
                try {
                    const href = await activeBtn.evaluate(el => el.href || el.getAttribute('href'));
                    if (href && (href.includes('premium/survey') || (href.includes('premium') && href.includes('survey')))) {
                        this.log(`BLOCKED: Download link leads to premium survey (${href}). Skipping applicant.`, 'warning');
                        const name = applicantName || await this._getApplicantName() || 'Unknown Applicant';
                        const pageNum = await this._getCurrentPageNumber();
                        this.failedApplicants.push({ name, reason: 'Premium Survey Link Detected', page: pageNum });

                        // IMPORTANT: Force return to skip this applicant loop immediately
                        this.updateProgress();
                        return;
                    }
                } catch (e) {
                    this.log(`Could not check href (continuing anyway): ${e.message}`, 'debug');
                }

                await activeBtn.evaluate(el => el.removeAttribute('target')).catch(() => { });
                await activeBtn.click({ timeout: 15000 });

                const download = await downloadPathPromise;

                if (!applicantName) {
                    try {
                        applicantName = await this._getApplicantNameFromDetails();
                    } catch (e) { }
                }

                const sanitize = (str) => {
                    let cleaned = (str || 'Unknown').trim();
                    cleaned = cleaned.replace(/adlı kullanıcının başvurusu/gi, '')
                        .replace(/['"]s application/gi, '')
                        .replace(/\d+\.?\s*(st|nd|rd|th)?\s*(degree|derece)\s*(connection|bağlantı)?/gi, '')
                        .replace(/\.+$/, '')
                        .trim();
                    return cleaned.replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '');
                };

                const safeName = sanitize(applicantName);
                const safeJob = sanitize(this.config.jobTitle);
                const finalName = safeName ? `${safeName}_CV_${safeJob}.pdf` : download.suggestedFilename();

                const { filePath, uniqueFileName } = await this._getUniqueFilePath(this.downloadDir, finalName);
                await download.saveAs(filePath);

                this.downloadCount++;
                const msg = `CV saved: ${uniqueFileName}`;
                Logger.info(msg);
                this.log(msg, 'success');
                this.updateProgress();
                return;

            } catch (error) {
                if (downloadPathPromise) downloadPathPromise.catch(() => { });

                if (error.message === 'VIRUS_SCAN_RELOAD_REQUIRED') {
                    let resolvedName = applicantName;
                    if (!resolvedName) {
                        try {
                            resolvedName = await this._getApplicantNameFromDetails();
                        } catch (e) { }
                    }
                    error.applicantName = resolvedName || 'Unknown Applicant';
                    throw error;
                }

                const isTimeout = error.name === 'TimeoutError' || error.message.includes('Timeout');

                if (attempt < DEFAULTS.RETRY_ATTEMPTS) {
                    const delay = TIMEOUTS.RETRY_WAIT || 2000;
                    let errDetail = error.message;
                    if (isTimeout) {
                        errDetail = error.message.includes('waitForEvent') ? 'Download did not start (Timeout)' : 'Click failed (Timeout)';
                    }
                    Logger.warn(`Download attempt ${attempt} failed: ${errDetail}. Retrying in ${delay}ms...`);
                    await this._cleanUI();
                    await this.page.waitForTimeout(delay);
                    continue;
                }

                if (isTimeout) {
                    this.log('Download verification timed out after retries', 'warning');
                    const name = applicantName || await this._getApplicantName() || 'Unknown Applicant';
                    const pageNum = await this._getCurrentPageNumber();
                    this.failedApplicants.push({ name, reason: 'Download timeout', page: pageNum });
                } else {
                    Logger.error('Critical error during download sequence', error);
                    const name = applicantName || await this._getApplicantName() || 'Unknown Applicant';
                    const pageNum = await this._getCurrentPageNumber();
                    this.failedApplicants.push({ name, reason: error.message, page: pageNum });
                }
            }
        }
    }

    async _getApplicantName() {
        try {
            const nameEl = await this.page.$(SELECTORS.APPLICANT_NAME);
            if (nameEl) return (await nameEl.innerText()).trim();
        } catch (e) { }
        return null;
    }

    async _getCurrentPageNumber() {
        try {
            const activeBtn = this.page.locator(SELECTORS.ACTIVE_PAGE_BUTTON);
            if (await activeBtn.count() > 0) {
                return (await activeBtn.innerText()).trim();
            }
        } catch (e) { }
        return 'Unknown';
    }

    async _getApplicantNameFromDetails() {
        try {
            const panel = this.page.locator(SELECTORS.DETAILS_PANEL);
            const titleEl = panel.locator('.artdeco-entity-lockup__title');
            if (await titleEl.count() > 0) {
                return (await titleEl.first().innerText()).trim();
            }
            const header = panel.locator('h1, h2').first();
            if (await header.count() > 0) {
                return (await header.innerText()).trim();
            }
        } catch (e) { }
        return null;
    }

    async updateProgress() {
        const percent = Math.min(100, (this.downloadCount / this.config.maxCvCount) * 100);
        this.progressCallback({
            progress: percent,
            currentCount: this.downloadCount,
            totalCount: this.config.maxCvCount,
            type: 'info',
            stats: {
                processed: this.processedCount,
                success: this.downloadCount,
                failed: this.failedApplicants.length
            }
        });
    }

    log(message, type = 'info') {
        if (type === 'error') Logger.error(message);
        else if (type === 'warning') Logger.warn(message);
        else if (type === 'info') Logger.info(message);

        if (type !== 'debug') {
            this.progressCallback({ message, type });
        }
    }

    async _getUniqueFilePath(dir, originalName) {
        const ext = path.extname(originalName);
        const nameWithoutExt = path.basename(originalName, ext);

        let counter = 1;
        let uniqueName = originalName;
        let p = path.join(dir, uniqueName);

        while (true) {
            try {
                await fs.access(p);
                counter++;
                uniqueName = `${nameWithoutExt}_v${counter}${ext}`;
                p = path.join(dir, uniqueName);
            } catch (e) {
                break;
            }
        }
        return { filePath: p, uniqueFileName: uniqueName };
    }

    async _saveProgress(force = false) {
        if (force || this.paused || this.stopped || this.downloadCount % 5 === 0) {
            await StateManager.saveState({
                processedApplicants: Array.from(this.processedApplicants),
                downloadCount: this.downloadCount,
                failedApplicants: this.failedApplicants
            });
        }
    }
}

module.exports = ApplicantProcessor;
