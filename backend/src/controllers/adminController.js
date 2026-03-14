const prisma = require('../config/prismaClient');
const guestController = require('./guestController');

/**
 * Get unified chat logs (Users + Guests)
 * Accessible only by Admins
 */
const getChatLogs = async (req, res) => {
    try {
        // 1. Fetch DB Messages (Authenticated Users)
        // Here we need conversations that are not flagged as guest (or we can just fetch all from DB)
        // As per schema, we have Conversation with messages, and User
        const dbConversations = await prisma.conversation.findMany({
            include: {
                user: { select: { fullName: true, email: true, userType: true } },
                messages: { orderBy: { createdAt: 'asc' } }
            },
            orderBy: { updatedAt: 'desc' },
            take: 50 // Limit for now
        });

        const formattedDbLogs = dbConversations.flatMap(conv => {
            // Group messages by pairs (user + bot) simply by iterating
            const pairs = [];
            for (let i = 0; i < conv.messages.length; i++) {
                if (conv.messages[i].role === 'user') {
                    const userMsg = conv.messages[i];
                    const botMsg = (i + 1 < conv.messages.length && conv.messages[i + 1].role === 'bot') ? conv.messages[i + 1] : null;

                    pairs.push({
                        id: `db-${userMsg.id}`,
                        timestamp: userMsg.createdAt,
                        userType: 'User',
                        identifier: conv.user?.fullName || conv.user?.email || 'Unknown User',
                        message: userMsg.content,
                        response: botMsg ? botMsg.content : 'No response',
                        tokens: botMsg ? botMsg.tokenUsage : null
                    });
                }
            }
            return pairs;
        });

        // 2. Fetch Guest Sessions (from Memory)
        // Since guestSessions isn't directly exported as iterable we might need to expose it,
        // or we just estimate. Wait, let's look at guestController.js if it exposes getGuestSessions.
        // It doesn't. We'll add a minimal exposed function or just mock it temporarily until we update guestController.
        let formattedGuestLogs = [];
        if (typeof guestController.getAllActiveSessions === 'function') {
            const guestSessions = guestController.getAllActiveSessions();
            for (const [sessionId, session] of guestSessions.entries()) {
                for (let i = 0; i < session.messages.length; i++) {
                    if (session.messages[i].role === 'user') {
                        const userMsg = session.messages[i];
                        const botMsg = (i + 1 < session.messages.length && session.messages[i + 1].role === 'bot') ? session.messages[i + 1] : null;

                        formattedGuestLogs.push({
                            id: `guest-${sessionId}-${i}`,
                            timestamp: session.createdAt, // approximation
                            userType: 'Guest',
                            identifier: sessionId,
                            message: userMsg.content,
                            response: botMsg ? botMsg.content : 'No response',
                            tokens: botMsg ? botMsg.tokenUsage : null
                        });
                    }
                }
            }
        }

        // 3. Combine and Sort
        const unifiedLogs = [...formattedDbLogs, ...formattedGuestLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        console.log(`[ADMIN DASHBOARD] Retrieved ${formattedDbLogs.length} DB pairs and ${formattedGuestLogs.length} Guest pairs. Total: ${unifiedLogs.length}`);

        res.json({
            success: true,
            logs: unifiedLogs
        });
    } catch (error) {
        console.error('❌ [ADMIN] Fetch Chat Logs Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/**
 * GET /api/admin/analytics/realtime
 * Live KPIs for today — no caching.
 */
const getRealtimeAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        const yesterdayDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));

        const [
            userChatsCount,
            tokenAgg,
            activeUserGroups,
            guestChatsCount,
            yesterdaySnapshot
        ] = await Promise.all([
            // 1. Count user messages today
            prisma.message.count({
                where: {
                    role: 'user',
                    createdAt: { gte: todayStart }
                }
            }),

            // 2. Sum tokenUsage from today's messages
            prisma.message.aggregate({
                _sum: { tokenUsage: true },
                where: {
                    createdAt: { gte: todayStart }
                }
            }),

            // 3. Active distinct users today — group conversations by userId
            //    where the conversation has at least one message today
            prisma.conversation.groupBy({
                by: ['userId'],
                where: {
                    messages: {
                        some: { createdAt: { gte: todayStart } }
                    }
                }
            }),

            // 4. Guest chats today from RateLimitLog
            prisma.rateLimitLog.count({
                where: {
                    endpoint: '/api/guest/chat',
                    timestamp: { gte: todayStart },
                    wasBlocked: false,
                    statusCode: { lt: 400 }
                }
            }),

            // 5. Yesterday's snapshot for delta calculation
            prisma.analyticsSnapshot.findFirst({
                where: { date: yesterdayDate }
            })
        ]);

        const totalTokens = tokenAgg._sum.tokenUsage ?? 0;
        const activeUsers = activeUserGroups.length;
        const chatToday = userChatsCount + guestChatsCount;

        const calcDelta = (today, yesterday) => {
            if (!yesterday || yesterday === 0) return null;
            return parseFloat(((today - yesterday) / yesterday * 100).toFixed(1));
        };

        const delta = {
            chatToday: calcDelta(chatToday, yesterdaySnapshot?.totalChats),
            activeUsers: calcDelta(activeUsers, yesterdaySnapshot?.uniqueUsers),
            tokensUsed: calcDelta(totalTokens, yesterdaySnapshot?.totalTokens)
        };

        res.json({
            success: true,
            realtime: {
                chatToday,
                activeUsers,
                tokensUsed: totalTokens,
                guestChats: guestChatsCount,
                userChats: userChatsCount,
                delta
            }
        });
    } catch (error) {
        console.error('❌ [ADMIN] getRealtimeAnalytics Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/**
 * GET /api/admin/analytics/history?range=7d|30d
 * Historical analytics from AnalyticsSnapshot + top users.
 */
const getHistoryAnalytics = async (req, res) => {
    try {
        const now = new Date();
        const days = req.query.range === '30d' ? 30 : 7;
        const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));

        const [snapshots, messageGroups] = await Promise.all([
            // Fetch snapshots in range ordered by date asc
            prisma.analyticsSnapshot.findMany({
                where: { date: { gte: rangeStart } },
                orderBy: { date: 'asc' }
            }),

            // Group messages by conversationId to get per-user counts
            prisma.message.groupBy({
                by: ['conversationId'],
                _count: { id: true },
                _sum: { tokenUsage: true },
                where: {
                    role: 'user',
                    createdAt: { gte: rangeStart }
                }
            })
        ]);

        // Fetch the conversations referenced in messageGroups to get userIds
        const convIds = messageGroups.map(g => g.conversationId);
        const conversations = convIds.length > 0
            ? await prisma.conversation.findMany({
                where: { id: { in: convIds } },
                select: { id: true, userId: true }
            })
            : [];

        // Build a map: conversationId -> userId
        const convUserMap = {};
        for (const conv of conversations) {
            convUserMap[conv.id] = conv.userId;
        }

        // Aggregate per userId: total messages and tokens
        const userStatsMap = {};
        for (const group of messageGroups) {
            const userId = convUserMap[group.conversationId];
            if (!userId) continue;
            if (!userStatsMap[userId]) {
                userStatsMap[userId] = { chats: 0, tokens: 0 };
            }
            userStatsMap[userId].chats += group._count.id;
            userStatsMap[userId].tokens += group._sum.tokenUsage ?? 0;
        }

        // Sort by chats desc and take top 10
        const topUserIds = Object.keys(userStatsMap)
            .sort((a, b) => userStatsMap[b].chats - userStatsMap[a].chats)
            .slice(0, 10)
            .map(Number);

        // Fetch User records for top users
        const topUserRecords = topUserIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: topUserIds } },
                select: { id: true, fullName: true, email: true }
            })
            : [];

        const userRecordMap = {};
        for (const u of topUserRecords) {
            userRecordMap[u.id] = u;
        }

        const topUsers = topUserIds.map((userId, index) => {
            const user = userRecordMap[userId];
            const stats = userStatsMap[userId];
            return {
                rank: index + 1,
                name: user?.fullName || 'Unknown',
                email: user?.email || '',
                chats: stats.chats,
                tokens: stats.tokens
            };
        });

        // Merge hourlyData from all snapshots
        const hourlyData = {};
        for (const snapshot of snapshots) {
            if (snapshot.hourlyData && typeof snapshot.hourlyData === 'object') {
                for (const [hour, count] of Object.entries(snapshot.hourlyData)) {
                    hourlyData[hour] = (hourlyData[hour] || 0) + (count || 0);
                }
            }
        }

        res.json({
            success: true,
            range: req.query.range === '30d' ? '30d' : '7d',
            snapshots,
            hourlyData,
            topUsers
        });
    } catch (error) {
        console.error('❌ [ADMIN] getHistoryAnalytics Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = {
    getChatLogs,
    getRealtimeAnalytics,
    getHistoryAnalytics
};
