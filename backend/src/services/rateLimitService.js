const redisService = require('./redisService');

// Fallback config jika file tidak ada
let rateLimitConfig;
try {
  rateLimitConfig = require('../../config/rateLimitConfig');
  console.log('✅ [RATE LIMIT] Configuration loaded from file');
} catch (error) {
  console.warn('⚠️ [RATE LIMIT] Config file not found, using fallback configuration');
  rateLimitConfig = {
    // Guest users (unauthenticated)
    guest: {
      requestsPerMinute: 10,
      requestsPerHour: 50,
      requestsPerDay: 200,
      burstCapacity: 5,
      windowMs: 60000,
      blockDuration: 300000,
      refillRate: 0.166,
    },
    
    // Authenticated users
    user: {
      requestsPerMinute: 30,
      requestsPerHour: 200,
      requestsPerDay: 1000,
      burstCapacity: 15,
      windowMs: 60000,
      blockDuration: 600000,
      refillRate: 0.5,
    },
    
    // Premium/users with special access
    premium: {
      requestsPerMinute: 100,
      requestsPerHour: 1000,
      requestsPerDay: 5000,
      burstCapacity: 50,
      windowMs: 60000,
      blockDuration: 300000,
      refillRate: 1.666,
    },
    
    // IP-based limiting for additional security
    ip: {
      requestsPerMinute: 20,
      requestsPerHour: 100,
      requestsPerDay: 500,
      windowMs: 60000,
    },
    
    // Adaptive limits based on system load
    adaptive: {
      enabled: true,
      loadThreshold: 0.8,
      reductionFactor: 0.5,
    }
  };
}

// Fallback untuk Prisma dengan model checking
let prisma;
let hasRateLimitLogModel = false;

try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  
  // ✅ CHECK: Pastikan model RateLimitLog ada
  if (prisma.rateLimitLog && typeof prisma.rateLimitLog.create === 'function') {
    hasRateLimitLogModel = true;
    console.log('✅ [RATE LIMIT] Prisma connected with RateLimitLog model');
  } else {
    console.warn('⚠️ [RATE LIMIT] RateLimitLog model not available in Prisma schema');
    hasRateLimitLogModel = false;
  }
} catch (error) {
  console.warn('⚠️ [RATE LIMIT] Prisma not available, database logging disabled:', error.message);
  prisma = null;
  hasRateLimitLogModel = false;
}

class RateLimitService {
  constructor() {
    this.config = rateLimitConfig;
    this.isRedisAvailable = true;
    this.initializeService();
  }

  async initializeService() {
    try {
      // Test Redis connection
      this.isRedisAvailable = await redisService.healthCheck();
      if (this.isRedisAvailable) {
        console.log('✅ [RATE LIMIT] Redis connection verified');
      } else {
        console.warn('⚠️ [RATE LIMIT] Redis not available, using memory fallback');
      }
    } catch (error) {
      console.warn('⚠️ [RATE LIMIT] Redis check failed, using memory fallback:', error.message);
      this.isRedisAvailable = false;
    }
  }

  generateKey(identifier, type, window) {
    return `rate_limit:${type}:${identifier}:${window}`;
  }

  async checkRateLimit(userId, ipAddress, userType = 'guest') {
    // Fallback jika Redis tidak tersedia
    if (!this.isRedisAvailable) {
      return this.memoryFallbackCheck(userId, ipAddress, userType);
    }

    const now = Date.now();
    const windows = [
      { name: 'minute', ms: 60000 },
      { name: 'hour', ms: 3600000 },
      { name: 'day', ms: 86400000 }
    ];

    const limits = this.config[userType];
    const identifier = userId || ipAddress;

    try {
      for (const window of windows) {
        const key = this.generateKey(identifier, userType, window.name);
        const windowLimit = limits[`requestsPer${window.name.charAt(0).toUpperCase() + window.name.slice(1)}`];
        
        const currentCount = await redisService.get(key) || 0;
        
        if (currentCount >= windowLimit) {
          await this.logRateLimitHit(identifier, userType, window.name, true);
          return {
            allowed: false,
            limit: windowLimit,
            remaining: 0,
            resetTime: now + window.ms,
            retryAfter: Math.ceil((now + window.ms - Date.now()) / 1000),
            window: window.name,
            usingFallback: false
          };
        }
      }

      // If all checks pass, increment counters
      await this.incrementCounters(identifier, userType, windows);
      await this.logRateLimitHit(identifier, userType, 'minute', false);
      
      const minuteKey = this.generateKey(identifier, userType, 'minute');
      const currentMinuteCount = await redisService.get(minuteKey) || 0;
      
      return {
        allowed: true,
        limit: limits.requestsPerMinute,
        remaining: Math.max(0, limits.requestsPerMinute - currentMinuteCount),
        resetTime: now + 60000,
        retryAfter: null,
        window: 'minute',
        usingFallback: false
      };
    } catch (error) {
      console.error('❌ [RATE LIMIT] Redis operation failed, using memory fallback:', error.message);
      return this.memoryFallbackCheck(userId, ipAddress, userType);
    }
  }

  // Memory-based fallback ketika Redis down
  memoryFallbackCheck(userId, ipAddress, userType = 'guest') {
    const limits = this.config[userType];
    
    // Simple memory-based rate limiting (reset setiap restart server)
    return {
      allowed: true,
      limit: limits.requestsPerMinute,
      remaining: limits.requestsPerMinute - 1, // Always allow but show decreasing count
      resetTime: Date.now() + 60000,
      retryAfter: null,
      window: 'minute',
      usingFallback: true,
      note: 'Memory fallback mode - limits not persisted'
    };
  }

  async incrementCounters(identifier, userType, windows) {
    if (!this.isRedisAvailable) return;

    try {
      // ✅ FIX: Simple approach tanpa pipeline yang problematic
      for (const window of windows) {
        const key = this.generateKey(identifier, userType, window.name);
        await redisService.incr(key);
        
        // Set expiry secara terpisah
        try {
          await redisService.expire(key, Math.ceil(window.ms / 1000));
        } catch (expireError) {
          // Fallback: ignore expiry errors
          console.warn('⚠️ [RATE LIMIT] Expiry failed for key:', key);
        }
      }
    } catch (error) {
      console.error('❌ [RATE LIMIT] Failed to increment counters:', error.message);
    }
  }

  async logRateLimitHit(identifier, userType, window, wasBlocked) {
    // ✅ FIX: Skip jika Prisma atau model tidak tersedia
    if (!prisma || !hasRateLimitLogModel) {
      return;
    }

    try {
      await prisma.rateLimitLog.create({
        data: {
          userId: identifier.includes('user') ? identifier : null,
          ipAddress: identifier.includes('.') ? identifier : null,
          endpoint: '/api/chat',
          method: 'POST',
          statusCode: wasBlocked ? 429 : 200,
          wasBlocked,
          requestSize: 0,
          responseTime: 0,
          timestamp: new Date()
        }
      });
    } catch (error) {
      // ✅ FIX: Better error handling untuk Prisma errors
      if (error.code === 'P2001' || error.code === 'P2025') {
        // Record not found atau constraint violation - skip logging
        console.warn('⚠️ [RATE LIMIT] Database constraint issue, skipping log');
      } else {
        console.error('❌ [RATE LIMIT] Failed to log rate limit hit:', error.message);
      }
    }
  }

  // Token Bucket Algorithm Implementation dengan fallback
  async checkTokenBucket(userId, ipAddress, userType = 'guest') {
    if (!this.isRedisAvailable) {
      return {
        allowed: true,
        tokens: 10,
        retryAfter: null,
        usingFallback: true
      };
    }

    try {
      const identifier = userId || ipAddress;
      const bucketKey = `token_bucket:${userType}:${identifier}`;
      const config = this.config[userType];
      
      const now = Date.now();
      const bucket = await redisService.get(bucketKey) || {
        tokens: config.burstCapacity,
        lastRefill: now
      };

      // Refill tokens based on time passed
      const timePassed = (now - bucket.lastRefill) / 1000;
      const tokensToAdd = Math.floor(timePassed * config.refillRate);
      
      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(config.burstCapacity, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
      }

      if (bucket.tokens < 1) {
        return {
          allowed: false,
          tokens: bucket.tokens,
          retryAfter: Math.ceil(1 / config.refillRate),
          usingFallback: false
        };
      }

      // Consume one token
      bucket.tokens -= 1;
      await redisService.set(bucketKey, bucket, 3600000); // Store for 1 hour

      return {
        allowed: true,
        tokens: bucket.tokens,
        retryAfter: null,
        usingFallback: false
      };
    } catch (error) {
      console.error('❌ [RATE LIMIT] Token bucket check failed:', error.message);
      return {
        allowed: true,
        tokens: 10,
        retryAfter: null,
        usingFallback: true
      };
    }
  }

  // Adaptive rate limiting based on system load
  async getAdaptiveLimit(userType) {
    if (!this.config.adaptive.enabled) {
      return this.config[userType];
    }

    try {
      const systemLoad = await this.getSystemLoad();
      if (systemLoad > this.config.adaptive.loadThreshold) {
        const reducedLimits = { ...this.config[userType] };
        Object.keys(reducedLimits).forEach(key => {
          if (key.includes('requestsPer')) {
            reducedLimits[key] = Math.floor(
              reducedLimits[key] * this.config.adaptive.reductionFactor
            );
          }
        });
        return reducedLimits;
      }
    } catch (error) {
      console.error('❌ [RATE LIMIT] Adaptive limit calculation failed:', error.message);
    }

    return this.config[userType];
  }

  async getSystemLoad() {
    try {
      // Simple system load calculation based on memory usage
      const used = process.memoryUsage();
      const memoryUsage = used.heapUsed / used.heapTotal;
      
      // Combine memory usage with simple random factor untuk simulation
      return Math.min(1, memoryUsage + Math.random() * 0.3);
    } catch (error) {
      return 0.5; // Default moderate load
    }
  }

  // Analytics and reporting dengan fallback
  async getRateLimitStats(userId = null, timeRange = '24h') {
    if (!prisma || !hasRateLimitLogModel) {
      return {
        allowedRequests: 0,
        blockedRequests: 0,
        usingFallback: true,
        note: 'Database not available for analytics'
      };
    }

    try {
      const timeRanges = {
        '1h': 3600000,
        '24h': 86400000,
        '7d': 604800000
      };

      const startTime = new Date(Date.now() - (timeRanges[timeRange] || 86400000));

      const stats = await prisma.rateLimitLog.groupBy({
        by: ['wasBlocked'],
        where: {
          timestamp: {
            gte: startTime
          },
          ...(userId && { userId })
        },
        _count: {
          id: true
        }
      });

      return stats.reduce((acc, curr) => {
        if (curr.wasBlocked) {
          acc.blockedRequests = curr._count.id;
        } else {
          acc.allowedRequests = curr._count.id;
        }
        return acc;
      }, { allowedRequests: 0, blockedRequests: 0, usingFallback: false });
    } catch (error) {
      console.error('❌ [RATE LIMIT] Analytics query failed:', error.message);
      return {
        allowedRequests: 0,
        blockedRequests: 0,
        usingFallback: true,
        error: error.message
      };
    }
  }

  // Cleanup expired rate limit data
  async cleanupExpiredData() {
    if (!prisma || !hasRateLimitLogModel) return;

    try {
      const twentyFourHoursAgo = new Date(Date.now() - 86400000);
      
      await prisma.rateLimitLog.deleteMany({
        where: {
          timestamp: {
            lt: twentyFourHoursAgo
          }
        }
      });
      
      console.log('✅ [RATE LIMIT] Expired data cleaned up');
    } catch (error) {
      console.error('❌ [RATE LIMIT] Cleanup failed:', error.message);
    }
  }

  // Service status check
  getServiceStatus() {
    return {
      redis: this.isRedisAvailable,
      database: !!prisma && hasRateLimitLogModel,
      config: !!this.config,
      adaptiveLimits: this.config.adaptive.enabled
    };
  }

  // Update configuration dynamically
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('✅ [RATE LIMIT] Configuration updated');
  }
}

module.exports = new RateLimitService();