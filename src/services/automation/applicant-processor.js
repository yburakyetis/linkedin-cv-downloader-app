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
            // this.log('UI cleanup performed (overlays removed).', 'debug');
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

                            this.virusScanRedirectCount = 0;
                            processedIndex++; // Skip this applicant
                            continue;
                        }

                        this.virusScanRedirectCount++;
                        const triggerName = error.applicantName || 'Unknown Applicant';

                        // FIX: Remove from processed list so we retry after reload instead of skipping as duplicate
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
                        // We need to scroll down enough times until the 'processedIndex' is reachable
                        let recoveredCount = 0;
                        let retryScrolls = 0;
                        const MAX_SCROLL_RETRIES = 50;
                        let lastLogTime = 0;
                        let stagnantCount = 0;
                        let lastCount = 0;

                        while (retryScrolls < MAX_SCROLL_RETRIES) {
                            const refreshedApplicants = this.page.locator(SELECTORS.APPLICATION_LIST);
                            recoveredCount = await refreshedApplicants.count();

                            // UX: Log progress every 5 seconds (Debug only to avoid clutter)
                            const now = Date.now();
                            if (now - lastLogTime > 5000) {
                                const pagePrefix = (await this._getCurrentPageNumber()) || '?';
                                this.log(`List Recovery (Page ${pagePrefix}): Loaded ${recoveredCount} of ${processedIndex + 1} required applicants...`, 'debug');
                                lastLogTime = now;
                            }

                            if (recoveredCount > processedIndex) {
                                break; // Found our spot
                            }

                            // Stuck detection: If count hasn't changed for 10 attempts
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
                                    retryScrolls = 0; // Reset retries
                                    lastCount = 0;
                                    continue;
                                }
                            } else {
                                stagnantCount = 0;
                            }
                            lastCount = recoveredCount;

                            // Scroll Logic: Try multiple ways to trigger infinite scroll
                            try {
                                // Method 1: Scroll container
                                const listContainer = refreshedApplicants.first().locator('..');
                                await listContainer.evaluate(el => el.scrollTop = el.scrollHeight);

                                // Method 2: Window scroll (fallback)
                                await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                            } catch (e) { }

                            // Increase wait slightly to allow network load
                            await this.page.waitForTimeout(2000);
                            retryScrolls++;
                        }

                        this.log(`Scroll recovery complete. Items: ${recoveredCount}, Target Index: ${processedIndex}`, 'debug');

                        // 4. Clean UI again
                        await this._cleanUI();

                        // 4. Clean UI again
                        await this._cleanUI();

                        // 5. Do NOT decrement processedIndex.
                        // We use 'continue' to skip the loop's 'processedIndex++' at the bottom,
                        // effectively retrying the CURRENT index.
                        continue;
                    }

                    this.virusScanRedirectCount = 0; // Reset on other error types too (new applicant next)
                    Logger.error(`Error processing applicant ${processedIndex}`, error);
                }

                processedIndex++;

                // --- STEALTH MODIFICATIONS ---
                // 1. Random "idle/reading" behavior to break robotic rhythm
                if (Math.random() > 0.7) {
                    await InteractionUtils.performRandomIdle(this.page);
                }

                // 2. Break Logic
                const breakInterval = this.config.breakInterval || DEFAULTS.BREAK_INTERVAL;
                const breakMin = this.config.breakDurationMin || DEFAULTS.BREAK_DURATION_MIN;
                const breakMax = this.config.breakDurationMax || DEFAULTS.BREAK_DURATION_MAX;

                if (this.downloadCount > 0 && this.downloadCount % breakInterval === 0) {
                    const breakSeconds = Math.floor(
                        breakMin + Math.random() * (breakMax - breakMin)
                    );
                    const msg = `Taking a break for ${Math.floor(breakSeconds / 60)}m ${breakSeconds % 60}s to act human...`;
                    this.log(msg, 'info'); // Show in UI

                    // Countdown in logs (optional, but good for patience)
                    await this.page.waitForTimeout(breakSeconds * 1000);
                }
                // -----------------------------

                await InteractionUtils.randomWait(this.config.minWait, this.config.maxWait);
                await this._saveProgress();
            }
        }
    }

    async processSingleApplicant(applicantLocator) {
        await this._checkForPause(); // Check at start

        // Target the container (applicantLocator) for reliable selection
        const clickTarget = applicantLocator;

        // Use new robust extraction
        const applicantName = await this._extractApplicantName(applicantLocator);

        if (applicantName && this.processedApplicants.has(applicantName)) {
            this.log(`Skipping duplicate applicant: ${applicantName}`, 'info');
            return;
        }

        if (applicantName) {
            this.log(`Processing applicant: ${applicantName}`, 'info');
        }

        await this._checkForPause();

        // Pass applicantLocator to allow clicking the container as fallback
        const selectionSuccess = await this._selectAndVerifyApplicant(clickTarget, applicantName, applicantLocator);

        if (!selectionSuccess) {
            this.log(`Could not verify selection for "${applicantName}" after retries - skipping`, 'warning');
            // Mark as processed anyway to avoid infinite retries on this page
            if (applicantName) this.processedApplicants.add(applicantName);
            return;
        }

        if (applicantName) this.processedApplicants.add(applicantName);

        await this._checkForPause(); // Check before download attempt

        this.log('Checking for CV...', 'debug');
        this.log('Checking for CV...', 'debug');
        await this.scrollToDownloadSection();

        try {
            await this.tryDownloadCv(applicantName, applicantLocator);
        } catch (error) {
            // Ensure name is attached for upstream logging
            if (!error.applicantName) error.applicantName = applicantName;
            throw error;
        }
    }

    async _extractApplicantName(applicantLocator) {
        try {
            // Strategy 1 (Best): Specific card title from xd.html analysis
            // This element contains just the name text, clean.
            const cardTitle = applicantLocator.locator('.hiring-people-card__title').first();
            if (await cardTitle.count() > 0) {
                const text = await cardTitle.innerText();
                if (this._isValidName(text)) return this._cleanName(text);
            }

            // Strategy 2: Generic Entity Lockup Title
            const lockupTitle = applicantLocator.locator('.artdeco-entity-lockup__title').first();
            if (await lockupTitle.count() > 0) {
                const text = await lockupTitle.innerText();
                const firstLine = text.split('\n')[0];
                if (this._isValidName(firstLine)) return this._cleanName(firstLine);
            }

            // Strategy 3: Link inside title (Legacy support)
            const link = applicantLocator.locator('.artdeco-entity-lockup__title a').first();
            if (await link.count() > 0) {
                const text = await link.innerText();
                if (this._isValidName(text)) return this._cleanName(text);
            }

            // Strategy 4: Image Alt/Aria
            const img = applicantLocator.locator('img.presence-entity__image').first();
            if (await img.count() > 0) {
                // Alt often has "Name Surname fotoğrafı"
                const alt = await img.getAttribute('alt');
                if (alt) {
                    const cleanAlt = alt.replace(/\s+fotoğrafı$/i, '').trim();
                    if (this._isValidName(cleanAlt)) return cleanAlt;
                }
            }

        } catch (e) {
            Logger.warn('Error extracting applicant name', e);
        }
        return '';
    }

    _isValidName(rawName) {
        if (!rawName) return false;
        const clean = rawName.replace(/\s+/g, ' ').trim();
        if (clean.length < 2) return false;
        const INVALID_NAMES = ['İş unvanı', 'Job title', 'Date applied', 'Başvuru tarihi', 'Name', 'İsim', 'Member'];
        return !INVALID_NAMES.some(invalid => clean.includes(invalid));
    }

    _cleanName(rawName) {
        // Just basic trimming, assuming we got the clean name from the left list
        return rawName.replace(/\s+/g, ' ').trim();
    }

    async _selectAndVerifyApplicant(targetLocator, applicantName, fallbackLocator) {
        let selectionSuccess = false;

        for (let attempt = 1; attempt <= DEFAULTS.RETRY_ATTEMPTS; attempt++) {
            await this._checkForPause(); // Check inside selection loop

            this.log(`Selection attempt ${attempt}...`, 'debug');

            this.log('Scrolling to applicant...', 'debug');
            try {
                // Center the element to avoid sticky headers
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
            // Shorter timeout for initial visibility
            await panel.waitFor({ timeout: 10000 });

            if (expectedName) {
                this.log(`Waiting for details panel to show: ${expectedName}`, 'debug');

                try {
                    // Use waitForFunction to wait until the panel text actually UPDATES to match the expected name
                    // This handles the delay between clicking and the panel refreshing
                    await this.page.waitForFunction(
                        ({ selector, name }) => {
                            const el = document.querySelector(selector);
                            // Normalization: Remove extra spaces, case insensitive check
                            if (!el) return false;
                            const text = el.innerText.replace(/\s+/g, ' ').toLowerCase();
                            return text.includes(name.toLowerCase());
                        },
                        { selector: SELECTORS.DETAILS_PANEL, name: expectedName },
                        { timeout: 5000 } // Wait up to 5s for the update
                    );
                    return true;
                } catch (e) {
                    // Just for debugging invalid failures, grab what was there
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
            Logger.debug('Download button not found within timeout');
        }
    }

    async tryDownloadCv(applicantName, applicantLocator) {
        // Validation logic moved to inside the retry loop below


        // Ensure download directory exists
        try {
            await fs.mkdir(this.downloadDir, { recursive: true });
        } catch (e) { /* ignore */ }

        for (let attempt = 1; attempt <= DEFAULTS.RETRY_ATTEMPTS; attempt++) {
            await this._checkForPause(); // Check inside download loop

            let downloadPathPromise;

            try {
                // Check if button exists - potentially retry finding it
                let downloadBtn = this.page.locator(SELECTORS.DOWNLOAD_BUTTON);
                let count = await downloadBtn.count();

                // Fallback attempt 1
                if (count === 0 && SELECTORS.DOWNLOAD_BUTTON_FALLBACK) {
                    const fallbackBtn = this.page.locator(SELECTORS.DOWNLOAD_BUTTON_FALLBACK).first();
                    if (await fallbackBtn.count() > 0) {
                        this.log('Primary download button missing, using fallback...', 'debug');
                        downloadBtn = fallbackBtn;
                        count = 1;
                    }
                }

                // Fallback attempt 2 (Broad)
                const broadBtn = this.page.locator(SELECTORS.DOWNLOAD_BUTTON_BROAD);
                if (await broadBtn.count() > 0) {
                    this.log('Fallback missing, using BROAD selector (PDF/Aria)...', 'debug');
                    downloadBtn = broadBtn;
                    count = 1;
                }


                // Check for virus scan
                if (count === 0 && SELECTORS.VIRUS_SCAN_SECTION) {
                    const virusScan = this.page.locator(SELECTORS.VIRUS_SCAN_SECTION);
                    if (await virusScan.count() > 0) {
                        // Throw specific error to trigger full page reload in the main loop
                        throw new Error('VIRUS_SCAN_RELOAD_REQUIRED');
                    }
                }

                if (count === 0) {
                    if (attempt < DEFAULTS.RETRY_ATTEMPTS) {
                        this.log(`CV button not found immediately (Attempt ${attempt}). Re-checking...`, 'debug');
                        // Try to scroll specifically to where it should be
                        await this.scrollToDownloadSection();
                        await this.page.waitForTimeout(1500);

                        // Wiggle mouse to trigger hover-based lazy loads
                        try {
                            await this.page.mouse.move(100, 100);
                            await this.page.mouse.move(200, 200);
                        } catch (e) { }

                        continue; // Retry loop
                    } else {
                        // Really not found after retries
                        this.log('No downloadable CV available for this applicant', 'warning');

                        // Limit debug screenshots to prevent "rust_png" / IO hangs on invalid batches
                        if (this.debugScreenshotCount < 5) {
                            try {
                                const panel = this.page.locator(SELECTORS.DETAILS_PANEL);
                                if (await panel.count() > 0) {
                                    const timestamp = Date.now();

                                    // Save HTML less frequently or just for the first few
                                    const html = await panel.innerHTML();
                                    const debugHtmlPath = path.join(this.downloadDir, `DEBUG_MISSING_CV_${timestamp}.html`);
                                    await fs.writeFile(debugHtmlPath, html);

                                    const debugImgPath = path.join(this.downloadDir, `DEBUG_MISSING_CV_${timestamp}.png`);
                                    await panel.screenshot({ path: debugImgPath });

                                    this.log(`Saved debug HTML/PNG to ${path.basename(debugImgPath)}`, 'debug');
                                    this.debugScreenshotCount++;
                                }
                            } catch (e) {
                                this.log(`Failed to save debug info: ${e.message}`, 'error');
                            }
                        } else if (this.debugScreenshotCount === 5) {
                            this.log('Max debug screenshots reached. Disabling further debug captures to save performance.', 'info');
                            this.debugScreenshotCount++;
                        }

                        // Track failure
                        const name = applicantName || await this._getApplicantName() || 'Unknown Applicant';
                        const pageNum = await this._getCurrentPageNumber();
                        this.failedApplicants.push({ name, reason: 'No CV button found', page: pageNum });

                        return;
                    }
                }

                // If found, proceed to click
                if (attempt > 1) {
                    this.log(`Retry download attempt ${attempt}/${DEFAULTS.RETRY_ATTEMPTS}...`, 'info');
                }

                // Set download path listener
                downloadPathPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.DOWNLOAD_EVENT });

                // Slow mouse movement before clicking download
                // Re-locate fresh 
                // Note: If using fallback, we might not have a clean SELECTOR string to pass to slowMouseMove
                // So we pass the locator directly if possible, or just skip specific move
                await InteractionUtils.slowMouseMove(this.page, downloadBtn.first());

                // Remove target="_blank"
                const activeBtn = downloadBtn.first();
                await activeBtn.evaluate(el => el.removeAttribute('target')).catch(() => { });

                await activeBtn.click({ timeout: 15000 });

                const download = await downloadPathPromise;

                // Resolve name if unknown (retry from details panel)
                if (!applicantName) {
                    try {
                        applicantName = await this._getApplicantNameFromDetails();
                    } catch (e) { }
                }

                // Custom Filename Logic
                // Format: Name_Surname_CV_PositionName.pdf
                // Replacements: Spaces -> Underscores, remove special chars, remove LinkedIn suffixes
                const sanitize = (str) => {
                    let cleaned = (str || 'Unknown').trim();
                    // Remove "adlı kullanıcının başvurusu" (Turkish) and similar patterns
                    cleaned = cleaned.replace(/adlı kullanıcının başvurusu/gi, '')
                        .replace(/['"]s application/gi, '')
                        .replace(/\d+\.?\s*(st|nd|rd|th)?\s*(degree|derece)\s*(connection|bağlantı)?/gi, '')
                        .replace(/\.+$/, '') // Trailing dots
                        .trim();
                    return cleaned.replace(/\s+/g, '_').replace(/[\\/:*?"<>|]/g, '');
                };

                const safeName = sanitize(applicantName);
                const safeJob = sanitize(this.config.jobTitle);

                // Fallback if name is empty
                const finalName = safeName ? `${safeName}_CV_${safeJob}.pdf` : download.suggestedFilename();

                const { filePath, uniqueFileName } = await this._getUniqueFilePath(this.downloadDir, finalName);

                await download.saveAs(filePath);

                this.downloadCount++;
                const msg = `CV saved: ${uniqueFileName}`;
                Logger.info(msg);
                this.log(msg, 'success');

                this.updateProgress();
                return; // Success, exit function

            } catch (error) {
                if (downloadPathPromise) downloadPathPromise.catch(() => { });

                // Critical: Rethrow to trigger reload in parent loop
                if (error.message === 'VIRUS_SCAN_RELOAD_REQUIRED') {
                    // Fallback: If name is unknown, try to scrape it from the open details panel
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
                        if (error.message.includes('waitForEvent')) {
                            errDetail = 'Download did not start (Timeout)';
                        } else {
                            errDetail = 'Click failed (Timeout)';
                        }
                    }

                    Logger.warn(`Download attempt ${attempt} failed: ${errDetail}. Retrying in ${delay}ms...`);

                    await this._cleanUI();

                    await this.page.waitForTimeout(delay);
                    continue;
                }


                // Final Failure
                if (isTimeout) {
                    this.log('Download verification timed out after retries (download did not start)', 'warning');
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

    // Helper to get name safely for reporting
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
            // Try explicit title selector first
            const titleEl = panel.locator('.artdeco-entity-lockup__title');
            if (await titleEl.count() > 0) {
                return (await titleEl.first().innerText()).trim();
            }
            // Fallback to any h1/h2
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
            type: 'info'
        });
    }

    log(message, type = 'info') {
        // Sync log to terminal as well
        if (type === 'error') Logger.error(message);
        else if (type === 'warning') Logger.warn(message);
        else if (type === 'info') Logger.info(message);

        // Only send non-debug logs to UI to avoid clutter
        if (type !== 'debug') {
            this.progressCallback({
                message,
                type
            });
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
                // If this succeeds, file exists
                await fs.access(p);
                // File exists, increment counter
                counter++;
                uniqueName = `${nameWithoutExt}_v${counter}${ext}`;
                p = path.join(dir, uniqueName);
            } catch (e) {
                // File does not exist, safe to use
                break;
            }
        }
        return { filePath: p, uniqueFileName: uniqueName };
    }

    async _saveProgress(force = false) {
        // Optimization: accumulated processed applicants or 'stopped/paused' state
        // Only save to disk every 5 downloads to reduce IO overhead, unless forced (e.g. stop/pause)
        if (force || this.paused || this.stopped || this.downloadCount % 5 === 0) {
            await StateManager.saveState({
                processedApplicants: Array.from(this.processedApplicants),
                downloadCount: this.downloadCount,
                failedApplicants: this.failedApplicants // Persist failures so they aren't lost on crash
            });
        }
    }
}

module.exports = ApplicantProcessor;
