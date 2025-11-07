const { verifySession } = require('../services/authService');

/**
 * Middleware untuk protect route yang memerlukan authentication
 */
async function requireAuth(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token tidak ditemukan. Silakan login terlebih dahulu.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Verify session
    const sessionCheck = await verifySession(token);

    if (!sessionCheck.valid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: sessionCheck.message || 'Session tidak valid'
      });
    }

    // Attach user to request
    req.user = sessionCheck.user;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Terjadi kesalahan sistem'
    });
  }
}

/**
 * Optional auth - tidak wajib login tapi jika ada token akan di-verify
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const sessionCheck = await verifySession(token);
      
      if (sessionCheck.valid) {
        req.user = sessionCheck.user;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
}

module.exports = {
  requireAuth,
  optionalAuth
};