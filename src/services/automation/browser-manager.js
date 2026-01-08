/**
 * Browser Manager
 * Handles browser instantiation, context configuration, and stealth scripts.
 */

const playwright = require('playwright');
const path = require('path');
const { DEFAULTS } = require('../../config/constants');

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
        this.browserContext = await playwright.chromium.launchPersistentContext(this.userDataPath, {
            headless: false,
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled'
            ],
            viewport: null, // Allow window to determine viewport (maximized)
            acceptDownloads: true,
            userAgent: DEFAULTS.USER_AGENT,
            locale: DEFAULTS.LOCALE,
            timezoneId: DEFAULTS.TIMEZONE,
            permissions: ['geolocation']
        });

        this.page = this.browserContext.pages()[0] || await this.browserContext.newPage();

        await this.applyStealthScripts(this.page);

        return {
            browserContext: this.browserContext,
            page: this.page
        };
    }

    /**
     * Injects scripts to mask automation from detection.
     * @param {object} page 
     */
    async applyStealthScripts(page) {
        await page.addInitScript(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });

            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // Chrome runtime
            window.chrome = {
                runtime: {},
            };

            // Permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });
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
