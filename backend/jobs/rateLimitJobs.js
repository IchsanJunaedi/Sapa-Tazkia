const cron = require('node-cron');
const rateLimitService = require('../services/rateLimitService');
const analyticsService = require('../../frontend/src/services/analyticsService');

class RateLimitJobs {
  init() {
    // Cleanup expired data every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Running rate limit data cleanup...');
      await rateLimitService.cleanupExpiredData();
    });

    // Analytics report every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log('Generating rate limit analytics report...');
      const stats = await analyticsService.getSystemWideStats('24h');
      this.logAnalytics(stats);
    });

    // System health check every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.healthCheck();
    });
  }

  async healthCheck() {
    const redisHealth = await require('../services/redisService').healthCheck();
    const dbHealth = await this.checkDatabaseHealth();
    
    if (!redisHealth || !dbHealth) {
      console.error('Rate limit system health check failed');
      // Implement alerting here (email, Slack, etc.)
    }
  }

  async checkDatabaseHealth() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      return false;
    }
  }

  logAnalytics(stats) {
    console.log('=== Rate Limit Analytics ===');
    Object.keys(stats).forEach(endpoint => {
      const endpointStats = stats[endpoint];
      const blockRate = (endpointStats.blocked / endpointStats.total * 100).toFixed(2);
      console.log(`${endpoint}: ${endpointStats.allowed} allowed, ${endpointStats.blocked} blocked (${blockRate}% block rate)`);
    });
  }
}

module.exports = new RateLimitJobs();