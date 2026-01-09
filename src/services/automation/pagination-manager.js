/**
 * Pagination Manager
 * Handles navigation between pages of applicants.
 */

const { SELECTORS, DEFAULTS } = require('../../config/constants');
const InteractionUtils = require('./interaction-utils');
const Logger = require('../../utils/logger');

class PaginationManager {
    constructor(page, progressCallback) {
        this.page = page;
        this.progressCallback = progressCallback;
    }

    async isNextPageAvailable() {
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

    async switchToNextPage() {
        const pages = this.page.locator(SELECTORS.PAGINATION_PAGE_ITEMS);
        const pageCount = await pages.count();

        for (let i = 0; i < pageCount; i++) {
            const isCurrent = await pages.nth(i).locator('button[aria-current="true"]').count() > 0;

            if (isCurrent) {
                // The next item in the list should be the next page button
                if (i + 1 < pageCount) {
                    const nextBtnContainer = pages.nth(i + 1);
                    const nextBtn = nextBtnContainer.locator('button');

                    this.progressCallback({
                        message: 'Moving to the next applicants page',
                        type: 'info'
                    });

                    await InteractionUtils.smoothScrollTo(this.page, nextBtn);
                    await InteractionUtils.microPause();

                    // Human-like move to the button
                    await InteractionUtils.slowMouseMove(this.page, nextBtn);

                    // Manual Click
                    await this.page.mouse.down();
                    await InteractionUtils.microPause();
                    await this.page.mouse.up();

                    await InteractionUtils.randomWait(DEFAULTS.MIN_WAIT_SECONDS, DEFAULTS.MAX_WAIT_SECONDS);
                    return true;
                }
            }
        }

        this.progressCallback({
            message: 'Reached the last page or could not find next button',
            type: 'info'
        });
        return false;
    }

    async navigateToPage(targetPage) {
        if (targetPage <= 1) return;

        this.progressCallback({
            message: `Navigating to start page: ${targetPage}...`,
            type: 'info'
        });

        let currentPage = 1;
        const MAX_RETRIES = 3;

        while (currentPage < targetPage) {
            // Logic:
            // 1. Check if target page button is directly visible
            // 2. If yes, click it
            // 3. If no, click the highest visible page number OR "Next"

            const pages = this.page.locator(SELECTORS.PAGINATION_PAGE_ITEMS);
            const pageCount = await pages.count();

            // Try to find exact page button
            let foundExact = false;
            for (let i = 0; i < pageCount; i++) {
                const btn = pages.nth(i).locator('button');
                const text = await btn.innerText();
                const pageNum = parseInt(text);

                if (!isNaN(pageNum) && pageNum === targetPage) {
                    this.progressCallback({
                        message: `Found target page ${targetPage}, clicking...`,
                        type: 'info'
                    });

                    await InteractionUtils.smoothScrollTo(this.page, btn);
                    await InteractionUtils.slowMouseMove(this.page, btn);

                    await this.page.mouse.down();
                    await InteractionUtils.microPause();
                    await this.page.mouse.up();
                    await this.page.waitForTimeout(DEFAULTS.PAGE_LOAD_WAIT);
                    return; // We arrived!
                }
            }

            // If exact page not found, look for "Next" button or click largest number

            // Check current page number to avoid infinite loops
            const activeBtn = this.page.locator(SELECTORS.ACTIVE_PAGE_BUTTON);
            const activeText = await activeBtn.innerText();
            const activePageNum = parseInt(activeText);

            if (!isNaN(activePageNum)) {
                if (activePageNum === currentPage && activePageNum < targetPage) {
                    // We haven't moved. Something is wrong.
                    // We are trusting switchToNextPage to error out if it can't move
                }
                currentPage = activePageNum;
            }

            if (currentPage >= targetPage) {
                return;
            }

            this.progressCallback({
                message: `Currently on page ${currentPage}, moving towards ${targetPage}...`,
                type: 'info'
            });

            const success = await this.switchToNextPage();
            if (!success) {
                Logger.warn('Could not click next page during navigation traversal.');
                this.progressCallback({ message: 'Could not click next page, stopping navigation.', type: 'warning' });
                break;
            }

            // Wait for page load
            await this.page.waitForTimeout(DEFAULTS.PAGE_LOAD_WAIT);
        }
    }
}

module.exports = PaginationManager;
