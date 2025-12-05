const rateLimitService = require('../services/rateLimitService');

class RateLimitController {
  
  /**
   * Mendapatkan status rate limit saat ini (digunakan oleh Frontend Bar)
   * GET /api/guest/rate-limit-status
   * GET /api/user/rate-limit-status
   */
  async getRateLimitStatus(req, res) {
    try {
      // 1. Tentukan identitas (User ID atau IP) dengan aman
      let identifier;
      let userType;

      if (req.user && req.user.id) {
        identifier = req.user.id;
        userType = 'user';
      } else {
        // Fallback ke IP Address untuk Guest
        // req.headers['x-forwarded-for'] berguna jika di belakang proxy (Nginx/Cloudflare)
        identifier = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '127.0.0.1';
        
        // Bersihkan format IP IPv6 standar localhost (::ffff:127.0.0.1 -> 127.0.0.1)
        if (typeof identifier === 'string' && identifier.startsWith('::ffff:')) {
          identifier = identifier.substr(7);
        }
        
        userType = 'guest';
      }

      // 2. Ambil data dari service 
      // (Method getQuotaStatus di service sudah kita buat anti-crash sebelumnya)
      const status = await rateLimitService.getQuotaStatus(identifier, userType);

      // 3. Kirim response sukses ke Frontend
      res.json({
        success: true,
        data: {
          user_type: userType,
          window_limits: {
            remaining: status.remaining,
            limit: status.limit,
            reset_time: status.resetTime,
            allowed: status.remaining > 0
          }
        }
      });

    } catch (error) {
      console.error('❌ [RATE LIMIT CONTROLLER] Critical Error getting status:', error.message);
      
      // ✅ FALLBACK RESPONSE (FIX UTAMA)
      // Jika terjadi error fatal, jangan kirim 500. Kirim data "aman" agar UI tidak rusak.
      // Kita anggap user adalah guest dengan kuota penuh sementara waktu.
      res.json({ 
        success: false, // Tandai false tapi tetap return 200 OK secara HTTP
        message: "Fallback status due to server error",
        data: {
          user_type: 'guest',
          window_limits: {
            remaining: 7000, // Tampilkan penuh agar user tidak bingung
            limit: 7000,
            reset_time: Date.now() + 86400000, // Reset besok
            allowed: true 
          }
        }
      });
    }
  }

  // --- Opsional: Fitur Health Check Service ---

  async getServiceStatus(req, res) {
    try {
      const isRedisUp = rateLimitService.isRedisAvailable;
      res.json({
        success: true,
        data: {
          service: 'RateLimitService',
          redis_connected: isRedisUp,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Service check failed' });
    }
  }
}

// Export instance
module.exports = new RateLimitController();