// backend/src/utils/logger.js

/**
 * Simple logger utility untuk rate limit system
 * Replace dengan logger yang lebih robust di production
 */

class Logger {
  constructor() {
    this.isDebug = process.env.RATE_LIMIT_DEBUG === 'true' || process.env.NODE_ENV === 'development';
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  info(message, ...args) {
    console.log(`[${this.getTimestamp()}] ℹ️ [INFO] ${message}`, ...args);
  }

  error(message, ...args) {
    console.error(`[${this.getTimestamp()}] 🔴 [ERROR] ${message}`, ...args);
  }

  warn(message, ...args) {
    console.warn(`[${this.getTimestamp()}] ⚠️ [WARN] ${message}`, ...args);
  }

  debug(message, ...args) {
    if (this.isDebug) {
      console.log(`[${this.getTimestamp()}] 🔍 [DEBUG] ${message}`, ...args);
    }
  }

  // Khusus rate limit logging
  rateLimit(message, ...args) {
    console.log(`[${this.getTimestamp()}] 🛡️ [RATE LIMIT] ${message}`, ...args);
  }

  // Khusus Redis logging
  redis(message, ...args) {
    if (this.isDebug) {
      console.log(`[${this.getTimestamp()}] 🗄️ [REDIS] ${message}`, ...args);
    }
  }
}

// Export singleton instance
module.exports = new Logger();