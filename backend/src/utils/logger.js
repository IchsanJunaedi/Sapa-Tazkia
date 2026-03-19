// backend/src/utils/logger.js
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const isDebugEnabled = process.env.DEBUG_MODE === 'true' || process.env.RATE_LIMIT_DEBUG === 'true';

// ─── Formats ───────────────────────────────────────────────────────────────

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// ─── Transports ────────────────────────────────────────────────────────────

const transports = [
  new winston.transports.Console({
    format: isProduction ? jsonFormat : devFormat,
    silent: false
  })
];

if (isProduction || process.env.LOG_TO_FILE === 'true') {
  const logsDir = path.join(__dirname, '../../logs');

  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      format: jsonFormat,
      level: 'debug'
    })
  );

  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      format: jsonFormat,
      level: 'error'
    })
  );
}

// ─── Base Winston instance ──────────────────────────────────────────────────

const winstonLogger = winston.createLogger({
  level: isProduction && !isDebugEnabled ? 'warn' : 'debug',
  transports
});

// ─── Public API (drop-in replacement for old Logger class) ─────────────────

const logger = {
  /**
   * Info — hidden in production unless DEBUG_MODE=true
   */
  info(message, ...args) {
    if (!isProduction || isDebugEnabled) {
      winstonLogger.info(message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
    }
  },

  /**
   * Error — always logged
   */
  error(message, ...args) {
    winstonLogger.error(message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  },

  /**
   * Warn — always logged
   */
  warn(message, ...args) {
    winstonLogger.warn(message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  },

  /**
   * Debug — hidden in production unless DEBUG_MODE=true
   */
  debug(message, ...args) {
    if (!isProduction || isDebugEnabled) {
      winstonLogger.debug(message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
    }
  },

  /**
   * Security — always logged (audit trail)
   */
  security(message, ...args) {
    winstonLogger.warn(`[SECURITY] ${message}`, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  },

  /**
   * Request — HTTP logging, dev only
   */
  request(method, url, status) {
    if (!isProduction || isDebugEnabled) {
      winstonLogger.debug(`[REQUEST] ${method} ${url} - ${status}`);
    }
  },

  /**
   * RateLimit — alias for debug, used in rateLimitService/rateLimitMiddleware
   */
  rateLimit(message, ...args) {
    if (!isProduction || isDebugEnabled) {
      winstonLogger.debug(`[RATE LIMIT] ${message}`, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
    }
  },

  /**
   * Redis — alias for debug, used in redisService
   */
  redis(message, ...args) {
    if (!isProduction || isDebugEnabled) {
      winstonLogger.debug(`[REDIS] ${message}`, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
    }
  }
};

module.exports = logger;
