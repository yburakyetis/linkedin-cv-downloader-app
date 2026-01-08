/**
 * Logger Utility
 * Provides a standardized way to log messages to console and potentially file/UI.
 */

class Logger {
    static formatMessage(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        return `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    }

    static info(message) {
        console.log(this.formatMessage(message, 'info'));
    }

    static warn(message) {
        console.warn(this.formatMessage(message, 'warn'));
    }

    static error(message, error = null) {
        console.error(this.formatMessage(message, 'error'));
        if (error) {
            console.error(error);
        }
    }

    static debug(message) {
        if (process.env.DEBUG) {
            console.debug(this.formatMessage(message, 'debug'));
        }
    }
}

module.exports = Logger;
