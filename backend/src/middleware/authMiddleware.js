const authService = require('../services/authService');

/**
 * ============================================================================
 * 1. REQUIRE AUTH (STRICT)
 * Middleware ini WAJIB ada token valid. Jika tidak, tolak request (401).
 * Digunakan untuk: Edit Profile, Hapus Chat, Lihat Data Pribadi, dan /ingest.
 * ============================================================================
 */
const requireAuth = async (req, res, next) => {
  try {
    // Ambil token dari header Authorization
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false,
        message: 'Akses ditolak. Token otentikasi tidak ditemukan.' 
      });
    }

    // Format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Format header otentikasi salah. Gunakan: Bearer <token>'
      });
    }

    const token = parts[1].trim();
    
    // Validasi token dasar
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid'
      });
    }

    // 1. Verifikasi JWT
    // authService.verifyToken biasanya throw error jika expired
    const decoded = authService.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid'
      });
    }

    // 2. Verifikasi Session Database
    const verification = await authService.verifySession(token);

    if (verification.valid && verification.user) {
      // Token valid & User ditemukan -> Attach ke request
      req.user = verification.user;
      next();
    } else {
      return res.status(401).json({
        success: false,
        message: verification.message || 'Sesi anda telah berakhir, silakan login kembali.'
      });
    }

  } catch (error) {
    // ✅ FIX PENTING: Tangani TokenExpiredError agar responsenya rapi (401) bukan crash
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Sesi telah berakhir (Token Expired). Silakan login kembali.' 
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token tidak valid.' 
      });
    }

    console.error('[ERROR] Auth Middleware:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat otentikasi.'
    });
  }
};

/**
 * ============================================================================
 * 2. GUEST FRIENDLY AUTH (FAIL-SAFE) - Untuk /ingest-now & /chat
 * Middleware ini TIDAK PERNAH ERROR.
 * - Token Valid -> Login sebagai User.
 * - Token Expired/Invalid/Tidak Ada -> Lanjut sebagai GUEST (req.user = null).
 * ============================================================================
 */
const guestFriendlyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    // KASUS 1: Tidak ada header auth -> GUEST
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      req.user = null;
      return next();
    }

    const token = parts[1].trim();
    
    if (!token || token.length < 10 || token === 'null' || token === 'undefined') {
      req.user = null;
      return next();
    }

    // KASUS 2: Ada token, coba verifikasi dengan Try-Catch
    try {
      const decoded = authService.verifyToken(token);
      
      if (decoded) {
        // Token format valid, cek session database
        const verification = await authService.verifySession(token);
        
        if (verification.valid && verification.user) {
          // SUKSES: User terautentikasi
          req.user = verification.user;
          console.log(`🔐 [AUTH] User Authenticated: ${verification.user.email}`);
        } else {
          // GAGAL: Session di DB invalid -> GUEST
          console.log(`👤 [AUTH] Guest access (Session Invalid)`);
          req.user = null;
        }
      } else {
        req.user = null;
      }
    } catch (jwtError) {
      // ✅ FIX UTAMA: Jika token expired di mode Guest, CUEK SAJA dan lanjut sebagai Guest
      // Jangan return error response!
      console.warn(`⚠️ [AUTH] Token expired in Guest Mode. Proceeding as Guest.`);
      req.user = null;
    }

    // Lanjut ke controller
    next();

  } catch (error) {
    // Safety net terakhir
    console.error('❌ [AUTH] Unexpected error in guest auth:', error.message);
    req.user = null;
    next();
  }
};

/**
 * ============================================================================
 * 3. OPTIONAL AUTH (BACKWARD COMPATIBILITY)
 * Menggunakan logika guestFriendlyAuth agar konsisten
 * ============================================================================
 */
const optionalAuth = guestFriendlyAuth;

/**
 * ============================================================================
 * 4. SIMPLE AUTH MIDDLEWARE (FOR TESTING)
 * Hanya validasi JWT dasar tanpa cek database
 * ============================================================================
 */
const simpleAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ success: false, message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    
    if (decoded) {
      req.user = { id: decoded.id };
      next();
    } else {
      res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } catch (error) {
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

/**
 * ============================================================================
 * 5. REQUIRE ADMIN
 * ============================================================================
 */
const requireAdmin = async (req, res, next) => {
  await requireAuth(req, res, async () => {
    if (req.user && (req.user.role === 'admin' || req.user.isAdmin)) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Hak akses Admin diperlukan.'
      });
    }
  });
};

module.exports = {
  requireAuth,
  guestFriendlyAuth, 
  optionalAuth, 
  simpleAuthMiddleware,
  requireAdmin
};

// Export default untuk kompatibilitas
module.exports.default = requireAuth;