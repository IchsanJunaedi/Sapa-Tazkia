const Redis = require('ioredis');

// ✅ LOGGER SETUP
let logger;
try {
  logger = require('../utils/logger');
} catch (error) {
  logger = {
    info: (...args) => console.log(`[${new Date().toISOString()}] ℹ️ [REDIS]`, ...args),
    error: (...args) => console.error(`[${new Date().toISOString()}] 🔴 [REDIS ERROR]`, ...args),
    warn: (...args) => console.warn(`[${new Date().toISOString()}] ⚠️ [REDIS WARN]`, ...args),
    debug: (...args) => { 
      if (process.env.RATE_LIMIT_DEBUG === 'true') console.log(`[${new Date().toISOString()}] 🔍 [REDIS DEBUG]`, ...args);
    }
  };
}

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false; // Status visual saja, jangan dipakai untuk blocking logika utama
    this.degradedMode = false;
    this._memoryStore = new Map();  // key → value string
    this._memoryExpiry = new Map(); // key → expiry timestamp (ms)
    this.initialize();
  }

  initialize() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    const redisPassword = process.env.REDIS_PASSWORD;

    const redisOptions = {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: false
    };

    if (redisPassword) {
      redisOptions.password = redisPassword;
    }

    try {
      this.client = new Redis(redisUrl, redisOptions);

      this.initEventListeners();
      logger.info('Redis service initialized');
    } catch (error) {
      logger.error('Failed to initialize Redis service:', error.message);
    }
  }

  initEventListeners() {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.isConnected = true;
      this.degradedMode = false;
      logger.info('✅ Redis client connected successfully');
    });

    this.client.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        this.degradedMode = true;
      } else {
        logger.error('Redis error:', err.message);
      }
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.degradedMode = true;
      logger.warn('Redis connection closed — switching to degraded mode');
    });
  }

  _memoryGet(key) {
    const expiry = this._memoryExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this._memoryStore.delete(key);
      this._memoryExpiry.delete(key);
      return null;
    }
    return this._memoryStore.has(key) ? this._memoryStore.get(key) : null;
  }

  _memorySet(key, value, expireSeconds = null) {
    // Evict oldest 100 entries if store exceeds 10,000
    if (this._memoryStore.size >= 10000) {
      const oldest = [...this._memoryStore.keys()].slice(0, 100);
      oldest.forEach(k => { this._memoryStore.delete(k); this._memoryExpiry.delete(k); });
    }
    this._memoryStore.set(key, String(value));
    if (expireSeconds) {
      this._memoryExpiry.set(key, Date.now() + expireSeconds * 1000);
    }
  }

  // =================================================================
  // 1. CORE OPERATIONS
  // =================================================================

  async get(key) {
    if (!this.client) {
      return this.degradedMode ? this._memoryGet(key) : null;
    }
    try {
      const data = await this.client.get(key);
      return data;
    } catch (error) {
      logger.error(`Redis get error [${key}]:`, error.message);
      if (this.degradedMode) return this._memoryGet(key);
      return null;
    }
  }

  async set(key, value, expireSeconds = null) {
    try {
      if (!this.client) {
        if (this.degradedMode) this._memorySet(key, value, expireSeconds);
        return;
      }
      const valString = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (expireSeconds) {
        await this.client.set(key, valString, 'EX', expireSeconds);
      } else {
        await this.client.set(key, valString);
      }
    } catch (error) {
      logger.error(`Redis set error [${key}]:`, error.message);
      if (this.degradedMode) this._memorySet(key, value, expireSeconds);
    }
  }

  async del(key) {
    try {
      if (!this.client) return 0;
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Redis del error [${key}]:`, error.message);
      if (this.degradedMode) {
        this._memoryStore.delete(key);
        this._memoryExpiry.delete(key);
        return 1;
      }
      return 0;
    }
  }

  async exists(key) {
    try {
      if (!this.client) return 0;
      return await this.client.exists(key);
    } catch (error) {
      return 0;
    }
  }

  async keys(pattern) {
    try {
      if (!this.client) return [];
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Redis keys error [${pattern}]:`, error.message);
      return [];
    }
  }

  // =================================================================
  // 2. COUNTER OPERATIONS (CRITICAL FOR RATE LIMIT)
  // =================================================================

  async incr(key) {
    try {
      if (!this.client) return 1;
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Redis incr error [${key}]:`, error.message);
      if (this.degradedMode) {
        const current = parseInt(this._memoryGet(key) || '0', 10);
        const next = current + 1;
        this._memorySet(key, next);
        return next;
      }
      return 1;
    }
  }

  // ✅ METHOD PENTING: incrBy (Agar tidak error saat potong token banyak)
  async incrBy(key, amount) {
    try {
      if (!this.client) return amount;
      const val = parseInt(amount);
      if (isNaN(val)) return 0;
      return await this.client.incrby(key, val);
    } catch (error) {
      logger.error(`Redis incrBy error [${key}]:`, error.message);
      if (this.degradedMode) {
        const current = parseInt(this._memoryGet(key) || '0', 10);
        const next = current + parseInt(amount, 10);
        this._memorySet(key, next);
        return next;
      }
      return amount;
    }
  }

  async decr(key) {
    try {
      if (!this.client) return 0;
      return await this.client.decr(key);
    } catch (error) {
      return 0;
    }
  }

  // =================================================================
  // 3. EXPIRY & TTL OPERATIONS
  // =================================================================

  async expire(key, seconds) {
    if (!this.client) {
      if (this.degradedMode && this._memoryStore.has(key)) {
        this._memoryExpiry.set(key, Date.now() + seconds * 1000);
        return 1;
      }
      return 0;
    }
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error(`Redis expire error [${key}]:`, error.message);
      if (this.degradedMode && this._memoryStore.has(key)) {
        this._memoryExpiry.set(key, Date.now() + seconds * 1000);
        return 1;
      }
      return 0;
    }
  }

  // ✅ METHOD PENTING: TTL (Agar Frontend tahu kapan reset)
  async ttl(key) {
    try {
      if (!this.client) return -1;
      return await this.client.ttl(key);
    } catch (error) {
      return -1;
    }
  }

  // =================================================================
  // 4. UTILITY / HEALTH
  // =================================================================

  async healthCheck() {
    try {
      if (!this.client) return false;
      await this.client.ping();
      this.isConnected = true; // Update status jika ping berhasil
      return true;
    } catch (e) {
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis connection closed gracefully');
    }
  }
}

// Export sebagai Singleton
module.exports = new RedisService();