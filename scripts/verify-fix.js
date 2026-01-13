const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const { SELECTORS } = require('../src/config/constants');

chromium.use(stealthPlugin());

const userDataPath = path.join(os.homedir(), 'Library/Application Support/LinkedIn CV Downloader');
const stateFilePath = path.join(userDataPath, 'job_state.json');

(async () => {
    console.log('Starting Automated Verification...');

    // 1. Get URL
    let targetUrl = 'https://www.linkedin.com/hiring/jobs/4351950958/applicants'; // Default/Fallback
    try {
        if (fs.existsSync(stateFilePath)) {
            const state = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
            if (state.applicantsUrl) {
                targetUrl = state.applicantsUrl;
                console.log(`Found URL in state: ${targetUrl}`);
            }
        }
    } catch (e) {
        console.warn('Could not read state file, using fallback URL.');
    }

    console.log(`Target URL: ${targetUrl}`);

    try {
        // 2. Launch Browser (Headless, Persistent)
        const context = await chromium.launchPersistentContext(userDataPath, {
            headless: false, // VISIBLE for user manual verification
            channel: 'chrome',
            slowMo: 100, // Slow down operations slightly for visibility
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--viewport-size=1920,1080'
            ],
            viewport: { width: 1920, height: 1080 }
        });

        const page = context.pages()[0] || await context.newPage();

        console.log('Navigating...');
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for list
        try {
            await page.waitForSelector(SELECTORS.APPLICATION_LIST, { timeout: 15000 });
        } catch (e) {
            console.log('List selector not found immediately. Taking screenshot anyway.');
        }

        console.log('Analyzing click targets...');

        // 3. Highlight
        const analysis = await page.evaluate((selectors) => {
            const applicants = document.querySelectorAll(selectors.APPLICATION_LIST);
            const results = { total: applicants.length, safe: 0, unsafe: 0 };

            applicants.forEach((node) => {
                // Visualize SAFE zones (Subtitle/Caption)
                const safes = node.querySelectorAll(selectors.APPLICANT_CLICK_TARGET);
                if (safes.length > 0) {
                    safes.forEach(s => {
                        s.style.border = '2px solid #00FF00'; // GREEN
                        s.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
                    });
                    results.safe++;
                } else {
                    node.style.border = '2px solid red';
                }

                // Visualize UNSAFE zones (Name Link)
                const nameLink = node.querySelector(selectors.APPLICANT_NAME);
                if (nameLink) {
                    nameLink.style.border = '2px dashed red';
                    nameLink.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
                }
            });
            return results;
        }, SELECTORS);

        console.log(`Analysis Result: ${JSON.stringify(analysis)}`);

        // 4. Screenshot
        const screenshotPath = path.join(process.cwd(), 'verification_fix.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to: ${screenshotPath}`);

        await context.close();

    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
})();
