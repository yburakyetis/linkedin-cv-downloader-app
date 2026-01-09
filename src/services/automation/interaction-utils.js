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
    /**
     * Simulates human-like mouse movement using cubic Bezier curves.
     * @param {object} page - Playwright page object
     * @param {string} selector - CSS selector
     */
    static async slowMouseMove(page, selector) {
        try {
            const element = await page.locator(selector).first();
            const box = await element.boundingBox();
            if (!box) return;

            // Goal: random point within the element
            const targetX = box.x + (box.width * 0.2) + Math.random() * (box.width * 0.6);
            const targetY = box.y + (box.height * 0.2) + Math.random() * (box.height * 0.6);

            // Get current mouse position (tracking might be imperfect in Playwright)
            // We'll trust Playwright knows where it is, or assume viewport center if fresh.
            // But to make a curve, we need a start point. 
            // We can't query current position easily without tracking it ourselves.
            // Workaround: We define a "virtual" start point or just direct page.mouse.move with steps.
            // Better: Playwright's mouse.move(x, y, { steps: n }) is linear.
            // WE MUST manual move loop.

            // Since we can't reliably get current X/Y, we might assume we are at (0,0) or tracking.
            // Strategy: We will just move from "somewhere" to target. 
            // If we don't know where we are, we can't draw a curve FROM there.
            // Assumption: Let's assume the mouse is likely at the last interacted element or (0,0).
            // But without state, effective curving is hard.
            // However, we can curve relative to the viewport size to simulate "coming from elsewhere".

            // Let's rely on the user's last known previous move or just do a jittery move.
            // Actually, we can get a "start" by assuming 0,0 if unknown, but better:
            // Just move to the target with "steps" in Playwright but add jitter? No, that's linear.

            // Let's implement a "Move from current" logic by tracking it in a static var if possible?
            // Static properties on the class?
            // 'this.lastX', 'this.lastY'

            // For now, let's try to fetch if possible or default to a random edge of screen.
            const viewport = page.viewportSize();
            let startX = this.lastX || (viewport ? Math.random() * viewport.width : 0);
            let startY = this.lastY || (viewport ? Math.random() * viewport.height : 0);

            // Control points for Bezier Curve (Cubic)
            // To create a more "human" arc, we need control points that pull away from the straight line.
            // We calculate the vector from start to target, then find a perpendicular vector.

            const deltaX = targetX - startX;
            const deltaY = targetY - startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Random arc direction (1 or -1)
            const arcDirection = Math.random() > 0.5 ? 1 : -1;

            // Random arc intensity (how much it bulges). Higher = wider curve.
            // For a natural movement, the arc depends on distance but also has some randomness.
            const arcIntensity = 0.2 + Math.random() * 0.4; // 0.2 to 0.6 of distance

            // Perpendicular vector (-y, x) normalized * distance * intensity * direction
            // P1 (first control point) should be closer to start but pushed out
            // P2 (second control point) should be closer to target but pushed out (maybe same side, maybe weird S-curve)

            // Let's do a simple "Same side arc" which looks like a hand swing.
            // Or an S-curve. Humans usually do arcs.

            // Control Point 1: 1/3 of the way + arc offset
            const p1OffsetX = -deltaY * 0.5 * (Math.random() - 0.5); // Perpendicular noise
            const p1OffsetY = deltaX * 0.5 * (Math.random() - 0.5);

            // A strong pull creates the arc. Let's maximize deviation.
            // Instead of complex math, let's just pick two random points in a broad rectangle around the path,
            // but ensure they aren't on the line.

            // Control point adjustments for arc reduction
            // Decreased deviation multiplier from 0.5 to 0.25 for subtler curves
            const deviation = Math.max(50, distance * 0.25); // Minimum 50px deviation

            const control1X = startX + (deltaX * 0.33) + (Math.random() - 0.5) * deviation;
            const control1Y = startY + (deltaY * 0.33) + (Math.random() - 0.5) * deviation;

            const control2X = startX + (deltaX * 0.66) + (Math.random() - 0.5) * deviation;
            const control2Y = startY + (deltaY * 0.66) + (Math.random() - 0.5) * deviation;

            // Variation in steps for speed
            const steps = 30 + Math.floor(Math.random() * 30);

            for (let i = 1; i <= steps; i++) {
                const t = i / steps;

                // Ease-in-out timing function for 't' to simulate acceleration/deacceleration
                // Smoothstep: t * t * (3 - 2 * t)
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

                // Micro pauses less frequent but existent
                if (Math.random() > 0.8) {
                    await this.microPause();
                }
            }

            // Update last known position
            this.lastX = targetX;
            this.lastY = targetY;

            // Final check: perform a tiny overshoot and correction?
            // Maybe just ensure we are exactly on target at the end.
            await page.mouse.move(targetX, targetY);

        } catch (error) {
            // Logic to survive if element is gone
        }
    }
}

module.exports = InteractionUtils;
