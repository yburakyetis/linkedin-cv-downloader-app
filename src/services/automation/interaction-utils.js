/**
 * Interaction Utils
 * Helper functions for human-like interactions to avoid bot detection.
 */

const { DEFAULTS } = require('../../config/constants');
const Logger = require('../../utils/logger');

class InteractionUtils {

    static async randomWait(minSec, maxSec) {
        const wait = minSec + Math.floor(Math.random() * (maxSec - minSec + 1));
        return new Promise(resolve => setTimeout(resolve, wait * 1000));
    }

    static async microPause() {
        const min = DEFAULTS.MICRO_PAUSE_MIN;
        const max = DEFAULTS.MICRO_PAUSE_MAX;
        const wait = min + Math.floor(Math.random() * (max - min));
        return new Promise(resolve => setTimeout(resolve, wait));
    }

    /**
     * Simulates human-like mouse movement using cubic Bezier curves.
     * @param {object} page - Playwright page object
     * @param {string|object} selectorOrLocator - CSS selector string or Playwright Locator
     */
    static async slowMouseMove(page, selectorOrLocator) {
        try {
            // ...
            let box = await element.boundingBox();

            if (!box) {
                // Try to scroll into view native if box missing
                try {
                    await element.scrollIntoViewIfNeeded();
                    box = await element.boundingBox();
                } catch (e) { }

                if (!box) {
                    Logger.debug(`slowMouseMove: Element not visible/found: ${typeof selectorOrLocator === 'string' ? selectorOrLocator : 'Locator'}`);
                    return;
                }
            }

            const targetX = box.x + (box.width * 0.2) + Math.random() * (box.width * 0.6);
            const targetY = box.y + (box.height * 0.2) + Math.random() * (box.height * 0.6);

            const viewport = page.viewportSize();
            const startX = this.lastX || (viewport ? Math.random() * viewport.width : 0);
            const startY = this.lastY || (viewport ? Math.random() * viewport.height : 0);

            const deltaX = targetX - startX;
            const deltaY = targetY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Control points for subtler curves
            const deviation = Math.max(50, distance * 0.25);

            const control1X = startX + (deltaX * 0.33) + (Math.random() - 0.5) * deviation;
            const control1Y = startY + (deltaY * 0.33) + (Math.random() - 0.5) * deviation;

            const control2X = startX + (deltaX * 0.66) + (Math.random() - 0.5) * deviation;
            const control2Y = startY + (deltaY * 0.66) + (Math.random() - 0.5) * deviation;

            // Variation in steps for speed (Faster: 10 to 25 steps)
            const steps = 10 + Math.floor(Math.random() * 15);

            for (let i = 1; i <= steps; i++) {
                const t = i / steps;

                // Smoothstep for realistic acceleration
                const smoothT = t * t * (3 - 2 * t);

                const x = Math.pow(1 - smoothT, 3) * startX +
                    3 * Math.pow(1 - smoothT, 2) * smoothT * control1X +
                    3 * (1 - smoothT) * Math.pow(smoothT, 2) * control2X +
                    Math.pow(smoothT, 3) * targetX;

                const y = Math.pow(1 - smoothT, 3) * startY +
                    3 * Math.pow(1 - smoothT, 2) * smoothT * control1Y +
                    3 * (1 - smoothT) * Math.pow(smoothT, 2) * control2Y +
                    Math.pow(smoothT, 3) * targetY;

                await page.mouse.move(x, y);

                if (Math.random() > 0.8) {
                    await this.microPause();
                }
            }

            this.lastX = targetX;
            this.lastY = targetY;

            await page.mouse.move(targetX, targetY);

        } catch (error) {
            // Ignore benign errors (e.g. element detached)
        }
    }

    /**
     * Physics-based smooth scroll using mouse wheel to find an element.
     * @param {object} page 
     * @param {object} locator 
     */
    /**
     * Robust smooth scroll to element using native browser behavior + random adjustment.
     * @param {object} page
     * @param {object} locator
     */
    static async smoothScrollTo(page, locator) {
        try {
            // First ensure it's attached
            await locator.waitFor({ state: 'attached', timeout: 5000 });

            // 1. Native Smooth Scroll to center (Handles sticky headers best)
            await locator.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }));

            // 2. Wait for scroll to finish visually
            await this.randomWait(0.5, 1);

            // Extra safety: Scroll "up" slightly to ensure header doesn't cover it
            // LinkedIn header is approx 60px. Moving content down 100px is safe.
            await page.mouse.wheel(0, -100);
            await this.microPause();

            // 3. Small random correction with mouse to simulate human adjustment (Optional)
            // This is "super stealth" - scrolling slightly after arriving
            if (Math.random() > 0.5) {
                const delta = (Math.random() - 0.5) * 100;
                await page.mouse.wheel(0, delta);
                await this.microPause();
            }

        } catch (e) {
            // Fallback to instant scroll if smooth fails
            try { await locator.scrollIntoViewIfNeeded(); } catch (z) { }
        }
    }

    /**
     * Simulates a user "reading" or being idle.
     * Moves mouse randomly and scrolls up/down slightly.
     * @param {object} page 
     */
    static async performRandomIdle(page) {
        try {
            // 1. Move mouse to a random safe spot
            const viewport = page.viewportSize();
            if (viewport) {
                const x = Math.random() * viewport.width * 0.8 + viewport.width * 0.1;
                const y = Math.random() * viewport.height * 0.8 + viewport.height * 0.1;
                await page.mouse.move(x, y, { steps: 10 });
            }

            await this.randomWait(1, 3);

            // 2. Random tiny scroll (Reading behavior)
            if (Math.random() > 0.5) {
                const scrollAmount = (Math.random() - 0.5) * 300; // Up or down
                await page.mouse.wheel(0, scrollAmount);
                await this.randomWait(1, 2);
            }
        } catch (e) {
            // Ignore idle errors
        }
    }
}

module.exports = InteractionUtils;
