(function (global) {
    var en = {
        // Header
        'app.title': 'LinkedIn CV Downloader',
        'app.subtitle': 'Automated CV download tool for HR professionals',

        // Form Labels
        'label.applicantsUrl': 'APPLICANTS PAGE URL',
        'label.maxCvCount': 'MAX CVS',
        'label.startPage': 'START PAGE',
        'label.minWait': 'MIN WAIT (SEC)',
        'label.maxWait': 'MAX WAIT (SEC)',
        'label.pageWaitMin': 'PAGE WAIT MIN (SEC)',
        'label.pageWaitMax': 'PAGE WAIT MAX (SEC)',
        'label.stealthSettings': 'Stealth Settings',
        'label.breakInterval': 'BREAK INTERVAL (CVS)',
        'label.breakDurationMin': 'BREAK MIN (SEC)',
        'label.breakDurationMax': 'BREAK MAX (SEC)',
        'hint.breakInterval': 'Takes a random break between Min-Max durations after every N downloads',
        'hint.applicantWait': 'Waits a random duration between Min-Max after each CV',
        'hint.pageWait': 'Waits a random duration between Min-Max during page transitions',

        // Buttons
        'btn.start': 'Start',
        'btn.pause': 'Pause',
        'btn.continue': 'Continue',
        'btn.stop': 'Stop',
        'btn.close': 'Close',
        'btn.reset': 'Logout / Reset',
        'btn.resumeSession': 'Resume Session',
        'btn.discardSession': 'Discard & New',

        // Dashboard
        'stat.processed': 'Processed',
        'stat.success': 'Successful',
        'stat.failed': 'Failed / Skipped',
        'header.failedList': 'FAILED APPLICANTS',
        'report.title': 'Process Report',
        'label.saveLocation': 'SAVE LOCATION',

        // Messages
        // Tooltips
        'tooltip.start': 'Starts the download process with current settings',
        'tooltip.pause': 'Temporarily pauses the operation',
        'tooltip.stop': 'Permanently stops the download process',
        'tooltip.reset': 'Logs out and clears all session data',

        'msg.loginRequired': 'Login required. Please log in to LinkedIn in the browser window.',
        'msg.waitingAuth': 'Waiting for manual authentication (Max 5 mins)...',
        'msg.sessionSaved': 'Session state saved successfully.',
        'msg.usingSession': 'Using existing session.',
        'msg.resuming': 'Resuming previous session...',
        'msg.starting': 'Starting download process...',
        'msg.stopping': 'Stopping download... Please wait.',
        'msg.paused': 'Process paused. Click Continue to resume.',
        'msg.completed': 'Download completed!',
        'msg.error': 'Error:',
        'msg.noFailures': '✨ No failures! All good.',

        // Prompts
        'prompt.stop': 'Are you sure you want to stop the download?',
        'prompt.reset': 'Are you sure you want to log out and clear all session data? You will need to log in again next time.',

        // Placeholders
        'placeholder.url': 'https://www.linkedin.com/hiring/jobs/.../applicants/...',
        // Banner & Footer
        'banner.sessionActive': 'Active Session Found',
        'banner.sessionInfo': 'Settings loaded from previous session. Click Start to resume.',
        'footer.note': 'Note: Log in manually on first use. Session auto-saved.',
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = en;
    }
    if (global) {
        global.locales_en = en;
    }
})(typeof window !== 'undefined' ? window : this);
