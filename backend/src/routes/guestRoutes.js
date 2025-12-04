const express = require('express');
const router = express.Router();
const { getClientIp } = require('request-ip'); 
const { guestChat, getGuestConversation } = require('../controllers/guestController');

// ✅ IMPORT MIDDLEWARE & SERVICE TERPUSAT
const { guestRateLimit, ipRateLimit } = require('../middleware/rateLimitMiddleware');
const rateLimitService = require('../services/rateLimitService');

/**
 * ============================================================================
 * UTILITIES
 * ============================================================================
 */

// Wrapper agar tidak perlu try-catch di setiap route
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Ekstrak Session ID dengan aman
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

// 1. CHAT ROUTE (Limit Ketat: 5/menit)
// Middleware 'guestRateLimit' otomatis menangani checking, blocking, dan headers.
router.post('/chat', 
  guestRateLimit, 
  asyncHandler(async (req, res) => {
    const clientIp = getClientIp(req);
    console.log(`💬 [GUEST CHAT] Request from IP: ${clientIp}`);
    
    // Inject info tambahan ke request body untuk controller
    req.body.clientIP = clientIp;
    req.body.userType = 'guest';
    
    // Controller langsung handle logic & response
    await guestChat(req, res);
  })
);

// 2. CONVERSATION HISTORY (Limit Ringan via IP: default guest config)
// Kita gunakan ipRateLimit untuk melindungi dari scraping data
router.get('/conversation/:sessionId',
  ipRateLimit,
  asyncHandler(async (req, res) => {
    const sessionId = getSessionId(req);
    console.log(`📖 [GUEST HISTORY] Fetching session: ${sessionId}`);
    
    req.params.sessionId = sessionId;
    await getGuestConversation(req, res);
  })
);

/**
 * ============================================================================
 * INFORMATIONAL ROUTES (Advanced Real-time Status)
 * ============================================================================
 */

// 3. CHECK STATUS RATE LIMIT (Real-time Redis Check)
router.get('/rate-limit-status', asyncHandler(async (req, res) => {
  const clientIp = getClientIp(req);
  
  // Kita intip status limit tanpa menambah counter (Dry Run)
  // Mengambil konfigurasi dari Service yang sudah load .env
  const config = rateLimitService.config.guest;
  
  // Cek penggunaan saat ini (Estimasi dari Redis)
  // Note: Ini manual lookup ke RedisService
  const minuteKey = rateLimitService.generateKey(clientIp, 'guest', 'minute');
  const redisService = require('../services/redisService'); // Direct access untuk "peek"
  const currentUsage = await redisService.get(minuteKey) || 0;
  
  res.json({
    success: true,
    data: {
      ip: clientIp,
      status: currentUsage >= config.requestsPerMinute ? 'BLOCKED' : 'OK',
      limits: {
        per_minute: {
          limit: config.requestsPerMinute,
          used: parseInt(currentUsage),
          remaining: Math.max(0, config.requestsPerMinute - currentUsage)
        },
        per_hour: config.requestsPerHour,
        per_day: config.requestsPerDay
      },
      reset_in_seconds: 60 // Estimasi window reset
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * ============================================================================
 * DOCUMENTATION ROUTE (Dynamic based on ENV)
 * ============================================================================
 */
router.get('/', (req, res) => {
  // Ambil config dinamis agar dokumentasi selalu sesuai dengan .env
  const guestConfig = rateLimitService.config.guest;

  res.json({
    message: '👤 SAPA TAZKIA GUEST API v2.0',
    status: 'Operational',
    security: 'Enhanced Atomic Rate Limiting',
    endpoints: {
      '/chat': 'POST - Send message',
      '/conversation/:sessionId': 'GET - Retrieve history',
      '/rate-limit-status': 'GET - Check quota'
    },
    current_policy: {
      description: 'Limits are dynamically enforced based on server load',
      limits: {
        minute: `${guestConfig.requestsPerMinute} requests/min`,
        hour: `${guestConfig.requestsPerHour} requests/hour`,
        day: `${guestConfig.requestsPerDay} requests/day`
      },
      note: 'Register with @student.tazkia.ac.id for 4x higher limits.'
    }
  });
});

module.exports = router;