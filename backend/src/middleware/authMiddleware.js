const authService = require('../services/authService');

/**
 * Middleware untuk authentication menggunakan JWT token
 * Memverifikasi token dan menambahkan user data ke request object
 */
const requireAuth = async (req, res, next) => {
  try {
    console.log('[DEBUG] Auth middleware started');
    
    // Ambil token dari header Authorization
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      console.log('[DEBUG] No authorization header provided');
      return res.status(401).json({ 
        success: false,
        message: 'Access denied. No token provided.' 
      });
    }

    // Format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log('[DEBUG] Invalid authorization header format');
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization header format. Use: Bearer <token>'
      });
    }

    const token = parts[1].trim();
    
    // Validasi token tidak kosong
    if (!token || token === 'null' || token === 'undefined' || token === 'Bearer') {
      console.log('[DEBUG] Token is empty or invalid');
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    // Validasi format token dasar
    if (token.length < 10) {
      console.log('[DEBUG] Token too short, likely invalid');
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    console.log(`[DEBUG] Token preview: ${token.substring(0, 20)}...`);

    // Verifikasi token JWT dasar dulu
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      console.log('[DEBUG] Basic JWT verification failed');
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid atau sudah kadaluarsa'
      });
    }

    console.log(`[DEBUG] Basic JWT verified for user ID: ${decoded.id}`);

    // Verifikasi session dengan database
    try {
      const verification = await authService.verifySession(token);

      if (verification.valid) {
        // Token valid di database, attach user data lengkap
        req.user = verification.user;
        console.log(`[DEBUG] Database session verified for user: ${verification.user.email}`);
        next();
      } else {
        // Token tidak valid di database
        console.log(`[DEBUG] Session verification failed: ${verification.message}`);
        return res.status(401).json({
          success: false,
          message: verification.message || 'Session tidak valid'
        });
      }
    } catch (dbError) {
      // Jika ada error database, return error (jangan fallback)
      console.error('[ERROR] Database error in auth middleware:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authentication'
      });
    }

  } catch (error) {
    console.error('[ERROR] Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication'
    });
  }
};

/**
 * Middleware untuk optional authentication
 * Jika ada token yang valid, attach user data, jika tidak lanjutkan saja
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      console.log('[DEBUG] Optional auth - No authorization header, continuing...');
      return next();
    }

    // Format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log('[DEBUG] Optional auth - Invalid authorization header format, continuing...');
      return next();
    }

    const token = parts[1].trim();
    
    // Validasi token dasar
    if (!token || token === 'null' || token === 'undefined' || token === 'Bearer' || token.length < 10) {
      console.log('[DEBUG] Optional auth - Invalid token format, continuing...');
      return next();
    }

    console.log(`[DEBUG] Optional auth - Token preview: ${token.substring(0, 20)}...`);

    // Basic JWT verification
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      console.log('[DEBUG] Optional auth - Invalid token, continuing without user');
      return next();
    }

    console.log(`[DEBUG] Optional auth - Basic JWT verified for user ID: ${decoded.id}`);

    // Coba verifikasi session dengan database
    try {
      const verification = await authService.verifySession(token);
      
      if (verification.valid) {
        req.user = verification.user;
        console.log(`[DEBUG] Optional auth - User authenticated: ${verification.user.email}`);
      } else {
        console.log(`[DEBUG] Optional auth - Session verification failed: ${verification.message}`);
        // Untuk optional auth, kita tetap set user basic info
        req.user = { 
          id: decoded.id
        };
      }
    } catch (dbError) {
      console.warn('[WARNING] Optional auth - Database error, using basic JWT verification');
      req.user = { 
        id: decoded.id
      };
    }

    next();

  } catch (error) {
    console.error('[ERROR] Optional auth middleware error:', error);
    // Untuk optional auth, kita lanjutkan meskipun ada error
    next();
  }
};

/**
 * Simple auth middleware untuk testing (tanpa database check)
 */
const simpleAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false,
        message: 'Access denied. No token provided.' 
      });
    }

    // Format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization header format'
      });
    }

    const token = parts[1].trim();
    
    // Validasi token
    if (!token || token === 'null' || token === 'undefined' || token.length < 10) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    console.log(`[DEBUG] Simple auth - Token preview: ${token.substring(0, 20)}...`);

    // Basic JWT verification saja (tanpa database check)
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid'
      });
    }

    // Set basic user info
    req.user = { 
      id: decoded.id
    };
    
    console.log(`[DEBUG] Simple auth - User authenticated with ID: ${decoded.id}`);
    next();

  } catch (error) {
    console.error('[ERROR] Simple auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Middleware untuk check jika user adalah admin
 */
const requireAdmin = async (req, res, next) => {
  try {
    // First, require authentication
    await requireAuth(req, res, (err) => {
      if (err) return next(err);
      
      // Check if user has admin role (you can customize this based on your user model)
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
      }
      
      next();
    });
  } catch (error) {
    console.error('[ERROR] Require admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Export sebagai object dengan methods
module.exports = {
  requireAuth,
  optionalAuth,
  simpleAuthMiddleware,
  requireAdmin
};

// Untuk backward compatibility, juga export default
module.exports.default = requireAuth;