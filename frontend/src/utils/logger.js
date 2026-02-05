/**
 * Frontend Logger Utility - Environment-based Console Control
 * 
 * Di Production (process.env.NODE_ENV === 'production'):
 *   - Semua console.log HIDDEN (tidak muncul di browser)
 *   - Hanya error yang tetap muncul
 * 
 * Di Development:
 *   - Semua log muncul normal
 * 
 * Usage:
 *   import logger from './utils/logger';
 *   logger.log('Normal log');
 *   logger.info('Info message');
 *   logger.warn('Warning');
 *   logger.error('Error - selalu muncul');
 *   logger.debug('Debug message');
 * 
 * Untuk mengaktifkan log di production (debugging):
 *   - Set REACT_APP_DEBUG_MODE=true di .env
 *   - Atau di browser console: localStorage.setItem('debug', 'true')
 */

const isProduction = process.env.NODE_ENV === 'production';
const isDebugEnabled = process.env.REACT_APP_DEBUG_MODE === 'true' ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('debug') === 'true');

const logger = {
    /**
     * Normal log - Hidden in production
     */
    log: (...args) => {
        if (!isProduction || isDebugEnabled) {
            console.log(...args);
        }
    },

    /**
     * Info - Hidden in production
     */
    info: (...args) => {
        if (!isProduction || isDebugEnabled) {
            console.info('[INFO]', ...args);
        }
    },

    /**
     * Debug - Hidden in production
     */
    debug: (...args) => {
        if (!isProduction || isDebugEnabled) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Warn - Always visible (important for monitoring)
     */
    warn: (...args) => {
        console.warn('[WARN]', ...args);
    },

    /**
     * Error - Always visible (critical for debugging)
     */
    error: (...args) => {
        console.error('[ERROR]', ...args);
    },

    /**
     * Group - Hidden in production
     */
    group: (label) => {
        if (!isProduction || isDebugEnabled) {
            console.group(label);
        }
    },

    /**
     * Group End - Hidden in production
     */
    groupEnd: () => {
        if (!isProduction || isDebugEnabled) {
            console.groupEnd();
        }
    },

    /**
     * Table - Hidden in production
     */
    table: (data) => {
        if (!isProduction || isDebugEnabled) {
            console.table(data);
        }
    },

    /**
     * Enable debug mode at runtime (useful for production debugging)
     */
    enableDebug: () => {
        localStorage.setItem('debug', 'true');
        console.log('[LOGGER] Debug mode enabled. Refresh the page to see all logs.');
    },

    /**
     * Disable debug mode
     */
    disableDebug: () => {
        localStorage.removeItem('debug');
        console.log('[LOGGER] Debug mode disabled. Refresh the page to hide logs.');
    }
};

// Make logger available globally for console access (debugging)
if (typeof window !== 'undefined') {
    window.appLogger = logger;
}

export default logger;
