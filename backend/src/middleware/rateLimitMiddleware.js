const rateLimitService = require('../services/rateLimitService');
const { getClientIp } = require('request-ip'); // Pastikan install: npm install request-ip

/**
 * Middleware Utama Rate Limit
 * @param {string|null} forcedType - Paksa tipe ('guest', 'user', 'premium'). Jika null, otomatis deteksi.
 */
const rateLimitMiddleware = (forcedType = null) => {
  return async (req, res, next) => {
    // 1. Cek Kill Switch dari ENV
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return next();
    }

    try {
      // 2. Identifikasi Identitas (IP & UserID)
      // Menggunakan library request-ip agar akurat di balik proxy/hosting
      const ipAddress = getClientIp(req) || req.ip || '127.0.0.1';
      const userId = req.user?.id || null; // Asumsi req.user di-set oleh Auth Middleware

      // 3. Tentukan Tipe User Secara Cerdas
      // Jika forcedType diisi (misal: 'guest'), pakai itu.
      // Jika tidak, cek apakah ada userId? Jika ya -> 'user', Jika tidak -> 'guest'.
      let userType = forcedType;
      
      if (!userType) {
        if (userId) {
          // Logika tambahan: Cek role premium jika ada
          userType = (req.user.isPremium || req.user.role === 'premium') ? 'premium' : 'user';
        } else {
          userType = 'guest';
        }
      }

      // 4. Panggil Service (Otak Utama)
      // Kita tidak perlu logic Redis manual di sini, biarkan Service yang menghitung Atomic
      const result = await rateLimitService.checkRateLimit(userId, ipAddress, userType);

      // 5. Set Response Headers (Standard RFC 6585)
      // Memberi info ke frontend sisa limit mereka
      res.set({
        'X-RateLimit-Limit': result.limit,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000),
        'X-RateLimit-Policy': userType // Info tambahan kebijakan yang dipakai
      });

      // 6. Eksekusi Blokir jika limit habis
      if (!result.allowed) {
        res.set('Retry-After', result.retryAfter);
        
        return res.status(429).json({
          success: false,
          error: 'rate_limit_exceeded',
          message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
          data: {
            retry_after: result.retryAfter,
            limit: result.limit,
            reset_time: result.resetTime
          }
        });
      }

      // 7. Lanjut jika aman
      next();

    } catch (error) {
      console.error('⚠️ [MIDDLEWARE] Rate Limit Error:', error.message);
      // Fail-open: Jangan blokir user gara-gara sistem limit error. Biarkan lewat.
      next();
    }
  };
};

// ==========================================
// PRE-CONFIGURED MIDDLEWARES
// ==========================================

// 1. Middleware Standar
const guestRateLimit = rateLimitMiddleware('guest');
const userRateLimit = rateLimitMiddleware('user');
const premiumRateLimit = rateLimitMiddleware('premium');

// 2. IP Rate Limit (Compatibility)
// Kita arahkan ke 'guest' karena guest limit dasarnya berbasis IP
const ipRateLimit = rateLimitMiddleware('guest');

// 3. Dynamic AI Middleware
// Middleware pintar yang otomatis menyesuaikan limit berdasarkan status login user
const aiSpecificRateLimit = rateLimitMiddleware(null); // Null artinya auto-detect

// 4. Enhanced Guest (Array Compatibility)
// Karena logic kita sudah atomic, kita tidak perlu array middleware bertumpuk.
// Cukup satu middleware guest yang solid.
const enhancedGuestRateLimit = guestRateLimit;

module.exports = {
  rateLimitMiddleware,
  guestRateLimit,
  userRateLimit,
  premiumRateLimit,
  ipRateLimit,
  enhancedGuestRateLimit,
  aiSpecificRateLimit
};