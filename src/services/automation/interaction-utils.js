/**
 * Interaction Utils
 * Helper functions for human-like interactions to avoid bot detection.
 */

const { DEFAULTS } = require('../../config/constants');

class InteractionUtils {
    /**
     * Random wait between min and max seconds.
     * @param {number} minSec 
     * @param {number} maxSec 
     */
    static async randomWait(minSec, maxSec) {
        const wait = minSec + Math.floor(Math.random() * (maxSec - minSec + 1));
        return new Promise(resolve => setTimeout(resolve, wait * 1000));
    }

    /**
     * Small pause for micro-interactions (milliseconds).
     */
    static async microPause() {
        const min = DEFAULTS.MICRO_PAUSE_MIN;
        const max = DEFAULTS.MICRO_PAUSE_MAX;
        const wait = min + Math.floor(Math.random() * (max - min));
        return new Promise(resolve => setTimeout(resolve, wait));
    }

    /**
     * Simulates slow human-like mouse movement to an element.
     * @param {object} page - Playwright page object
     * @param {string} selector - CSS selector
     */
    static async slowMouseMove(page, selector) {
        try {
            const element = await page.locator(selector).first();
            const box = await element.boundingBox();
            if (box) {
                // Move mouse slowly to element center
                const centerX = box.x + box.width / 2;
                const centerY = box.y + box.height / 2;
                const steps = 10;

                // Get current mouse position (approximate from viewport center, as we can't easily get it)
                const viewport = page.viewportSize();
                const startX = viewport ? viewport.width / 2 : 0;
                const startY = viewport ? viewport.height / 2 : 0;

                // Calculate step increments
                const stepX = (centerX - startX) / steps;
                const stepY = (centerY - startY) / steps;

                for (let i = 1; i <= steps; i++) {
                    const x = startX + stepX * i;
                    const y = startY + stepY * i;
                    await page.mouse.move(x, y);
                    await this.microPause();
                }
                // Final move to exact center
                await page.mouse.move(centerX, centerY);
            }
        } catch (error) {
            // If mouse movement fails (element not found etc), just continue
            // We don't want to crash the automation for a cosmetic/stealth feature
        }
    }
}

module.exports = InteractionUtils;
