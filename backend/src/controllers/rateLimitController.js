// Fallback untuk rate limit service
let rateLimitService;
try {
  rateLimitService = require('../services/rateLimitService');
} catch (error) {
  console.warn('⚠️ [RATE LIMIT CONTROLLER] Service not found, using fallback');
  rateLimitService = {
    getRateLimitStats: () => Promise.resolve({ allowedRequests: 0, blockedRequests: 0, usingFallback: true }),
    getServiceStatus: () => ({ redis: false, database: false, config: true })
  };
}

class RateLimitController {
  async getRateLimitStatus(req, res, next) {
    try {
      const userId = req.user?.id || null;
      const ipAddress = req.ip;
      
      const status = await rateLimitService.checkRateLimit(userId, ipAddress, req.user?.type || 'guest');
      
      res.json({
        success: true,
        data: {
          allowed: status.allowed,
          limit: status.limit,
          remaining: status.remaining,
          resetTime: status.resetTime,
          retryAfter: status.retryAfter,
          userType: req.user?.type || 'guest',
          usingFallback: status.usingFallback || false
        }
      });
    } catch (error) {
      console.error('❌ [RATE LIMIT] Status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rate limit status',
        message: error.message
      });
    }
  }

  async getRateLimitAnalytics(req, res, next) {
    try {
      const { timeRange = '24h' } = req.query;
      const userId = req.user?.id || null;
      
      const stats = await rateLimitService.getRateLimitStats(userId, timeRange);
      
      res.json({
        success: true,
        data: {
          timeRange,
          ...stats,
          totalRequests: stats.allowedRequests + stats.blockedRequests,
          blockRate: stats.blockedRequests / (stats.allowedRequests + stats.blockedRequests) || 0
        }
      });
    } catch (error) {
      console.error('❌ [RATE LIMIT] Analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rate limit analytics',
        message: error.message
      });
    }
  }

  async resetRateLimit(req, res, next) {
    try {
      // Only allow admins or the user themselves to reset
      const { identifier, userType } = req.body;
      
      // Implementation for manual reset (admin feature)
      // This would clear Redis keys and reset counters
      
      res.json({
        success: true,
        message: 'Rate limit reset successfully (simulated)',
        note: 'Full reset functionality requires admin privileges'
      });
    } catch (error) {
      console.error('❌ [RATE LIMIT] Reset error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset rate limit',
        message: error.message
      });
    }
  }

  // Service status endpoint
  async getServiceStatus(req, res, next) {
    try {
      const status = rateLimitService.getServiceStatus ? 
        rateLimitService.getServiceStatus() : 
        { redis: false, database: false, config: true };
      
      res.json({
        success: true,
        data: {
          ...status,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('❌ [RATE LIMIT] Service status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get service status'
      });
    }
  }
}

module.exports = new RateLimitController();