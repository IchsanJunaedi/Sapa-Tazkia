const express = require('express');
const router = express.Router();
const { getClientIp } = require('request-ip'); 
const guestController = require('../controllers/guestController');
// ✅ Import controller status yang baru
const rateLimitController = require('../controllers/rateLimitController'); 

// ✅ Import Middleware & Service
const { guestRateLimit, ipRateLimit } = require('../middleware/rateLimitMiddleware');
const rateLimitService = require('../services/rateLimitService');

/**
 * ============================================================================
 * UTILITIES
 * ============================================================================
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const getSessionId = (req) => {
  return req.params.sessionId || 
         req.body.sessionId || 
         req.query.sessionId ||
         `guest_${getClientIp(req).replace(/[^a-zA-Z0-9]/g, '_')}`;
};

/**
 * ============================================================================
 * PRIMARY GUEST ROUTES
 * ============================================================================
 */

// 1. CHAT ROUTE (Limit Token Harian)
router.post('/chat', 
  guestRateLimit, 
  asyncHandler(async (req, res) => {
    const clientIp = getClientIp(req);
    // Inject info tambahan
    req.body.clientIP = clientIp;
    req.body.userType = 'guest';
    
    await guestController.guestChat(req, res);
  })
);

// 2. CONVERSATION HISTORY (Limit Ringan)
router.get('/conversation/:sessionId',
  ipRateLimit,
  asyncHandler(async (req, res) => {
    const sessionId = getSessionId(req);
    req.params.sessionId = sessionId;
    await guestController.getGuestConversation(req, res);
  })
);

/**
 * ============================================================================
 * INFORMATIONAL & UTILITY ROUTES
 * ============================================================================
 */

// 3. CHECK STATUS RATE LIMIT (Digunakan oleh Frontend Bar)
// ✅ FIX: Menggunakan controller yang aman (RateLimitController)
router.get('/rate-limit-status', rateLimitController.getRateLimitStatus);

// 4. RESET LIMIT (Untuk Testing/Dev)
// Akses browser: http://localhost:5000/api/guest/reset-limit
router.get('/reset-limit', asyncHandler(async (req, res) => {
  const clientIp = getClientIp(req);
  // Hapus key di Redis
  const usageKey = rateLimitService.getDailyKey(clientIp);
  const spamKey = `spam_protect:${clientIp}`;
  
  // Kita perlu akses redisService untuk del (opsional, via service lebih rapi tapi ini shortcut)
  const redisService = require('../services/redisService');
  await redisService.del(usageKey);
  await redisService.del(spamKey);

  res.json({
    success: true,
    message: `Limit for IP ${clientIp} has been reset to 0 used.`,
    timestamp: new Date().toISOString()
  });
}));

/**
 * ============================================================================
 * ROOT DOCUMENTATION
 * ============================================================================
 */
router.get('/', (req, res) => {
  // Ambil config dinamis
  const guestConfig = rateLimitService.config.guest;

  res.json({
    message: '👤 SAPA TAZKIA GUEST API v2.0',
    status: 'Operational',
    security: 'Token Bucket Rate Limiting',
    endpoints: {
      '/chat': 'POST - Send message',
      '/conversation/:sessionId': 'GET - Retrieve history',
      '/rate-limit-status': 'GET - Check quota',
      '/reset-limit': 'GET - Reset quota (Dev)'
    },
    current_policy: {
      limit: `${guestConfig.tokenLimitDaily} tokens/day`,
      spam_check: `${guestConfig.spamLimitPerMinute} requests/min`
    }
  });
});

module.exports = router;