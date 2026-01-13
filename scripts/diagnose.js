const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const BrowserManager = require('../src/services/automation/browser-manager');
const { SELECTORS } = require('../src/config/constants');

// MOCK Electron app for headless usage if run with node
// Since BrowserManager requires 'app.getPath', we need to mock it if running standalone.
// However, the user can just run this script using electron? 
// Actually, 'electron-node' is a thing, but let's try to just require what we need.
// The BrowserManager takes 'userDataPath' in constructor. 
// We can just pass a hardcoded path if running outside electron context.
const os = require('os');
const userDataPath = path.join(os.homedir(), 'Library/Application Support/LinkedIn CV Downloader'); // Mac default

(async () => {
    console.log('Starting Diagnostic Tool...');
    console.log(`User Data Path: ${userDataPath}`);

    const browserManager = new BrowserManager(userDataPath);

    try {
        console.log('Launching browser...');
        const { page } = await browserManager.launch({ headless: false });

        console.log('Navigating to LinkedIn...');
        await page.goto('https://www.linkedin.com/hiring/jobs', { waitUntil: 'domcontentloaded' });

        console.log('Waiting for manual navigation to a Job Applicant page...');
        console.log('>>> PLEASE NAVIGATE TO A JOB APPLICANT LIST MANUALLY IN THE BROWSER <<<');
        console.log('>>> PRESS RETURN IN THIS TERMINAL WHEN YOU ARE THERE <<<');

        // Wait for user input
        await new Promise(resolve => process.stdin.once('data', resolve));

        console.log('Analyzing page...');

        // 1. Highlight Click Targets
        await page.evaluate((selectors) => {
            const applicants = document.querySelectorAll(selectors.APPLICATION_LIST);
            console.log(`Found ${applicants.length} applicants.`);

            applicants.forEach((node, index) => {
                // Find safe target
                const safe = node.querySelector(selectors.APPLICANT_CLICK_TARGET);
                if (safe) {
                    safe.style.border = '2px solid green';
                    safe.setAttribute('data-diag-safe', 'true');
                } else {
                    node.style.border = '2px solid red'; // No safe target found!
                }

                // Find Danger target (Name)
                const danger = node.querySelector(selectors.APPLICANT_NAME);
                if (danger) {
                    danger.style.border = '2px dashed red';
                }
            });

        }, SELECTORS);

        console.log('Taking screenshot...');
        const screenshotPath = path.join(process.cwd(), 'diagnostic_zones.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });

        console.log(`Screenshot saved to: ${screenshotPath}`);
        console.log('Check the screenshot. Green boxes = Safe Click Areas. Red Dashed = Dangerous Links.');

    } catch (error) {
        console.error('Diagnostic failed:', error);
    } finally {
        // await browserManager.close(); 
        console.log('Done. You can close the browser.');
        process.exit(0);
    }
})();
