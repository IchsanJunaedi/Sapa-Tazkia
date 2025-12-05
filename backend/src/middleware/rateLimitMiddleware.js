const rateLimitService = require('../services/rateLimitService');
const { getClientIp } = require('request-ip'); 

/**
 * Middleware Utama Rate Limit
 * @param {string|null} forcedType - Paksa tipe ('guest', 'user', 'premium'). Jika null, otomatis deteksi.
 */
const rateLimitMiddleware = (forcedType = null) => {
  return async (req, res, next) => {
    // ----------------------------------------------------------------------
    // 1. Cek Kill Switch dari ENV
    // ----------------------------------------------------------------------
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return next();
    }

    // ----------------------------------------------------------------------
    // 1.5. WHITELIST / EXCLUSION PATHS
    // ----------------------------------------------------------------------
    const excludedPaths = [
      '/api/auth',      
      '/health',        
      '/favicon.ico'    
    ];

    const isExcluded = excludedPaths.some(path => req.path.startsWith(path));

    if (isExcluded) {
      return next(); 
    }

    try {
      // ----------------------------------------------------------------------
      // 2. Identifikasi Identitas (IP & UserID)
      // ----------------------------------------------------------------------
      const ipAddress = getClientIp(req) || req.ip || '127.0.0.1';
      const userId = req.user?.id || null; 

      // ----------------------------------------------------------------------
      // 3. Tentukan Tipe User Secara Cerdas
      // ----------------------------------------------------------------------
      let userType = forcedType;
      
      if (!userType) {
        if (userId) {
          userType = (req.user.isPremium || req.user.role === 'premium') ? 'premium' : 'user';
        } else {
          userType = 'guest';
        }
      }

      // ----------------------------------------------------------------------
      // ✅ FIX: AMBIL MASTER LIMIT (SOURCE OF TRUTH)
      // Kita ambil konfigurasi asli (misal: 7000) sebelum mengecek limit.
      // Ini menjamin angka yang dikirim ke frontend SELALU limit token, bukan limit spam.
      // ----------------------------------------------------------------------
      const limitsConfig = rateLimitService.getLimits(userType);
      const masterTokenLimit = limitsConfig.tokenLimitDaily; // Ini pasti 7000/15000/dll

      // ----------------------------------------------------------------------
      // 4. Panggil Service (Otak Utama)
      // ----------------------------------------------------------------------
      const result = await rateLimitService.checkRateLimit(userId, ipAddress, userType);

      // ----------------------------------------------------------------------
      // 5. Set Response Headers (Standard RFC 6585)
      // ----------------------------------------------------------------------
      // ✅ FIX: Gunakan masterTokenLimit jika result.limit tidak ada (kasus error spam)
      // ✅ FIX: Pastikan remaining tidak undefined (kasus error spam -> anggap remaining aman/pakai yg ada)
      
      const responseLimit = result.limit || masterTokenLimit;
      const responseRemaining = result.remaining !== undefined ? result.remaining : 0; 
      
      res.set({
        'X-RateLimit-Limit': responseLimit,         // SELALU 7000
        'X-RateLimit-Remaining': responseRemaining, 
        'X-RateLimit-Reset': result.resetTime ? Math.ceil(result.resetTime / 1000) : 0,
        'X-RateLimit-Policy': userType 
      });

      // ----------------------------------------------------------------------
      // 6. Eksekusi Blokir jika limit habis
      // ----------------------------------------------------------------------
      if (!result.allowed) {
        res.set('Retry-After', result.retryAfter || 60);
        
        // Logika Status Code:
        // Jika error karena Spam (jeda sebentar) -> 429
        // Jika error karena Token Habis (limit harian) -> 429 (sama saja, tapi pesan beda)
        
        return res.status(429).json({
          success: false,
          error: result.error || 'rate_limit_exceeded',
          message: result.message || `Too many requests. Please try again in ${result.retryAfter} seconds.`,
          data: {
            retry_after: result.retryAfter,
            // ✅ FIX: Kirim limit 7000 ke frontend, jangan undefined/10
            limit: responseLimit, 
            remaining: responseRemaining,
            reset_time: result.resetTime
          }
        });
      }

      // ----------------------------------------------------------------------
      // 7. Lanjut jika aman
      // ----------------------------------------------------------------------
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

const guestRateLimit = rateLimitMiddleware('guest');
const userRateLimit = rateLimitMiddleware('user');
const premiumRateLimit = rateLimitMiddleware('premium');
const ipRateLimit = rateLimitMiddleware('guest');
const aiSpecificRateLimit = rateLimitMiddleware(null); 
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