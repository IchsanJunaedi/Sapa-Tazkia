const rateLimitService = require('../services/rateLimitService');
const { getClientIp } = require('request-ip');

/**
 * Middleware Utama Rate Limit (Token AI)
 * @param {string|null} forcedType - Paksa tipe ('guest', 'user', 'premium'). Jika null, otomatis deteksi.
 */
const rateLimitMiddleware = (forcedType = null) => {
  return async (req, res, next) => {

    // ---------------------------------------------------------------------
    // 1. Cek Kill Switch dari ENV
    // ---------------------------------------------------------------------
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return next();
    }



    // ---------------------------------------------------------------------
    // ✅ FIX SECURITY & BUG: WHITELIST JALUR LOGIN
    // Masalah Login gagal saat limit habis terjadi karena URL Login ikut terblokir.
    // Solusi: Gunakan req.originalUrl untuk membaca full path dan kecualikan rute Auth.
    // ---------------------------------------------------------------------
    const currentPath = req.originalUrl || req.path;

   

    const excludedPaths = [
      '/api/auth',      // Login & Register (PENTING: Jangan blokir akses masuk)
      '/auth',          // Antisipasi variasi path
      '/health',        // Monitoring server
      '/favicon.ico',   // Aset browser
      '/api/webhook'    // Webhook pembayaran (biasanya dari pihak ketiga)
    ];

    // Cek apakah URL mengandung salah satu path whitelist
    const isExcluded = excludedPaths.some(path => currentPath.includes(path));
    if (isExcluded) {
      // ✅ JALUR VIP: Langsung lolos tanpa cek kuota token
      return next();
    }
    try {

      // ----------------------------------------------------------------------
      // 2. Identifikasi Identitas (IP & UserID)
      // ----------------------------------------------------------------------
      const ipAddress = getClientIp(req) || req.ip || '127.0.0.1';
      const userId = req.user?.id || null;



      // --------------------------------------------------------------------
      // 3. Tentukan Tipe User Secara Cerdas
      // --------------------------------------------------------------------

      let userType = forcedType;
      if (!userType) {
        if (userId) {
          userType = (req.user.isPremium || req.user.role === 'premium') ? 'premium' : 'user';
        } else {
          userType = 'guest';
        }
      }



      // ----------------------------------------------------------------------
      // FIX: AMBIL MASTER LIMIT (SOURCE OF TRUTH)
      // Mengambil konfigurasi asli agar header selalu konsisten
      // ----------------------------------------------------------------------

      const limitsConfig = rateLimitService.getLimits(userType);
      const masterTokenLimit = limitsConfig.tokenLimitDaily;

      // ----------------------------------------------------------------------
      // 4. Panggil Service (Otak Utama)
      // ----------------------------------------------------------------------
      const result = await rateLimitService.checkRateLimit(userId, ipAddress, userType);

      // ----------------------------------------------------------------------
      // 5. Set Response Headers (Standard RFC 6585)
      // ----------------------------------------------------------------------

      const responseLimit = result.limit || masterTokenLimit;
      const responseRemaining = result.remaining !== undefined ? result.remaining : 0;

     

      res.set({

        'X-RateLimit-Limit': responseLimit,        
        'X-RateLimit-Remaining': responseRemaining,
        'X-RateLimit-Reset': result.resetTime ? Math.ceil(result.resetTime / 1000) : 0,
        'X-RateLimit-Policy': userType

      });



      // ----------------------------------------------------------------------
      // 6. Eksekusi Blokir jika limit habis
      // ----------------------------------------------------------------------

      if (!result.allowed) {
        res.set('Retry-After', result.retryAfter || 60);
        return res.status(429).json({
          success: false,
          error: result.error || 'rate_limit_exceeded',
          message: result.message || `Too many requests.`,

          data: {
            retry_after: result.retryAfter,
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