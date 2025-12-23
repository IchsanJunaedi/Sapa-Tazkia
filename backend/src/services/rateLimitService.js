const redisService = require('./redisService');
const config = require('../config/rateLimitConfig');

class RateLimitService {
  constructor() {
    this.config = config;
    this.isRedisAvailable = true;
    this.checkRedisHealth();
  }

  async checkRedisHealth() {
    try {
      this.isRedisAvailable = await redisService.healthCheck();
      if (this.isRedisAvailable) console.log('✅ [RATE LIMIT] Redis Connected');
    } catch (e) {
      this.isRedisAvailable = false;
      console.warn('⚠️ [RATE LIMIT] Redis Down, switching to fail-safe');
    }
  }

  // Helper untuk membuat key harian
  getDailyKey(identifier) {
    const dateStr = new Date().toISOString().split('T')[0];
    return `${this.config.redis.tokenPrefix}${dateStr}:${identifier}`;
  }

  getLimits(userType) {
    return this.config[userType] || this.config.guest;
  }

  /**
   * 1. CHECKER (Middleware)
   */
  async checkRateLimit(userId, ipAddress, userType = 'guest') {
    if (!this.isRedisAvailable) return { allowed: true };

    const identifier = userId || ipAddress;
    const limits = this.getLimits(userType);

    // A. SPAM CHECK
    const spamKey = `spam_protect:${identifier}`;
    const currentSpamCount = await redisService.incr(spamKey);
    if (currentSpamCount === 1) await redisService.expire(spamKey, 60);

    if (currentSpamCount > limits.spamLimitPerMinute) {
      return {
        allowed: false,
        error: 'rate_limit_exceeded',
        message: 'Mohon pelan-pelan, terlalu banyak request dalam waktu singkat.',
        retryAfter: 60
      };
    }

    // B. TOKEN QUOTA CHECK
    const usageKey = this.getDailyKey(identifier);
    const currentUsage = await redisService.get(usageKey) || 0;
    const remainingTokens = limits.tokenLimitDaily - parseInt(currentUsage);

    // Hitung waktu reset (TTL)
    let resetTime = Date.now();
    const ttl = await redisService.ttl(usageKey);

    if (ttl > 0) {
      // Jika kunci sudah ada, gunakan sisa waktunya (Fixed Window)
      resetTime += ttl * 1000;
    } else {
      // Jika kunci belum ada (user baru/reset), targetkan 12 jam dari sekarang
      resetTime += 43200000;
    }

    if (remainingTokens <= 0) {
      return {
        allowed: false,
        error: 'rate_limit_exceeded',
        message: `Kuota harian habis.`,
        retryAfter: 3600,
        limit: limits.tokenLimitDaily,
        remaining: 0,
        resetTime: resetTime
      };
    }

    return {
      allowed: true,
      limit: limits.tokenLimitDaily,
      remaining: remainingTokens,
      resetTime: resetTime
    };
  }

  /**
   * 2. TRACKER (Controller)
   * Memotong saldo token.
   */
  async trackTokenUsage(userId, ipAddress, tokenUsed) {
    if (!this.isRedisAvailable || !tokenUsed) return { totalUsage: 0, success: false };

    const identifier = userId || ipAddress;
    const usageKey = this.getDailyKey(identifier);

    // 🔍 DEBUG: Log key yang digunakan
    console.log(`🔑 [TRACK] Using Key: "${usageKey}" for identifier: "${identifier}"`);

    try {
      // Tambah penggunaan token dan AMBIL HASIL LANGSUNG
      // incrBy mengembalikan TOTAL setelah increment, bukan hanya increment-nya
      const newTotalUsage = await redisService.incrBy(usageKey, tokenUsed);

      console.log(`🔢 [TRACK] incrBy result (total usage now): ${newTotalUsage}`);

      // ✅ LOGIKA BARU: FIXED WINDOW (Jendela Tetap)
      // Kita cek dulu TTL (Time To Live) kunci ini.
      const currentTTL = await redisService.ttl(usageKey);

      // Jika TTL == -1, artinya kunci ini BARU saja dibuat oleh perintah incrBy di atas
      // (atau belum punya expiry). Maka kita set expiry-nya sekarang.
      // Jika TTL > 0, artinya kunci sudah punya expiry (timer sedang berjalan), JANGAN DIUBAH.

      if (currentTTL === -1) {
        // Set tepat 12 jam (43200 detik) TANPA MARGIN tambahan
        // Agar reset terjadi tepat 12 jam dari chat pertama
        await redisService.expire(usageKey, 43200);
        console.log(`⏱️ [TOKEN TIMER] Timer dimulai: Reset dalam 12 jam untuk ${identifier}`);
      }

      console.log(`📊 [TOKEN TRACK] ${identifier} used ${tokenUsed} tokens. Total: ${newTotalUsage}`);

      // ✅ RETURN total usage agar controller bisa langsung menghitung remaining
      return { totalUsage: newTotalUsage, success: true };
    } catch (error) {
      console.error('❌ [TOKEN TRACK] Error updating Redis:', error.message);
      return { totalUsage: 0, success: false };
    }
  }

  /**
   * 3. GET STATUS (Controller Status)
   */
  async getQuotaStatus(identifier, userType = 'guest') {
    const limits = this.getLimits(userType);

    const defaultResponse = {
      limit: limits.tokenLimitDaily,
      remaining: limits.tokenLimitDaily,
      resetTime: Date.now() + 43200000, // Default 12 jam
      userType: userType
    };

    if (!this.isRedisAvailable) return defaultResponse;

    try {
      const usageKey = this.getDailyKey(identifier);
      const currentUsage = await redisService.get(usageKey) || 0;
      const remaining = Math.max(0, limits.tokenLimitDaily - parseInt(currentUsage));

      // 🔍 DEBUG: Log key dan nilai yang diambil
      console.log(`🔑 [GET STATUS] Using Key: "${usageKey}" | currentUsage: ${currentUsage} | remaining: ${remaining}`);

      const ttl = await redisService.ttl(usageKey);

      let resetTime = Date.now();
      if (ttl > 0) {
        resetTime += ttl * 1000;
      } else {
        resetTime += 43200000; // 12 Jam default view
      }

      return {
        limit: limits.tokenLimitDaily,
        remaining: remaining,
        resetTime: resetTime,
        userType: userType
      };
    } catch (error) {
      console.error("❌ [RATE LIMIT SERVICE] Error getting status:", error.message);
      return defaultResponse;
    }
  }
}

module.exports = new RateLimitService();