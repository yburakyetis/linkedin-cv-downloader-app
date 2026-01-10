# LinkedIn CV Downloader (Electron)

A professional Electron.js application for HR professionals to automatically download CVs from LinkedIn job applicant pages. This tool uses Playwright with stealth capabilities to automate the CV download process while maintaining human-like behavior to avoid detection.

## Features

- 🚀 **Automated CV Downloads**: Automatically processes LinkedIn job applicant pages and downloads CVs
- 🔐 **Session Persistence**: Saves your LinkedIn login session to avoid repeated logins
- 🎭 **Stealth Mode**: Uses advanced anti-bot detection techniques to mimic human behavior
- 🖱️ **Human-like Interactions**: Implements randomized delays and slow mouse movements
- 📊 **Progress Tracking**: Real-time progress updates and download logs
- 🎨 **Modern UI**: Clean, professional HR dashboard interface

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Steps

1. **Navigate to the project directory:**
   ```bash
   cd linkedin-cv-downloader-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

   This will install:
   - Electron (desktop application framework)
   - Playwright (browser automation)
   - Playwright-extra (enhanced Playwright with plugin support)
   - Playwright-extra-plugin-stealth (anti-bot detection evasion)

3. **Install Playwright browsers (if not already installed):**
   ```bash
   npx playwright install chromium
   ```

## Running the Application

Start the application using:

```bash
npm start
```

This will launch the Electron application window.

## How to Use

### For Non-Technical HR Staff

#### First-Time Setup

1. **Launch the Application**
   - Double-click the application or run `npm start` from the terminal
   - The application window will open with a clean dashboard interface

2. **Initial Login**
   - When you click "Start Download" for the first time, a browser window will open
   - You will be automatically redirected to LinkedIn's login page
   - **Log in with your LinkedIn account credentials**
   - Wait for the login to complete (the application will wait 15 seconds for you to finish)
   - Your session will be saved automatically - you won't need to log in again unless you reset the session

#### Downloading CVs

1. **Fill in the Form Fields:**
   - **APPLICANTS_URL**: 
     - Go to your LinkedIn job posting
     - Navigate to the "Applicants" tab
     - Copy the full URL from your browser's address bar
     - Paste it into this field
     - Example: `https://www.linkedin.com/hiring/jobs/123456789/applicants/987654321`
   
   - **MAX_CV_COUNT**: 
     - Enter the maximum number of CVs you want to download
     - Default is 250
     - The process will stop once this limit is reached
   
   - **MIN_WAIT** (seconds):
     - Minimum time to wait between actions (in seconds)
     - Default is 5 seconds
     - This helps make the automation look more human-like
   
   - **MAX_WAIT** (seconds):
     - Maximum time to wait between actions (in seconds)
     - Default is 30 seconds
     - The application will randomly wait between MIN_WAIT and MAX_WAIT

2. **Start the Download:**
   - Click the **"Start Download"** button
   - A browser window will open (or use your existing session)
   - The application will automatically:
     - Navigate to the applicants page
     - Click on each applicant
     - Download their CV if available
     - Move to the next page if there are more applicants
   - You can watch the progress in the status box and log output

3. **Monitor Progress:**
   - The status box shows current operation status
   - The progress bar indicates overall completion percentage
   - The log output shows detailed information about each action
   - CVs are saved to your `Downloads/LinkedIn_CVs` folder

4. **Completion:**
   - The process will stop when:
     - The maximum CV count is reached
     - All applicants on all pages have been processed
   - A success message will display the total number of CVs downloaded

#### Resetting Your Session

If you need to log in with a different LinkedIn account:

1. Click the **"Reset Session"** button
2. Confirm the action when prompted
3. The next time you start a download, you'll be asked to log in again
4. Your new session will be saved automatically

### Important Notes

- **Session Security**: Your LinkedIn session is stored locally in the `user_data` folder. Never share this folder with others.
- **Download Location**: All CVs are saved to `~/Downloads/LinkedIn_CVs/` (or `C:\Users\YourName\Downloads\LinkedIn_CVs\` on Windows)
- **Rate Limiting**: The application includes randomized delays to avoid triggering LinkedIn's rate limits. Adjust MIN_WAIT and MAX_WAIT if you experience issues.
- **Browser Window**: The browser window will remain open during the automation process. Do not close it manually.
- **Interruptions**: If you need to stop the process, close the browser window or the application. Your session will still be saved.

## Technical Details

### Project Structure

```
linkedin-cv-downloader-app/
├── src/
│   ├── main/               # Electron main process
│   │   ├── main.js        # Entry point
│   │   ├── window-manager.js
│   │   └── ipc-handlers.js
│   ├── renderer/           # Frontend logic
│   │   └── renderer.js    # UI Controller & Logic
│   ├── services/           # Business Logic
│   │   └── automation/    # Automation domain
│   ├── config/             # Configuration
│   │   └── constants.js
│   ├── utils/              # Shared Utilities
│   └── preload.js          # Secure IPC bridge
├── index.html              # UI markup
├── package.json           # Dependencies and scripts
├── user_data/             # Session storage (created automatically)
└── README.md              # This file
```

### How It Works

1. **Session Management**: Uses Playwright's persistent context to maintain browser sessions across runs
2. **Stealth Mode**: Implements playwright-extra-plugin-stealth to avoid bot detection
3. **Human Simulation**: 
   - Randomized delays between actions
   - Slow mouse movements to elements before clicking
   - Natural scrolling behavior
4. **Pagination**: Automatically detects and navigates through multiple pages of applicants
5. **Error Handling**: Gracefully handles missing CVs and continues processing

### Selectors Used

The application uses specific LinkedIn selectors which are configurable in `src/config/constants.js`.
- Applicant list items
- Details panel
- Download button
- Pagination buttons

## Troubleshooting

### "Session expired" or Login Required Every Time

- Click "Reset Session" and log in again
- Ensure the `user_data` folder has write permissions
- Check that your LinkedIn account is not requiring additional verification

### CVs Not Downloading

- Verify the APPLICANTS_URL is correct and accessible
- Check that you have permission to view applicants for the job posting
- Ensure the applicant has uploaded a CV (not all applicants have CVs available)
- Check the log output for specific error messages

### Browser Window Not Opening

- Ensure Playwright browsers are installed: `npx playwright install chromium`
- Check that no other process is using the required ports
- Try resetting the session

### Application Crashes

- Check the terminal/console for error messages
- Ensure all dependencies are installed: `npm install`
- Try deleting the `user_data` folder and starting fresh

## Security & Privacy

- All session data is stored locally on your machine
- No data is sent to external servers
- LinkedIn credentials are never stored - only session cookies
- The application only accesses LinkedIn through your browser session

## License

MIT

## Support

For issues or questions:
1. Check the log output in the application for specific error messages
2. Review the troubleshooting section above
3. Ensure all dependencies are up to date: `npm update`

---

## ⚠️ Legal Disclaimer

**EDUCATIONAL PURPOSES ONLY.**

This software is designed strictly for educational and testing purposes to demonstrate browser automation capabilities using Electron and Playwright.

- **LinkedIn Terms of Service**: Use of this tool may violate LinkedIn's Terms of Service regarding automated data collection (scraping). The developer assumes no liability for any account restrictions, bans, or legal consequences resulting from the use of this tool.
- **User Responsibility**: You are solely responsible for how you use this tool. Ensure you comply with all applicable laws (including GDPR/KVKK) and platform policies.
- **Privacy**: Respect the privacy of applicants. Do not share, publish, or misuse downloaded CV data.

By downloading or using this software, you agree that the developer is not liable for any damages or legal actions associated with its use.

