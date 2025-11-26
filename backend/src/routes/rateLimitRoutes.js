const express = require('express');
const router = express.Router();

console.log('🔄 [RATE LIMIT ROUTES] Initializing routes...');

// Simple fallback controller functions
const fallbackController = {
  getRateLimitStatus: (req, res) => {
    console.log('📊 [RATE LIMIT] Status endpoint called');
    res.json({ 
      success: true, 
      message: 'Rate limit status endpoint', 
      usingFallback: true,
      user: req.user || null,
      timestamp: new Date().toISOString()
    });
  },
  
  getRateLimitAnalytics: (req, res) => {
    console.log('📈 [RATE LIMIT] Analytics endpoint called');
    res.json({ 
      success: true, 
      message: 'Rate limit analytics endpoint', 
      usingFallback: true,
      timestamp: new Date().toISOString()
    });
  },
  
  resetRateLimit: (req, res) => {
    console.log('🔄 [RATE LIMIT] Reset endpoint called');
    res.json({ 
      success: true, 
      message: 'Rate limit reset endpoint', 
      usingFallback: true,
      timestamp: new Date().toISOString()
    });
  }
};

// Simple middleware functions
const fallbackAuth = (req, res, next) => {
  req.user = req.user || null;
  next();
};

const fallbackRateLimit = (req, res, next) => {
  next();
};

// Try to load actual controllers and middleware
let rateLimitController = fallbackController;
let authMiddleware = { authenticate: fallbackAuth };
let userRateLimit = fallbackRateLimit;

try {
  // Load controller
  const controllerModule = require('../controllers/rateLimitController');
  if (controllerModule && typeof controllerModule.getRateLimitStatus === 'function') {
    rateLimitController = controllerModule;
    console.log('✅ [RATE LIMIT ROUTES] Controller loaded successfully');
  }
} catch (error) {
  console.warn('⚠️ [RATE LIMIT ROUTES] Using fallback controller:', error.message);
}

try {
  // Load middleware
  const authModule = require('../middleware/authMiddleware');
  const rateLimitModule = require('../middleware/rateLimitMiddleware');
  
  if (authModule && authModule.authenticate) {
    authMiddleware = authModule;
  }
  if (rateLimitModule && rateLimitModule.userRateLimit) {
    userRateLimit = rateLimitModule.userRateLimit;
  }
  console.log('✅ [RATE LIMIT ROUTES] Middleware loaded successfully');
} catch (error) {
  console.warn('⚠️ [RATE LIMIT ROUTES] Using fallback middleware:', error.message);
}

// ✅ SIMPLE ROUTES - tanpa complex logic
router.get('/status', 
  authMiddleware.authenticate, 
  userRateLimit, 
  (req, res) => rateLimitController.getRateLimitStatus(req, res)
);

router.get('/analytics', 
  authMiddleware.authenticate, 
  userRateLimit, 
  (req, res) => rateLimitController.getRateLimitAnalytics(req, res)
);

router.post('/reset', 
  authMiddleware.authenticate, 
  userRateLimit, 
  (req, res) => rateLimitController.resetRateLimit(req, res)
);

// Service status endpoint
router.get('/service-status', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Rate Limit API',
      status: 'running', 
      timestamp: new Date().toISOString()
    }
  });
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Rate limit API is working! 🎉',
    endpoints: [
      'GET /api/rate-limit/status',
      'GET /api/rate-limit/analytics',
      'POST /api/rate-limit/reset', 
      'GET /api/rate-limit/service-status',
      'GET /api/rate-limit/test'
    ],
    timestamp: new Date().toISOString()
  });
});

console.log('✅ [RATE LIMIT ROUTES] All routes registered successfully');

module.exports = router;