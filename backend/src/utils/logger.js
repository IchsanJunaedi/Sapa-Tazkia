// backend/src/utils/logger.js

/**
 * Enhanced Logger Utility - Environment-based Logging
 * 
 * Di Production (NODE_ENV=production):
 *   - info, debug, request: HIDDEN (tidak muncul)
 *   - warn, error, security: TETAP MUNCUL (penting untuk monitoring)
 * 
 * Di Development atau DEBUG_MODE=true:
 *   - Semua log muncul
 * 
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Info message');
 *   logger.debug('Debug message');
 *   logger.warn('Warning message');
 *   logger.error('Error message');
 */

class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.isDebugEnabled = process.env.DEBUG_MODE === 'true' ||
      process.env.RATE_LIMIT_DEBUG === 'true';
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Info - Hanya muncul di development atau jika DEBUG_MODE=true
   */
  info(message, ...args) {
    if (!this.isProduction || this.isDebugEnabled) {
      console.log(`[${this.getTimestamp()}] [INFO] ${message}`, ...args);
    }
  }

  /**
   * Error - SELALU muncul (critical untuk debugging)
   */
  error(message, ...args) {
    console.error(`[${this.getTimestamp()}] [ERROR] ${message}`, ...args);
  }

  /**
   * Warn - SELALU muncul (penting untuk monitoring)
   */
  warn(message, ...args) {
    console.warn(`[${this.getTimestamp()}] [WARN] ${message}`, ...args);
  }

  /**
   * Debug - Hanya muncul di development atau jika DEBUG_MODE=true
   */
  debug(message, ...args) {
    if (!this.isProduction || this.isDebugEnabled) {
      console.log(`[${this.getTimestamp()}] [DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Rate Limit - Hanya muncul jika RATE_LIMIT_DEBUG=true
   */
  rateLimit(message, ...args) {
    if (!this.isProduction || this.isDebugEnabled) {
      console.log(`[${this.getTimestamp()}] [RATE LIMIT] ${message}`, ...args);
    }
  }

  /**
   * Redis - Hanya muncul di development
   */
  redis(message, ...args) {
    if (!this.isProduction || this.isDebugEnabled) {
      console.log(`[${this.getTimestamp()}] [REDIS] ${message}`, ...args);
    }
  }

  /**
   * Security - SELALU muncul (penting untuk audit)
   */
  security(message, ...args) {
    console.log(`[${this.getTimestamp()}] [SECURITY] ${message}`, ...args);
  }

  /**
   * Request - Log HTTP requests (hanya development)
   */
  request(method, url, status) {
    if (!this.isProduction || this.isDebugEnabled) {
      console.log(`[${this.getTimestamp()}] [REQUEST] ${method} ${url} - ${status}`);
    }
  }
}

// Export singleton instance
module.exports = new Logger();