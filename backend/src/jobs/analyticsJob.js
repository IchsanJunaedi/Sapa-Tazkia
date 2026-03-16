/**
 * analyticsJob.js
 *
 * Background job that aggregates daily analytics into the AnalyticsSnapshot table.
 * Runs every 30 minutes and once immediately on startup.
 *
 * Pattern mirrors rateLimitJobs.js: exports { init }.
 */

const prisma = require('../config/prismaClient');

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Compute and upsert today's AnalyticsSnapshot record.
 * All time boundaries are UTC calendar-day aligned.
 */
async function runSnapshot() {
  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayDate = todayStart; // used as the @db.Date key for upsert

    // ------------------------------------------------------------------
    // 1. userChats — count of Message records with role='user' since todayStart
    // ------------------------------------------------------------------
    const userChatsResult = await prisma.message.count({
      where: {
        role: 'user',
        createdAt: { gte: todayStart },
      },
    });
    const userChats = userChatsResult;

    // ------------------------------------------------------------------
    // 2. totalTokens — sum of tokenUsage from today's messages
    // ------------------------------------------------------------------
    const tokenSumResult = await prisma.message.aggregate({
      _sum: { tokenUsage: true },
      where: {
        createdAt: { gte: todayStart },
      },
    });
    const totalTokens = tokenSumResult._sum.tokenUsage ?? 0;

    // ------------------------------------------------------------------
    // 3. uniqueUsers — distinct userId values from Conversations that have
    //    at least one message today (userId is on Conversation, not Message).
    //    We find all distinct conversationIds from today's messages, then
    //    look up the distinct userIds from those conversations.
    // ------------------------------------------------------------------
    const todayConversations = await prisma.message.findMany({
      where: {
        createdAt: { gte: todayStart },
      },
      select: { conversationId: true },
      distinct: ['conversationId'],
    });

    const conversationIds = todayConversations.map((m) => m.conversationId);

    let uniqueUsers = 0;
    if (conversationIds.length > 0) {
      const distinctUserConvs = await prisma.conversation.findMany({
        where: {
          id: { in: conversationIds },
          // isGuest conversations have a placeholder userId; we only want
          // real authenticated users (isGuest = false)
          isGuest: false,
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      uniqueUsers = distinctUserConvs.length;
    }

    // ------------------------------------------------------------------
    // 4. guestChats — successful guest chat requests logged today
    // ------------------------------------------------------------------
    const guestChats = await prisma.rateLimitLog.count({
      where: {
        endpoint: '/api/guest/chat',
        timestamp: { gte: todayStart },
        wasBlocked: false,
        statusCode: { lt: 400 },
      },
    });

    // ------------------------------------------------------------------
    // 5. hourlyData — group today's user messages by UTC hour
    //    Fetch createdAt for today's user messages, then bucket in JS.
    // ------------------------------------------------------------------
    const todayUserMessages = await prisma.message.findMany({
      where: {
        role: 'user',
        createdAt: { gte: todayStart },
      },
      select: { createdAt: true },
    });

    // Initialize all 24 hours to 0 for dense keys (frontend can safely access any hour)
    const hourlyData = {};
    for (let h = 0; h < 24; h++) hourlyData[String(h)] = 0;
    for (const msg of todayUserMessages) {
      const hour = String(msg.createdAt.getUTCHours());
      hourlyData[hour] = (hourlyData[hour] || 0) + 1;
    }

    // ------------------------------------------------------------------
    // 6. totalChats = userChats + guestChats
    // ------------------------------------------------------------------
    const totalChats = userChats + guestChats;

    // ------------------------------------------------------------------
    // 7. avgResponseTime — average responseTime of bot messages today
    // ------------------------------------------------------------------
    const responseTimeAgg = await prisma.message.aggregate({
      _avg: { responseTime: true },
      where: {
        role: 'bot',
        responseTime: { not: null },
        createdAt: { gte: todayStart }
      }
    });
    const avgResponseTime = responseTimeAgg._avg.responseTime ?? null;

    // ------------------------------------------------------------------
    // 8. errorCount — count of bot messages with isError=true today
    // ------------------------------------------------------------------
    const errorCount = await prisma.message.count({
      where: {
        role: 'bot',
        isError: true,
        createdAt: { gte: todayStart }
      }
    });

    // ------------------------------------------------------------------
    // 9. topQuestions — top 5 most frequent user messages from last 7 days
    // ------------------------------------------------------------------
    const sevenDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7));
    const recentUserMessages = await prisma.message.findMany({
      where: { role: 'user', createdAt: { gte: sevenDaysAgo } },
      select: { content: true }
    });
    // Count frequency of trimmed+lowercased questions (truncate to 120 chars as key)
    const freq = {};
    for (const m of recentUserMessages) {
      const key = m.content.trim().toLowerCase().slice(0, 120);
      if (key.length < 5) continue; // skip very short messages
      freq[key] = (freq[key] || 0) + 1;
    }
    const topQuestions = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([question, count]) => ({ question, count }));

    // ------------------------------------------------------------------
    // 10. Upsert AnalyticsSnapshot for today
    // ------------------------------------------------------------------
    await prisma.analyticsSnapshot.upsert({
      where: { date: todayDate },
      update: { totalChats, userChats, guestChats, totalTokens, uniqueUsers, hourlyData, avgResponseTime, errorCount, topQuestions },
      create: { date: todayDate, totalChats, userChats, guestChats, totalTokens, uniqueUsers, hourlyData, avgResponseTime, errorCount, topQuestions },
    });

    console.log(
      `[analyticsJob] Snapshot saved for ${todayDate.toISOString().slice(0, 10)}: ` +
        `totalChats=${totalChats} userChats=${userChats} guestChats=${guestChats} ` +
        `tokens=${totalTokens} uniqueUsers=${uniqueUsers} ` +
        `avgResponseTime=${avgResponseTime} errorCount=${errorCount} topQuestions=${topQuestions.length}`
    );
  } catch (err) {
    console.error('[analyticsJob] runSnapshot failed:', err);
  }
}

/**
 * Initialize the analytics background job.
 * Runs once immediately, then every 30 minutes.
 */
function init() {
  console.log('[analyticsJob] Initializing — running first snapshot now, then every 30 minutes');
  runSnapshot();
  setInterval(runSnapshot, INTERVAL_MS);
}

module.exports = { init };
