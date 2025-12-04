const redisService = require('./redisService');

// ==========================================
// 1. CONFIGURATION LOADING (DIRECT FROM ENV)
// ==========================================
const getEnvInt = (key, defaultValue) => parseInt(process.env[key] || defaultValue);

const rateLimitConfig = {
  // CONFIGURATION UNTUK GUEST (Tamu)
  guest: {
    requestsPerMinute: getEnvInt('RATE_LIMIT_GUEST_PER_MINUTE', 5), 
    requestsPerHour: getEnvInt('RATE_LIMIT_GUEST_PER_HOUR', 20),
    requestsPerDay: getEnvInt('RATE_LIMIT_GUEST_PER_DAY', 50),
    windowMs: getEnvInt('RATE_LIMIT_WINDOW_MS', 60000),
  },
  
  // CONFIGURATION UNTUK USER (Login)
  user: {
    requestsPerMinute: getEnvInt('RATE_LIMIT_USER_PER_MINUTE', 20),
    requestsPerHour: getEnvInt('RATE_LIMIT_USER_PER_HOUR', 100),
    requestsPerDay: getEnvInt('RATE_LIMIT_USER_PER_DAY', 500),
    windowMs: 60000,
  }
};

console.log(`✅ [RATE LIMIT] Config Loaded. Guest Limit: ${rateLimitConfig.guest.requestsPerMinute}/min`);

// ==========================================
// 2. PRISMA SETUP (FAIL-SAFE)
// ==========================================
let prisma;
let hasRateLimitLogModel = false;

try {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  
  if (prisma.rateLimitLog && typeof prisma.rateLimitLog.create === 'function') {
    hasRateLimitLogModel = true;
  }
} catch (error) {
  prisma = null; // Silent fallback jika DB error
}

class RateLimitService {
  constructor() {
    this.config = rateLimitConfig;
    this.isRedisAvailable = true;
    this.initializeService();
  }

  async initializeService() {
    try {
      this.isRedisAvailable = await redisService.healthCheck();
      if (this.isRedisAvailable) {
        console.log('✅ [RATE LIMIT] Redis connection verified');
      } else {
        console.warn('⚠️ [RATE LIMIT] Redis not available, using memory fallback');
      }
    } catch (error) {
      this.isRedisAvailable = false;
    }
  }

  generateKey(identifier, type, window) {
    return `rate_limit:${type}:${identifier}:${window}`;
  }

  // ==========================================
  // 3. CORE LOGIC (ATOMIC & OPTIMIZED)
  // ==========================================
  async checkRateLimit(userId, ipAddress, userType = 'guest') {
    // Fallback ke Memory jika Redis mati
    if (!this.isRedisAvailable) {
      return this.memoryFallbackCheck(userType);
    }

    const now = Date.now();
    const windows = [
      { name: 'minute', ms: 60000 },
      { name: 'hour', ms: 3600000 },
      { name: 'day', ms: 86400000 }
    ];

    // Otomatis pilih config berdasarkan userType ('guest' atau 'user')
    const limits = this.config[userType] || this.config.guest;
    const identifier = userId || ipAddress;

    try {
      for (const window of windows) {
        const key = this.generateKey(identifier, userType, window.name);
        
        // Ambil limit yang sesuai (misal: requestsPerMinute)
        const limitProp = `requestsPer${window.name.charAt(0).toUpperCase() + window.name.slice(1)}`;
        const windowLimit = limits[limitProp];

        // ⚠️ ATOMIC OPERATION (KUNCI UTAMA):
        // Kita INCR dulu. Redis langsung nambah angka & balikin hasil terbaru.
        // Tidak ada celah "Race Condition" di sini.
        const currentCount = await redisService.incr(key);

        // Jika ini request pertama, set waktu kadaluarsa (TTL)
        if (currentCount === 1) {
          await redisService.expire(key, Math.ceil(window.ms / 1000));
        }

        // Cek apakah melewasi batas
        if (currentCount > windowLimit) {
          // Log ke DB (Fire-and-forget, jangan await agar cepat)
          this.logRateLimitHit(identifier, userType, window.name, true);
          
          return {
            allowed: false,
            limit: windowLimit,
            remaining: 0,
            resetTime: now + window.ms,
            retryAfter: Math.ceil(window.ms / 1000), 
            window: window.name,
            usingFallback: false
          };
        }
      }

      // Jika lolos semua loop, berarti aman
      const minuteLimit = limits.requestsPerMinute;
      
      return {
        allowed: true,
        limit: minuteLimit,
        remaining: Math.max(0, minuteLimit - 1), // Estimasi sisa
        resetTime: now + 60000,
        retryAfter: null,
        window: 'minute',
        usingFallback: false
      };

    } catch (error) {
      console.error('❌ [RATE LIMIT] Redis Error:', error.message);
      return this.memoryFallbackCheck(userType);
    }
  }

  // Mode darurat jika Redis mati
  memoryFallbackCheck(userType) {
    const limits = this.config[userType] || this.config.guest;
    return {
      allowed: true,
      limit: limits.requestsPerMinute,
      remaining: 1, 
      resetTime: Date.now() + 60000,
      usingFallback: true,
      note: 'Memory fallback - Strict limit disabled'
    };
  }

  async logRateLimitHit(identifier, userType, window, wasBlocked) {
    if (!prisma || !hasRateLimitLogModel) return;
    
    // Logging async tanpa mengganggu performa utama
    prisma.rateLimitLog.create({
      data: {
        userId: identifier.includes('user') ? identifier : null,
        ipAddress: identifier.includes('.') || identifier.includes(':') ? identifier : null,
        endpoint: '/api/chat',
        method: 'POST',
        statusCode: wasBlocked ? 429 : 200,
        wasBlocked,
        timestamp: new Date()
      }
    }).catch(() => {}); // Abaikan error logging
  }
}

module.exports = new RateLimitService();