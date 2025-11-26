const rateLimitService = require('../services/rateLimitService');
const redisService = require('../services/redisService');

// Fallback config
const rateLimitConfig = {
  guest: { requestsPerMinute: 10 },
  user: { requestsPerMinute: 30 },
  premium: { requestsPerMinute: 100 },
  ip: { requestsPerMinute: 20 }
};

// SIMPLE rate limit middleware - tanpa nested callbacks
const rateLimitMiddleware = (userType = 'guest') => {
  return async (req, res, next) => {
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return next();
    }

    try {
      const userId = req.user?.id || null;
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      const result = await rateLimitService.checkRateLimit(userId, ipAddress, userType);

      if (!result.allowed) {
        // Set headers dan langsung return response
        res.set({
          'X-RateLimit-Limit': result.limit,
          'X-RateLimit-Remaining': result.remaining || 0,
          'X-RateLimit-Reset': result.resetTime,
          'Retry-After': result.retryAfter
        });

        return res.status(429).json({
          success: false,
          error: 'rate_limit_exceeded',
          message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds`,
          retry_after: result.retryAfter,
          limit: result.limit,
          reset_time: result.resetTime
        });
      }

      // Set headers untuk successful requests
      res.set({
        'X-RateLimit-Limit': result.limit,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': result.resetTime
      });

      next();
    } catch (error) {
      // Jika ada error di rate limit service, continue tanpa rate limiting
      console.warn('⚠️ [RATE LIMIT] Service error, continuing without rate limit:', error.message);
      next();
    }
  };
};

// Simple IP rate limit - STANDALONE, tidak nested
const ipRateLimit = async (req, res, next) => {
  if (process.env.RATE_LIMIT_ENABLED === 'false') {
    return next();
  }

  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const ipKey = `ip_limit:${ipAddress}`;
    
    const requestCount = await redisService.incr(ipKey);
    
    if (requestCount === 1) {
      try {
        await redisService.set(ipKey, 1, 60000); // Simple set with expiry
      } catch (error) {
        // Ignore expiry errors
      }
    }
    
    const ipLimit = rateLimitConfig.ip.requestsPerMinute;
    
    if (requestCount > ipLimit) {
      return res.status(429).json({
        success: false,
        error: 'ip_rate_limit_exceeded',
        message: 'IP rate limit exceeded. Please try again in 60 seconds.',
        retry_after: 60
      });
    }
    
    // Set headers dan continue
    res.set({
      'X-RateLimit-Limit': ipLimit,
      'X-RateLimit-Remaining': Math.max(0, ipLimit - requestCount),
      'X-RateLimit-User-Type': 'ip'
    });
    
    next();
  } catch (error) {
    // Jika Redis error, continue tanpa IP limiting
    console.warn('⚠️ [RATE LIMIT] IP limit failed, continuing:', error.message);
    next();
  }
};

// Simple specialized middlewares
const guestRateLimit = rateLimitMiddleware('guest');
const userRateLimit = rateLimitMiddleware('user');
const premiumRateLimit = rateLimitMiddleware('premium');

// COMBINATION middlewares - SEQUENTIAL, tidak nested
const enhancedGuestRateLimit = [ipRateLimit, guestRateLimit];
const aiSpecificRateLimit = [ipRateLimit, (req, res, next) => {
  if (req.user) {
    if (req.user.isPremium || req.user.role === 'premium') {
      return premiumRateLimit(req, res, next);
    } else {
      return userRateLimit(req, res, next);
    }
  } else {
    return guestRateLimit(req, res, next);
  }
}];

module.exports = {
  rateLimitMiddleware,
  guestRateLimit,
  userRateLimit,
  premiumRateLimit,
  ipRateLimit,
  enhancedGuestRateLimit, // Array of middlewares
  aiSpecificRateLimit     // Array of middlewares
};