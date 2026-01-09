/**
 * Interaction Utils
 * Helper functions for human-like interactions to avoid bot detection.
 */

const { DEFAULTS } = require('../../config/constants');

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
            let element;
            if (typeof selectorOrLocator === 'string') {
                element = await page.locator(selectorOrLocator).first();
            } else {
                element = selectorOrLocator;
            }

            // Ensure bounding box is stable (wait for layout)
            // If it's a locator, we can rely on it being resolved.
            let box = await element.boundingBox();

            // If box is null, try to scroll it into view naturally first (if requested) or assume caller did it.
            // But boundingBox returns null if element is not visible/in view or detached.
            if (!box) {
                return;
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

            const steps = 30 + Math.floor(Math.random() * 30);

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
    static async smoothScrollTo(page, locator) {
        try {
            // First check if already visible
            if (await locator.isVisible()) return;

            // Get viewport height
            const viewport = page.viewportSize();
            if (!viewport) return;

            const box = await locator.evaluate(el => {
                const rect = el.getBoundingClientRect();
                return { top: rect.top, height: rect.height };
            });

            // If found
            if (box) {
                // Calculate distance to scroll
                // We want element in middle of screen (viewport.height / 2)
                const targetY = box.top - (viewport.height / 2) + (box.height / 2);

                // Scroll in chunks
                let currentScroll = 0;
                const maxScroll = Math.abs(targetY);
                const direction = targetY > 0 ? 1 : -1;

                while (currentScroll < maxScroll) {
                    // Random step size (simulate flick)
                    const step = 50 + Math.floor(Math.random() * 100);
                    const remaining = maxScroll - currentScroll;
                    const scrollAmount = Math.min(step, remaining) * direction;

                    await page.mouse.wheel(0, scrollAmount);
                    currentScroll += Math.abs(scrollAmount);

                    // Tiny friction pause
                    if (Math.random() > 0.5) {
                        await new Promise(r => setTimeout(r, 10 + Math.random() * 50));
                    }
                }
            } else {
                // Fallback
                await locator.scrollIntoViewIfNeeded();
            }

        } catch (e) {
            // Fallback if anything fails
            try { await locator.scrollIntoViewIfNeeded(); } catch (z) { }
        }
    }
}

module.exports = InteractionUtils;
