const Redis = require('ioredis');

// ✅ PAKAI LOGGER YANG SUDAH DIBUAT, dengan fallback
let logger;
try {
  logger = require('../utils/logger');
} catch (error) {
  // Fallback jika file logger tidak ada
  logger = {
    info: (...args) => console.log(`[${new Date().toISOString()}] ℹ️ [REDIS]`, ...args),
    error: (...args) => console.error(`[${new Date().toISOString()}] 🔴 [REDIS ERROR]`, ...args),
    warn: (...args) => console.warn(`[${new Date().toISOString()}] ⚠️ [REDIS WARN]`, ...args),
    debug: (...args) => { 
      if (process.env.RATE_LIMIT_DEBUG === 'true') {
        console.log(`[${new Date().toISOString()}] 🔍 [REDIS DEBUG]`, ...args);
      }
    }
  };
}

class RedisService {
  constructor() {
    this.isConnected = false;
    
    try {
      this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true // ✅ Important: jangan auto-connect
      });
      
      this.initEventListeners();
      logger.info('Redis service initialized');
    } catch (error) {
      logger.error('Failed to initialize Redis service:', error.message);
      this.client = null;
    }
  }

  initEventListeners() {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis client connected');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      logger.error('Redis error:', err.message);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });
  }

  async set(key, value, expiryMs = null) {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      if (expiryMs) {
        return await this.client.set(key, JSON.stringify(value), 'PX', expiryMs);
      }
      return await this.client.set(key, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis set error:', error.message);
      throw error;
    }
  }

  async get(key) {
    try {
      if (!this.client) {
        return null;
      }

      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis get error:', error.message);
      return null; // Return null instead of throwing for get operations
    }
  }

  async incr(key) {
    try {
      if (!this.client) {
        return 1; // Fallback value
      }
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Redis incr error:', error.message);
      return 1; // Fallback value
    }
  }

  async decr(key) {
    try {
      if (!this.client) {
        return 0; // Fallback value
      }
      return await this.client.decr(key);
    } catch (error) {
      logger.error('Redis decr error:', error.message);
      return 0; // Fallback value
    }
  }

  // ✅ TAMBAHKAN METHOD expire YANG MISSING
  async expire(key, seconds) {
    try {
      if (!this.client) {
        return 0; // Fallback: return 0 (failed)
      }
      const result = await this.client.expire(key, seconds);
      logger.debug(`Redis expire ${key} for ${seconds}s: ${result}`);
      return result;
    } catch (error) {
      logger.error('Redis expire error:', error.message);
      return 0; // Return 0 (failed) sebagai fallback
    }
  }

  async exists(key) {
    try {
      if (!this.client) {
        return 0; // Fallback: return 0 (not exists)
      }
      return await this.client.exists(key);
    } catch (error) {
      logger.error('Redis exists error:', error.message);
      return 0; // Fallback: return 0 (not exists)
    }
  }

  async del(key) {
    try {
      if (!this.client) {
        return 0; // Fallback: return 0 (not deleted)
      }
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis del error:', error.message);
      return 0; // Fallback: return 0 (not deleted)
    }
  }

  // ✅ TAMBAHKAN METHOD pipeline YANG MISSING
  async pipeline(operations) {
    try {
      if (!this.client) {
        logger.warn('Redis pipeline: client not available');
        return [];
      }
      
      const pipeline = this.client.pipeline();
      operations.forEach(([operation, ...args]) => {
        if (pipeline[operation]) {
          pipeline[operation](...args);
        }
      });
      const results = await pipeline.exec();
      logger.debug(`Redis pipeline executed ${operations.length} operations`);
      return results;
    } catch (error) {
      logger.error('Redis pipeline error:', error.message);
      return []; // Return empty array sebagai fallback
    }
  }

  // ✅ TAMBAHKAN METHOD keys YANG MISSING
  async keys(pattern) {
    try {
      if (!this.client) {
        return []; // Fallback: empty array
      }
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis keys error:', error.message);
      return []; // Fallback: empty array
    }
  }

  // ✅ TAMBAHKAN METHOD multi YANG MISSING
  async multi(operations) {
    try {
      if (!this.client) {
        logger.warn('Redis multi: client not available');
        return [];
      }
      
      const multi = this.client.multi();
      operations.forEach(([operation, ...args]) => {
        if (multi[operation]) {
          multi[operation](...args);
        }
      });
      const results = await multi.exec();
      logger.debug(`Redis multi executed ${operations.length} operations`);
      return results;
    } catch (error) {
      logger.error('Redis multi error:', error.message);
      return [];
    }
  }

  // Health check
  async healthCheck() {
    try {
      if (!this.client) {
        return false;
      }
      await this.client.ping();
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  // Get connection status
  getStatus() {
    return {
      connected: this.isConnected,
      clientInitialized: !!this.client
    };
  }

  // Graceful shutdown
  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        logger.info('Redis client disconnected gracefully');
      }
    } catch (error) {
      logger.error('Redis disconnect error:', error.message);
    }
  }

  // ✅ TAMBAHKAN METHOD BATCH UNTUK RATE LIMITING
  async batchIncrement(keysWithExpiry) {
    try {
      if (!this.client) {
        return []; // Fallback
      }

      const pipeline = this.client.pipeline();
      keysWithExpiry.forEach(({ key, expiryMs }) => {
        pipeline.incr(key);
        if (expiryMs) {
          pipeline.expire(key, Math.ceil(expiryMs / 1000));
        }
      });
      
      return await pipeline.exec();
    } catch (error) {
      logger.error('Redis batchIncrement error:', error.message);
      return [];
    }
  }

  // ✅ SIMPLE INCREMENT WITH EXPIRE (untuk rate limiting)
  async incrWithExpire(key, expirySeconds) {
    try {
      if (!this.client) {
        return 1; // Fallback
      }

      const result = await this.client.multi()
        .incr(key)
        .expire(key, expirySeconds)
        .exec();
      
      return result ? result[0][1] : 1; // Return the increment result
    } catch (error) {
      logger.error('Redis incrWithExpire error:', error.message);
      return 1; // Fallback
    }
  }
}

module.exports = new RedisService();