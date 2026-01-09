/**
 * Browser Manager
 * Handles browser instantiation, context configuration, and stealth scripts.
 */

const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const { DEFAULTS } = require('../../config/constants');

chromium.use(stealthPlugin());

class BrowserManager {
    constructor(userDataPath) {
        this.userDataPath = userDataPath;
        this.browserContext = null;
        this.page = null;
    }

    /**
     * Launches the browser with stealth settings and persistent context.
     * @returns {Promise<object>} { browserContext, page }
     */
    async launch() {
        // Use launchPersistentContext for better session persistence
        // playwright-extra wraps the standard chromium object
        this.browserContext = await chromium.launchPersistentContext(this.userDataPath, {
            headless: false,
            channel: 'chrome', // Try to use actual Chrome if available, falls back to bundled
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-infobars',
                '--window-position=0,0',
                '--ignore-certifcate-errors',
                '--ignore-certifcate-errors-spki-list',
            ],
            viewport: null, // Allow window to determine viewport (maximized)
            acceptDownloads: true,
            // User-Agent is now handled dynamically or by defaults to avoid mismatch
            locale: DEFAULTS.LOCALE,
            timezoneId: DEFAULTS.TIMEZONE,
            permissions: ['geolocation']
        });

        this.page = this.browserContext.pages()[0] || await this.browserContext.newPage();

        // Extra safety: Verify stealth measures
        await this.verifyStealth(this.page);

        return {
            browserContext: this.browserContext,
            page: this.page
        };
    }

    async verifyStealth(page) {
        try {
            const webdriver = await page.evaluate(() => navigator.webdriver);
            if (webdriver) {
                console.warn('WARNING: navigator.webdriver is still true!');
            }
        } catch (e) {
            // Ignore errors during verification
        }
    }

    async close() {
        if (this.browserContext) {
            await this.browserContext.close();
            this.browserContext = null;
            this.page = null;
        }
    }
}

module.exports = BrowserManager;
