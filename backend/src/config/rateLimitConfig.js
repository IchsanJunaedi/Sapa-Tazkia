// backend/config/rateLimitConfig.js

const rateLimitConfig = {
  // Guest users (unauthenticated)
  guest: {
    requestsPerMinute: 10,
    requestsPerHour: 50,
    requestsPerDay: 200,
    burstCapacity: 5,
    windowMs: 60000, // 1 minute
    blockDuration: 300000, // 5 minutes if exceeded
    refillRate: 0.166, // tokens per second (10 tokens / 60 seconds)
  },
  
  // Authenticated users
  user: {
    requestsPerMinute: 30,
    requestsPerHour: 200,
    requestsPerDay: 1000,
    burstCapacity: 15,
    windowMs: 60000,
    blockDuration: 600000, // 10 minutes if exceeded
    refillRate: 0.5, // tokens per second (30 tokens / 60 seconds)
  },
  
  // Premium/users with special access
  premium: {
    requestsPerMinute: 100,
    requestsPerHour: 1000,
    requestsPerDay: 5000,
    burstCapacity: 50,
    windowMs: 60000,
    blockDuration: 300000,
    refillRate: 1.666, // tokens per second (100 tokens / 60 seconds)
  },
  
  // IP-based limiting for additional security
  ip: {
    requestsPerMinute: 20,
    requestsPerHour: 100,
    requestsPerDay: 500,
    windowMs: 60000,
  },
  
  // Adaptive limits based on system load
  adaptive: {
    enabled: true,
    loadThreshold: 0.8, // 80% capacity
    reductionFactor: 0.5, // Reduce limits by 50% under high load
  },

  // Redis configuration
  redis: {
    prefix: 'rate_limit:',
    expiryMargin: 5000, // 5 seconds margin for expiry
  },

  // Token bucket configuration
  tokenBucket: {
    enabled: true,
    cleanupInterval: 3600000, // 1 hour
  }
};

// Development overrides
if (process.env.NODE_ENV === 'development') {
  // More lenient limits for development
  rateLimitConfig.guest.requestsPerMinute = 20;
  rateLimitConfig.user.requestsPerMinute = 50;
  rateLimitConfig.ip.requestsPerMinute = 30;
  
  console.log('🔧 [RATE LIMIT] Development mode - using increased limits');
}

// Test environment overrides  
if (process.env.NODE_ENV === 'test') {
  // Very high limits for testing
  rateLimitConfig.guest.requestsPerMinute = 1000;
  rateLimitConfig.user.requestsPerMinute = 1000;
  rateLimitConfig.premium.requestsPerMinute = 1000;
  rateLimitConfig.ip.requestsPerMinute = 1000;
}

module.exports = rateLimitConfig;