/**
 * Application Constants & Configuration
 * Centralized place for all selectors, timeouts, and default values.
 */

const SELECTORS = {
    APPLICATION_LIST: 'li.hiring-applicants__list-item',
    DETAILS_PANEL: '#hiring-detail-root',
    DOWNLOAD_BUTTON: 'a.inline-flex.align-items-center.link-without-visited-state[href]',
    PAGINATION_PAGE_ITEMS: 'li[data-test-pagination-page-btn]',
    ACTIVE_PAGE_BUTTON: 'button[aria-current="true"]',
    JOB_TITLE: '.artdeco-entity-lockup__title',
    // Specific selectors for robust finding
    PAGINATION_BUTTON: 'button',
    NEXT_PAGE_BUTTON_CONTAINER: 'li[data-test-pagination-page-btn]',
};

const TIMEOUTS = {
    DETAILS_PANEL: 25000,
    DOWNLOAD_BUTTON_ATTACH: 25000,
    DOWNLOAD_EVENT: 30000,
    NAVIGATE_APPLICANTS: 60000,
    APPLICANTS_LIST_VISIBLE: 30000,
    MANUAL_LOGIN_WAIT: 15000,
    CHECK_LOGIN_TIMEOUT: 10000,
    PAGE_LOAD_WAIT: 3000,
};

const DEFAULTS = {
    USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    LOCALE: 'en-US',
    TIMEZONE: 'Europe/Istanbul',
    VIEWPORT: { width: 1280, height: 720 }, // Fallback if start-maximized fails
    WINDOW_WIDTH: 900,
    WINDOW_HEIGHT: 800,
    MIN_WAIT_SECONDS: 3,
    MAX_WAIT_SECONDS: 8,
    MICRO_PAUSE_MIN: 300,
    MICRO_PAUSE_MAX: 700,
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
