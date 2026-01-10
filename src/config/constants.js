/**
 * Application Constants & Configuration
 * Centralized place for all selectors, timeouts, and default values.
 */

const SELECTORS = {
    APPLICATION_LIST: 'li.hiring-applicants__list-item',
    DETAILS_PANEL: '#hiring-detail-root',
    DOWNLOAD_BUTTON: 'a.inline-flex.align-items-center.link-without-visited-state[href]',
    DOWNLOAD_BUTTON: 'a.inline-flex.align-items-center.link-without-visited-state[href], a:has(svg[data-test-icon="download-medium"])',
    DOWNLOAD_BUTTON_FALLBACK: '.artdeco-card a[href]:has(svg)',
    DOWNLOAD_BUTTON_BROAD: 'a[download], a[href$=".pdf"], button[aria-label*="Download"], a[aria-label*="Download"], a[aria-label*="indir"], a[aria-label*="İndir"]', // Catch-all including Turkish
    // Dropdown menu selectors
    MORE_ACTIONS_BUTTON: 'button[aria-label*="More actions"], button[aria-label*="Diğer işlemler"], .artdeco-dropdown__trigger',
    DOWNLOAD_MENU_ITEM: '.artdeco-dropdown__content a[href]:has(svg), .artdeco-dropdown__content a[href]:has-text("Download"), .artdeco-dropdown__content a[href]:has-text("İndir")',

    PAGINATION_PAGE_ITEMS: '.artdeco-pagination__pages li', // Broadened to include ellipsis items that might lack data attributes
    ACTIVE_PAGE_BUTTON: 'button[aria-current="true"]',
    JOB_TITLE: '.artdeco-entity-lockup__title',
    APPLICANT_NAME: '.artdeco-entity-lockup__title a', // Target the link specifically to avoid subtitles/labels
    // Specific selectors for robust finding
    PAGINATION_BUTTON: 'button',
    NEXT_PAGE_BUTTON_CONTAINER: 'li[data-test-pagination-page-btn]',
    MSG_OVERLAY: '#msg-overlay',
    VIRUS_SCAN_SECTION: '.hiring-resume-viewer__virus-scan-section',
};

const TIMEOUTS = {
    DETAILS_PANEL: 25000,
    DOWNLOAD_BUTTON_ATTACH: 8000, // Increased to 8s for better reliability on slow loads
    DOWNLOAD_EVENT: 30000,
    DOWNLOAD_EVENT: 30000,
    NAVIGATE_APPLICANTS: 60000,
    APPLICANTS_LIST_VISIBLE: 30000,
    MANUAL_LOGIN_WAIT: 300000, // Increased to 5 minutes per user request
    CHECK_LOGIN_TIMEOUT: 10000,
    PAGE_LOAD_WAIT: 3000,
    RETRY_WAIT: 2000, // Wait before retry click
    SCROLL_TIMEOUT: 5000,
};

const DEFAULTS = {
    // USER_AGENT removed to prevent mismatch with browser version. Managed dynamically or by browser.
    LOCALE: 'en-US',
    TIMEZONE: 'Europe/Istanbul',
    VIEWPORT: { width: 1280, height: 720 }, // Fallback if start-maximized fails
    WINDOW_WIDTH: 900,
    WINDOW_HEIGHT: 800,
    MIN_WAIT_SECONDS: 4,
    MAX_WAIT_SECONDS: 7,
    PAGE_WAIT_MIN: 5,
    PAGE_WAIT_MAX: 10,
    MICRO_PAUSE_MIN: 300,
    MICRO_PAUSE_MAX: 600,
    RETRY_ATTEMPTS: 7,
    // Stealth behaviors
    BREAK_INTERVAL: 30, // Take a break every N applicants
    BREAK_DURATION_MIN: 15,
    BREAK_DURATION_MAX: 65,
    MAX_CV_COUNT: 500,
};

// Paths
const PATHS = {
    USER_DATA: 'user_data',
    SESSION_FILE: 'session.json',
    DOWNLOADS_BASE_DIR: 'LinkedIn_CVs',
};

module.exports = {
    SELECTORS,
    TIMEOUTS,
    DEFAULTS,
    PATHS,
};
