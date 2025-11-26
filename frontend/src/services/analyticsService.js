const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AnalyticsService {
  async trackRequest(userId, ipAddress, endpoint, wasBlocked = false) {
    try {
      await prisma.rateLimitLog.create({
        data: {
          userId,
          ipAddress,
          endpoint,
          method: 'POST',
          statusCode: wasBlocked ? 429 : 200,
          wasBlocked,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to track request:', error);
    }
  }

  async getSystemWideStats(timeRange = '24h') {
    const timeRanges = {
      '1h': 3600000,
      '24h': 86400000,
      '7d': 604800000
    };

    const startTime = new Date(Date.now() - timeRanges[timeRange]);

    const stats = await prisma.rateLimitLog.groupBy({
      by: ['wasBlocked', 'endpoint'],
      where: {
        timestamp: {
          gte: startTime
        }
      },
      _count: {
        id: true
      }
    });

    return this.aggregateStats(stats);
  }

  aggregateStats(stats) {
    return stats.reduce((acc, curr) => {
      if (!acc[curr.endpoint]) {
        acc[curr.endpoint] = { allowed: 0, blocked: 0, total: 0 };
      }
      
      if (curr.wasBlocked) {
        acc[curr.endpoint].blocked += curr._count.id;
      } else {
        acc[curr.endpoint].allowed += curr._count.id;
      }
      
      acc[curr.endpoint].total += curr._count.id;
      return acc;
    }, {});
  }

  async getTopBlockedIPs(limit = 10) {
    const result = await prisma.rateLimitLog.groupBy({
      by: ['ipAddress'],
      where: {
        wasBlocked: true,
        timestamp: {
          gte: new Date(Date.now() - 86400000) // 24 hours
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: limit
    });

    return result;
  }
}

module.exports = new AnalyticsService();