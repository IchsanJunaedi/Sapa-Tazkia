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
    this.initialize();
  }

  initialize() {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    
    try {
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        lazyConnect: false 
      });

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
      logger.info('✅ Redis client connected successfully');
    });

    this.client.on('error', (err) => {
      // Jangan set isConnected false permanen di sini agar bisa auto-reconnect
      if (err.code === 'ECONNREFUSED') {
        // console.warn('⚠️ [REDIS] Connection refused...'); 
      } else {
        logger.error('Redis error:', err.message);
      }
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });
  }

  // =================================================================
  // 1. CORE OPERATIONS
  // =================================================================

  async get(key) {
    // ❌ HAPUS check !this.isConnected agar tidak memblokir saat startup
    try {
      if (!this.client) return null;
      const data = await this.client.get(key);
      return data; 
    } catch (error) {
      logger.error(`Redis get error [${key}]:`, error.message);
      return null;
    }
  }

  async set(key, value, expireSeconds = null) {
    try {
      if (!this.client) return;
      const valString = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      if (expireSeconds) {
        await this.client.set(key, valString, 'EX', expireSeconds);
      } else {
        await this.client.set(key, valString);
      }
    } catch (error) {
      logger.error(`Redis set error [${key}]:`, error.message);
    }
  }

  async del(key) {
    try {
      if (!this.client) return 0;
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Redis del error [${key}]:`, error.message);
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

  // =================================================================
  // 2. COUNTER OPERATIONS (CRITICAL FOR RATE LIMIT)
  // =================================================================

  async incr(key) {
    try {
      if (!this.client) return 1;
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Redis incr error [${key}]:`, error.message);
      return 1;
    }
  }

  // ✅ METHOD PENTING: incrBy (Agar tidak error saat potong token banyak)
  async incrBy(key, amount) {
    try {
      if (!this.client) return amount;
      const val = parseInt(amount);
      if (isNaN(val)) return 0;
      
      const result = await this.client.incrby(key, val);
      return result;
    } catch (error) {
      logger.error(`Redis incrBy error [${key}]:`, error.message);
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
    try {
      if (!this.client) return 0;
      return await this.client.expire(key, seconds);
    } catch (error) {
      logger.error(`Redis expire error [${key}]:`, error.message);
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