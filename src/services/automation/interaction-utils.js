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

    static async slowMouseMove(page, selector) {
        try {
            const element = await page.locator(selector).first();
            const box = await element.boundingBox();
            if (!box) return;

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
}

module.exports = InteractionUtils;
