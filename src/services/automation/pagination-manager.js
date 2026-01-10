/**
 * Pagination Manager
 * Handles navigation between pages of applicants.
 */

const { SELECTORS, DEFAULTS, TIMEOUTS } = require('../../config/constants');
const InteractionUtils = require('./interaction-utils');
const Logger = require('../../utils/logger');

class PaginationManager {
    constructor(page, config, progressCallback) {
        this.page = page;
        this.config = config || {};
        this.progressCallback = progressCallback;
    }

    async isNextPageAvailable() {
        // ... (existing implementation)
        const pages = this.page.locator(SELECTORS.PAGINATION_PAGE_ITEMS);
        const activeBtn = this.page.locator(SELECTORS.ACTIVE_PAGE_BUTTON);

        const activeCount = await activeBtn.count();
        if (activeCount === 0) {
            return false;
        }

        const pageCount = await pages.count();
        let activeIndex = -1;

        for (let i = 0; i < pageCount; i++) {
            // Find which list item contains the active button
            const isCurrent = await pages.nth(i).locator('button[aria-current="true"]').count() > 0;
            if (isCurrent) {
                activeIndex = i;
                break;
            }
        }

        return activeIndex !== -1 && activeIndex + 1 < pageCount;
    }

    async getActivePageNumber() {
        try {
            const activeBtn = this.page.locator(SELECTORS.ACTIVE_PAGE_BUTTON);
            if (await activeBtn.count() > 0) {
                const text = await activeBtn.innerText();
                return parseInt(text);
            }
        } catch (e) {
            Logger.warn('Could not determine active page number', e);
        }
        return 1; // Default
    }

    async switchToNextPage() {
        const pages = this.page.locator(SELECTORS.PAGINATION_PAGE_ITEMS);
        const activeBtn = this.page.locator(SELECTORS.ACTIVE_PAGE_BUTTON);

        let currentActivePage = 1;
        try {
            const text = await activeBtn.innerText();
            currentActivePage = parseInt(text);
        } catch (e) { /* default to 1 */ }

        // Expanded selectors for internationalization (Turkish support)
        const nextButtonLocator = this.page.locator(
            'button[aria-label="Next"], button[aria-label="Sonraki"], button.artdeco-pagination__button--next'
        );

        let clickTarget = null;
        if (await nextButtonLocator.count() > 0 && await nextButtonLocator.isVisible()) {
            clickTarget = nextButtonLocator.first();
        } else {
            // Fallback: finding the next item in the list
            const pageCount = await pages.count();
            for (let i = 0; i < pageCount; i++) {
                const isCurrent = await pages.nth(i).locator('button[aria-current="true"]').count() > 0;
                if (isCurrent && i + 1 < pageCount) {
                    const candidate = pages.nth(i + 1).locator('button');
                    const text = await candidate.innerText().catch(() => '');

                    // MODIFIED: User confirms that checking for ellipsis is NOT needed because clicking it
                    // correctly navigates to the next page (e.g., 8 -> 9).
                    if (text.includes('...') || text.includes('…')) {
                        Logger.info('Next page candidate is an ellipsis. Clicking it to reveal more pages/advance.');
                    }

                    clickTarget = candidate;
                    break;
                }
            }
        }

        if (!clickTarget) {
            this.progressCallback({ message: 'Could not find "Next" button. End of list?', type: 'info' });
            return false;
        }

        this.progressCallback({ message: 'Moving to the next applicants page', type: 'info' });

        await InteractionUtils.smoothScrollTo(this.page, clickTarget);
        await InteractionUtils.microPause();
        await InteractionUtils.slowMouseMove(this.page, clickTarget);

        try { await expect(clickTarget).toBeEnabled({ timeout: 3000 }); } catch (e) { }

        await clickTarget.click();

        this.progressCallback({ message: 'Waiting for page navigation...', type: 'info' });

        try {
            await this.page.waitForFunction(
                (oldPage) => {
                    const activeBtn = document.querySelector('button[aria-current="true"]');
                    if (!activeBtn) return false;
                    const newPage = parseInt(activeBtn.innerText);
                    // Handle case where we click "..." and maybe page number doesn't increment immediately visible way
                    // but usually it does. 
                    return !isNaN(newPage) && newPage > oldPage;
                },
                currentActivePage,
                { timeout: 15000 }
            );

            const waitMin = this.config.pageWaitMin || DEFAULTS.PAGE_WAIT_MIN;
            const waitMax = this.config.pageWaitMax || DEFAULTS.PAGE_WAIT_MAX;
            await InteractionUtils.randomWait(waitMin, waitMax);
            return true;
        } catch (e) {
            this.progressCallback({ message: 'Page navigation verification failed (Active page number did not increase)', type: 'warning' });
            return false;
        }
    }

    async navigateToPage(targetPage) {
        if (targetPage <= 1) return;

        const msg = `Navigating to start page: ${targetPage}...`;
        this.progressCallback({ message: msg, type: 'info' });
        Logger.info(msg);

        Logger.info('Scrolling to bottom to load pagination...');
        try {
            await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await this.page.waitForTimeout(2000);
        } catch (e) {
            Logger.warn('Error scrolling in navigateToPage', e);
        }

        // Initialize current page from DOM if possible, otherwise default to 1
        let currentPage = await this.getActivePageNumber();
        const MAX_LOOPS = 50;
        let loopCounter = 0;

        while (currentPage < targetPage) {
            loopCounter++;
            if (loopCounter > MAX_LOOPS) {
                const warnMsg = `Pagination infinite loop detected (Counter=${loopCounter}). Stopping navigation at page ${currentPage}.`;
                Logger.warn(warnMsg);
                this.progressCallback({ message: warnMsg, type: 'warning' });
                break;
            }

            const pages = this.page.locator(SELECTORS.PAGINATION_PAGE_ITEMS);
            const pageCount = await pages.count();
            Logger.info(`Found ${pageCount} pagination items. Current Page: ${currentPage}`);

            // 1. Try to find the EXACT target page first (Ideal case)
            for (let i = 0; i < pageCount; i++) {
                const btn = pages.nth(i).locator('button');
                // Safety: Some pagination items (like ellipsis) might not have a button or trigger strict mode errors
                if (await btn.count() === 0) continue;

                let text = '';
                try { text = await btn.innerText(); } catch (e) { continue; }

                const pageNum = parseInt(text);

                if (!isNaN(pageNum) && pageNum === targetPage) {
                    const msg = `Found target page ${targetPage}, clicking...`;
                    this.progressCallback({ message: msg, type: 'info' });
                    Logger.info(msg);

                    await InteractionUtils.smoothScrollTo(this.page, btn);
                    await InteractionUtils.slowMouseMove(this.page, btn);

                    await this.page.waitForTimeout(100 + Math.random() * 200);
                    await btn.click();

                    this.progressCallback({ message: `Waiting for page ${targetPage} to activate...`, type: 'info' });

                    try {
                        await this.page.waitForFunction(
                            (expectedNum) => {
                                const activeBtn = document.querySelector('button[aria-current="true"]');
                                return activeBtn && parseInt(activeBtn.innerText) === expectedNum;
                            },
                            targetPage,
                            { timeout: 10000 }
                        );
                        Logger.info(`Successfully confirmed page ${targetPage} is active.`);
                    } catch (e) {
                        Logger.warn(`Timed out waiting for page ${targetPage} to become active, but continuing...`);
                    }

                    await this.page.waitForTimeout(TIMEOUTS.PAGE_LOAD_WAIT);
                    return; // We arrived!
                }
            }

            // 2. SMART JUMP: Find the best intermediate page
            // We look for the largest visible page number that is > currentPage AND < targetPage
            // This lets us skip 1->5->9->12 instead of 1->2->3...
            let bestJumpBtn = null;
            let bestJumpNum = -1;

            for (let i = 0; i < pageCount; i++) {
                const btn = pages.nth(i).locator('button');
                if (await btn.count() === 0) continue;

                let text = '';
                try { text = await btn.innerText(); } catch (e) { continue; }

                // If text is ellipsis usage, we usually can't convert to int.
                const pageNum = parseInt(text);

                if (!isNaN(pageNum)) {
                    // It must be a forward step, but not overshooting the target logic
                    if (pageNum > currentPage && pageNum < targetPage) {
                        if (pageNum > bestJumpNum) {
                            bestJumpNum = pageNum;
                            bestJumpBtn = btn;
                        }
                    }
                }
            }

            if (bestJumpBtn) {
                const msg = `Smart Jump: found page ${bestJumpNum} which is closer to target ${targetPage}`;
                this.progressCallback({ message: msg, type: 'info' });
                Logger.info(msg);

                await InteractionUtils.smoothScrollTo(this.page, bestJumpBtn);
                await InteractionUtils.slowMouseMove(this.page, bestJumpBtn);
                await bestJumpBtn.click();

                await this.page.waitForTimeout(TIMEOUTS.PAGE_LOAD_WAIT);

                // Update actual current page from DOM to stay synced for next iteration
                currentPage = await this.getActivePageNumber();
                continue;
            }

            // 3. Fallback: Use "Next" button OR Ellipsis if it acts as next
            // Verify we aren't already there.
            currentPage = await this.getActivePageNumber();

            if (currentPage >= targetPage) {
                return;
            }

            const msg = `Currently on page ${currentPage}, moving towards ${targetPage} (Next Button/Ellipsis)...`;
            this.progressCallback({ message: msg, type: 'info' });
            Logger.info(msg);

            const success = await this.switchToNextPage();
            if (!success) {
                Logger.warn('Could not click next page during navigation traversal.');
                this.progressCallback({ message: 'Could not click next page, stopping navigation.', type: 'warning' });
                break;
            }

            // Wait for page load
            await this.page.waitForTimeout(TIMEOUTS.PAGE_LOAD_WAIT);

            // Update current page for next loop check
            currentPage = await this.getActivePageNumber();
        }
    }
}

module.exports = PaginationManager;
