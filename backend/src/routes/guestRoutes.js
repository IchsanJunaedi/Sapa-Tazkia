const express = require('express');
const router = express.Router();
const { guestChat, getGuestConversation } = require('../controllers/guestController');

/**
 * ============================================================================
 * RATE LIMITER SETUP FOR GUEST ROUTES
 * ============================================================================
 */

// ✅ IMPORT RATE LIMIT MIDDLEWARE UNTUK GUEST
let guestRateLimit;
let ipRateLimit;
let rateLimitService;

try {
  const rateLimitModule = require('../middleware/rateLimitMiddleware');
  guestRateLimit = rateLimitModule.guestRateLimit;
  ipRateLimit = rateLimitModule.ipRateLimit;
  
  // Import rate limit service untuk analytics
  rateLimitService = require('../services/rateLimitService');
  
  console.log('✅ [GUEST ROUTES] Rate limit middleware loaded successfully');
} catch (error) {
  console.error('❌ [GUEST ROUTES] Failed to load rate limit middleware:', error.message);
  
  // ✅ FALLBACK: Create safe fallback rate limiters
  const fallbackRateLimiter = (req, res, next) => {
    console.log('⚠️ [GUEST ROUTES] Using fallback rate limiter');
    next();
  };
  
  guestRateLimit = fallbackRateLimiter;
  ipRateLimit = fallbackRateLimiter;
  rateLimitService = null;
}

/**
 * ============================================================================
 * CUSTOM RATE LIMIT STRATEGY FOR GUEST ROUTES
 * ============================================================================
 */

// ✅ ENHANCED GUEST RATE LIMIT: Kombinasi IP + Guest limits
const enhancedGuestRateLimit = (req, res, next) => {
  // Skip rate limiting jika dimatikan di environment
  if (process.env.RATE_LIMIT_ENABLED === 'false') {
    return next();
  }

  console.log(`👤 [GUEST RATE LIMIT] Guest request from IP: ${req.ip}`);

  // Terapkan IP-based rate limiting terlebih dahulu
  ipRateLimit(req, res, (ipError) => {
    if (ipError) {
      console.log('🚫 [GUEST RATE LIMIT] IP rate limit exceeded:', ipError.message);
      return next(ipError);
    }

    // Terapkan guest-specific rate limiting
    guestRateLimit(req, res, (guestError) => {
      if (guestError) {
        console.log('🚫 [GUEST RATE LIMIT] Guest rate limit exceeded:', guestError.message);
        
        // Log analytics untuk guest rate limit hits
        if (rateLimitService) {
          rateLimitService.logRateLimitHit(req.ip, 'guest', 'minute', true)
            .catch(err => console.error('Failed to log rate limit hit:', err));
        }
      } else {
        // Log successful guest request untuk analytics
        if (rateLimitService) {
          rateLimitService.logRateLimitHit(req.ip, 'guest', 'minute', false)
            .catch(err => console.error('Failed to log rate limit hit:', err));
        }
      }
      
      next(guestError);
    });
  });
};

/**
 * ============================================================================
 * UTILITY FUNCTIONS FOR GUEST ROUTES
 * ============================================================================
 */

// ✅ UTILITY: Safe async handler
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ✅ UTILITY: Extract session ID dari request
const getSessionId = (req) => {
  return req.params.sessionId || 
         req.body.sessionId || 
         req.query.sessionId ||
         `guest_${req.ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
};

// ✅ UTILITY: Add rate limit headers to response
const addRateLimitHeaders = (res, rateLimitInfo) => {
  if (rateLimitInfo && rateLimitInfo.limit) {
    res.set({
      'X-RateLimit-Limit': rateLimitInfo.limit,
      'X-RateLimit-Remaining': rateLimitInfo.remaining || 0,
      'X-RateLimit-Reset': rateLimitInfo.resetTime,
      'X-RateLimit-User-Type': 'guest'
    });
  }
};

// ✅ UTILITY: Get client IP address
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
};

/**
 * ============================================================================
 * GUEST ROUTES WITH ENHANCED RATE LIMITING
 * ============================================================================
 */

// ✅ GUEST CHAT ROUTE - ENHANCED RATE LIMITING
router.post('/chat', 
  enhancedGuestRateLimit,
  asyncHandler(async (req, res, next) => {
    try {
      console.log('💬 [GUEST CHAT] New guest chat request');
      
      // Tambahkan IP address ke request body untuk tracking
      req.body.clientIP = getClientIP(req);
      req.body.userType = 'guest';
      
      // Panggil controller - TIDAK MENYIMPAN RESULT karena controller langsung mengirim response
      await guestChat(req, res);
      
      // ✅ PERBAIKAN: Jangan tambahkan rate_limit ke result karena controller sudah mengirim response
      // Jika ingin menambahkan rate limit info, lakukan di controller atau melalui headers saja
      
      console.log(`✅ [GUEST CHAT] Chat processed for IP: ${getClientIP(req)}`);
      
    } catch (error) {
      console.error('❌ [GUEST CHAT] Error:', error.message);
      
      // Handle rate limit errors specifically
      if (error.status === 429) {
        const retryAfter = error.retryAfter || 60;
        
        return res.status(429).json({
          success: false,
          error: 'rate_limit_exceeded',
          message: `Guest rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retry_after: retryAfter,
          user_type: 'guest',
          suggestion: 'Sign up for an account to get higher rate limits',
          timestamp: new Date().toISOString()
        });
      }
      
      next(error);
    }
  })
);

// ✅ GET GUEST CONVERSATION - LIGHTER RATE LIMITING
router.get('/conversation/:sessionId',
  ipRateLimit, // Hanya IP-based limiting untuk read operations
  asyncHandler(async (req, res, next) => {
    try {
      const sessionId = getSessionId(req);
      console.log(`📖 [GUEST CONVERSATION] Fetching conversation for session: ${sessionId}`);
      
      // Tambahkan sessionId ke request untuk controller
      req.params.sessionId = sessionId;
      req.clientIP = getClientIP(req);
      
      // Panggil controller - TIDAK MENYIMPAN RESULT
      await getGuestConversation(req, res);
      
      console.log(`✅ [GUEST CONVERSATION] Conversation retrieved for session: ${sessionId}`);
      
    } catch (error) {
      console.error('❌ [GUEST CONVERSATION] Error:', error.message);
      
      if (error.status === 429) {
        return res.status(429).json({
          success: false,
          error: 'rate_limit_exceeded',
          message: 'Too many requests. Please slow down.',
          retry_after: error.retryAfter || 30,
          user_type: 'guest',
          timestamp: new Date().toISOString()
        });
      }
      
      next(error);
    }
  })
);

/**
 * ============================================================================
 * NEW GUEST ROUTES FOR RATE LIMIT AWARENESS
 * ============================================================================
 */

// ✅ GUEST RATE LIMIT STATUS - PUBLIC (NO RATE LIMIT)
router.get('/rate-limit-status',
  asyncHandler(async (req, res) => {
    try {
      const clientIP = getClientIP(req);
      
      console.log(`📊 [GUEST RATE LIMIT STATUS] Request from IP: ${clientIP}`);
      
      if (rateLimitService) {
        const windowStatus = await rateLimitService.checkRateLimit(null, clientIP, 'guest');
        const bucketStatus = await rateLimitService.checkTokenBucket(null, clientIP, 'guest');
        
        const statusData = {
          success: true,
          data: {
            user_type: 'guest',
            ip_address: clientIP,
            window_limits: {
              allowed: windowStatus.allowed,
              limit: windowStatus.limit,
              remaining: windowStatus.remaining,
              reset_time: windowStatus.resetTime,
              retry_after: windowStatus.retryAfter,
              window: windowStatus.window
            },
            token_bucket: {
              allowed: bucketStatus.allowed,
              tokens: bucketStatus.tokens,
              retry_after: bucketStatus.retryAfter
            },
            policy: {
              requests_per_minute: 10,
              requests_per_hour: 50,
              requests_per_day: 200,
              burst_capacity: 5,
              note: 'Sign up for higher limits'
            }
          },
          timestamp: new Date().toISOString()
        };
        
        // Set headers untuk konsistensi
        addRateLimitHeaders(res, windowStatus);
        
        res.json(statusData);
      } else {
        // Fallback response jika rate limit service tidak available
        res.json({
          success: true,
          data: {
            user_type: 'guest',
            ip_address: clientIP,
            window_limits: {
              allowed: true,
              limit: 10,
              remaining: 9,
              reset_time: Date.now() + 60000,
              note: 'rate_limit_service_unavailable'
            },
            token_bucket: {
              allowed: true,
              tokens: 4,
              note: 'rate_limit_service_unavailable'
            },
            policy: {
              requests_per_minute: 10,
              requests_per_hour: 50,
              requests_per_day: 200,
              note: 'Estimated limits - service in fallback mode'
            }
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('❌ [GUEST RATE LIMIT STATUS] Error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'failed_to_get_rate_limit_status',
        message: 'Unable to retrieve rate limit status',
        timestamp: new Date().toISOString()
      });
    }
  })
);

// ✅ GUEST USAGE STATISTICS - PUBLIC (WITH IP RATE LIMIT)
router.get('/usage-stats/:sessionId?',
  ipRateLimit,
  asyncHandler(async (req, res) => {
    try {
      const sessionId = req.params.sessionId || getSessionId(req);
      const clientIP = getClientIP(req);
      
      console.log(`📈 [GUEST USAGE STATS] Request for session: ${sessionId}, IP: ${clientIP}`);
      
      // TODO: Implement usage statistics tracking
      // This would typically query your analytics database
      
      const stats = {
        success: true,
        data: {
          session_id: sessionId,
          ip_address: clientIP,
          user_type: 'guest',
          usage: {
            total_chats: 0, // Would be fetched from database
            today_chats: 0,
            last_active: new Date().toISOString()
          },
          limits: {
            daily_remaining: 200, // Would be calculated
            hourly_remaining: 50,
            minute_remaining: 10
          },
          note: 'Usage statistics tracking coming soon'
        },
        timestamp: new Date().toISOString()
      };
      
      res.json(stats);
    } catch (error) {
      console.error('❌ [GUEST USAGE STATS] Error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'failed_to_get_usage_stats',
        message: 'Unable to retrieve usage statistics',
        timestamp: new Date().toISOString()
      });
    }
  })
);

// ✅ GUEST SESSION INFO - PUBLIC (WITH IP RATE LIMIT)
router.get('/session-info/:sessionId',
  ipRateLimit,
  asyncHandler(async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      const clientIP = getClientIP(req);
      
      console.log(`🔍 [GUEST SESSION INFO] Request for session: ${sessionId}`);
      
      // Informasi session guest
      const sessionInfo = {
        success: true,
        data: {
          session_id: sessionId,
          ip_address: clientIP,
          user_type: 'guest',
          created_at: new Date().toISOString(), // Would be fetched from database
          is_active: true,
          conversation_count: 0, // Would be fetched from database
          last_activity: new Date().toISOString(),
          rate_limit_tier: 'guest'
        },
        timestamp: new Date().toISOString()
      };
      
      res.json(sessionInfo);
    } catch (error) {
      console.error('❌ [GUEST SESSION INFO] Error:', error.message);
      
      res.status(500).json({
        success: false,
        error: 'failed_to_get_session_info',
        message: 'Unable to retrieve session information',
        timestamp: new Date().toISOString()
      });
    }
  })
);

/**
 * ============================================================================
 * ERROR HANDLING MIDDLEWARE FOR GUEST ROUTES
 * ============================================================================
 */

// ✅ CUSTOM ERROR HANDLER FOR GUEST ROUTES
router.use((error, req, res, next) => {
  console.error('❌ [GUEST ROUTES ERROR] Unhandled error:', error);
  
  const clientIP = getClientIP(req);
  
  // Rate limit error handling
  if (error.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'rate_limit_exceeded',
      message: error.message || 'Too many requests. Please try again later.',
      retry_after: error.retryAfter || 60,
      user_type: 'guest',
      ip_address: clientIP,
      timestamp: new Date().toISOString(),
      suggestion: 'Please wait before making another request or sign up for an account'
    });
  }
  
  // General error handling
  res.status(error.status || 500).json({
    success: false,
    error: 'internal_server_error',
    message: 'An unexpected error occurred',
    user_type: 'guest',
    ip_address: clientIP,
    timestamp: new Date().toISOString()
  });
});

// ✅ 404 HANDLER FOR GUEST ROUTES
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'endpoint_not_found',
    message: 'Guest endpoint not found',
    available_endpoints: {
      'POST /api/guest/chat': 'Send chat message (rate limited)',
      'GET /api/guest/conversation/:sessionId': 'Get conversation history (light rate limit)',
      'GET /api/guest/rate-limit-status': 'Check current rate limit status',
      'GET /api/guest/usage-stats/:sessionId': 'Get usage statistics',
      'GET /api/guest/session-info/:sessionId': 'Get session information'
    },
    user_type: 'guest',
    timestamp: new Date().toISOString()
  });
});

/**
 * ============================================================================
 * GUEST ROUTES DOCUMENTATION
 * ============================================================================
 */

// ✅ GUEST ROUTES ROOT ENDPOINT - PUBLIC
router.get('/', (req, res) => {
  res.json({
    message: '👤 SAPA TAZKIA GUEST API v2.0 (Enhanced Rate Limiting)',
    description: 'Guest access endpoints for SAPA TAZKIA AI Chatbot',
    note: 'These endpoints do not require authentication but have rate limits',
    endpoints: {
      primary: {
        'POST /api/guest/chat': 'Send chat message (Enhanced Rate Limiting)',
        'GET /api/guest/conversation/:sessionId': 'Get conversation history (IP Rate Limiting)'
      },
      informational: {
        'GET /api/guest/rate-limit-status': 'Check your current rate limit status',
        'GET /api/guest/usage-stats/:sessionId': 'Get your usage statistics',
        'GET /api/guest/session-info/:sessionId': 'Get session information'
      }
    },
    rate_limits: {
      guest_chat: {
        requests_per_minute: 10,
        requests_per_hour: 50,
        requests_per_day: 200,
        burst_capacity: 5,
        note: 'Strict limits to prevent abuse'
      },
      guest_read_operations: {
        requests_per_minute: 20,
        note: 'Lighter limits for read-only operations'
      },
      ip_limits: {
        requests_per_minute: 20,
        note: 'Additional IP-based limits for security'
      }
    },
    benefits_of_registration: [
      'Higher rate limits (30/min, 200/hour, 1000/day)',
      'Conversation history persistence',
      'Personalized recommendations',
      'Academic performance analysis',
      'Study recommendations'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;