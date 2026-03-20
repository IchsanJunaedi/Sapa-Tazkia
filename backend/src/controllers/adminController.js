const prisma = require('../config/prismaClient');
const guestController = require('./guestController');
const ragService = require('../services/ragService');
const logger = require('../utils/logger');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { chunkText } = require('../utils/textChunker');

// Multer — memory storage (no disk writes), 10MB limit.
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

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
                        tokens: botMsg ? botMsg.tokenUsage : null,
                        responseTime: botMsg ? botMsg.responseTime : null,
                        isError: botMsg ? botMsg.isError : false
                    });
                }
            }
            return pairs;
        });

        // 2. Fetch Guest Sessions (from Redis)
        let formattedGuestLogs = [];
        try {
            const guestSessionsList = await guestController.getAllActiveSessions();
            for (const { sessionId, session } of guestSessionsList) {
                for (let i = 0; i < session.messages.length; i++) {
                    if (session.messages[i].role === 'user') {
                        const userMsg = session.messages[i];
                        const botMsg = (i + 1 < session.messages.length && session.messages[i + 1].role === 'bot') ? session.messages[i + 1] : null;

                        formattedGuestLogs.push({
                            id: `guest-${sessionId}-${i}`,
                            timestamp: session.createdAt,
                            userType: 'Guest',
                            identifier: sessionId,
                            message: userMsg.content,
                            response: botMsg ? botMsg.content : 'No response',
                            tokens: botMsg ? botMsg.tokenUsage : null,
                            responseTime: botMsg ? botMsg.responseTime : null,
                            isError: botMsg ? botMsg.isError : false
                        });
                    }
                }
            }
        } catch (guestErr) {
            logger.warn('[ADMIN] Failed to fetch guest sessions:', guestErr.message);
        }

        // 3. Combine and Sort
        const unifiedLogs = [...formattedDbLogs, ...formattedGuestLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        console.log(`[ADMIN DASHBOARD] Retrieved ${formattedDbLogs.length} DB pairs and ${formattedGuestLogs.length} Guest pairs. Total: ${unifiedLogs.length}`);

        res.json({
            success: true,
            logs: unifiedLogs
        });
    } catch (error) {
        console.error('❌ [ADMIN] Fetch Chat Logs Error:', error.message);
        console.error(error.stack);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            ...(process.env.NODE_ENV !== 'production' && { detail: error.message })
        });
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
            yesterdaySnapshot,
            errorCount,
            responseTimeAgg
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
            }),

            // 6. errorCount today
            prisma.message.count({
                where: { role: 'bot', isError: true, createdAt: { gte: todayStart } }
            }),

            // 7. avgResponseTime today
            prisma.message.aggregate({
                _avg: { responseTime: true },
                where: { role: 'bot', responseTime: { not: null }, createdAt: { gte: todayStart } }
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
            tokensUsed: calcDelta(totalTokens, yesterdaySnapshot?.totalTokens),
            errorCount: calcDelta(errorCount, yesterdaySnapshot?.errorCount)
        };

        res.json({
            success: true,
            realtime: {
                chatToday,
                activeUsers,
                tokensUsed: totalTokens,
                guestChats: guestChatsCount,
                userChats: userChatsCount,
                errorCount: errorCount,
                avgResponseTime: responseTimeAgg._avg.responseTime ?? null, // in ms, null if no data
                delta
            }
        });
    } catch (error) {
        console.error('❌ [ADMIN] getRealtimeAnalytics Error:', error.message);
        console.error(error.stack);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            ...(process.env.NODE_ENV !== 'production' && { detail: error.message })
        });
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
            // Fetch snapshots in range ordered by date asc — project only fields needed by frontend
            prisma.analyticsSnapshot.findMany({
                where: { date: { gte: rangeStart } },
                orderBy: { date: 'asc' },
                select: { date: true, totalChats: true, userChats: true, guestChats: true, totalTokens: true, uniqueUsers: true, hourlyData: true, topQuestions: true }
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

        // Sort by chats desc, take top 10 — keep string keys consistent throughout, convert to Number only for Prisma query
        const topUserIdStrings = Object.keys(userStatsMap)
            .sort((a, b) => userStatsMap[b].chats - userStatsMap[a].chats)
            .slice(0, 10);
        const topUserIds = topUserIdStrings.map(Number);

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

        const topUsers = topUserIdStrings.map((userIdStr, index) => {
            const user = userRecordMap[Number(userIdStr)];
            const stats = userStatsMap[userIdStr];
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

        // topQuestions from most recent snapshot (last 7d rolling window stored by analyticsJob)
        const latestTopQuestions = snapshots.length > 0
            ? (snapshots[snapshots.length - 1]?.topQuestions ?? [])
            : [];

        res.json({
            success: true,
            range: req.query.range === '30d' ? '30d' : '7d',
            snapshots,
            hourlyData,
            topUsers,
            topQuestions: latestTopQuestions
        });
    } catch (error) {
        console.error('❌ [ADMIN] getHistoryAnalytics Error:', error.message);
        console.error(error.stack);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            ...(process.env.NODE_ENV !== 'production' && { detail: error.message })
        });
    }
};

/**
 * GET /api/admin/knowledge-base
 * List all documents in the knowledge base
 */
const listKnowledgeBase = async (req, res) => {
  try {
    const documents = await ragService.listDocuments();
    res.json({ success: true, documents, total: documents.length });
  } catch (error) {
    console.error('❌ [ADMIN] List KB Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch knowledge base' });
  }
};

/**
 * POST /api/admin/knowledge-base
 * Add a new document to the knowledge base
 */
const addKnowledgeDoc = async (req, res) => {
  try {
    const { content, source, category } = req.body;
    if (!content || content.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Content must be at least 10 characters' });
    }
    if (content.trim().length > 50000) {
      return res.status(400).json({ success: false, message: 'Content too large. Maximum 50,000 characters.' });
    }
    const doc = await ragService.addDocument(content.trim(), {
      source: source || 'admin-manual',
      category: category || 'manual'
    });
    res.status(201).json({ success: true, document: doc });
  } catch (error) {
    console.error('❌ [ADMIN] Add KB Doc Error:', error);
    res.status(500).json({ success: false, message: 'Failed to add document' });
  }
};

/**
 * DELETE /api/admin/knowledge-base/:id
 * Delete a document from the knowledge base
 */
const deleteKnowledgeDoc = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Document ID required' });
    const result = await ragService.deleteDocument(id);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('❌ [ADMIN] Delete KB Doc Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
};

const getBugReports = async (req, res) => {
  try {
    const reports = await prisma.bugReport.findMany({
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, reports });
  } catch (error) {
    console.error('❌ [ADMIN] getBugReports Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil laporan bug.' });
  }
};

/**
 * PATCH /api/admin/bug-reports/:id
 * Update bug report status and admin notes.
 */
const updateBugReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const data = {};
    if (status) data.status = status;
    if (adminNotes !== undefined) data.adminNotes = adminNotes;

    // Auto-set resolvedAt when closing
    if (status === 'RESOLVED' || status === 'CLOSED') {
      data.resolvedAt = new Date();
    }

    const updated = await prisma.bugReport.update({
      where: { id: parseInt(id, 10) },
      data,
      include: { user: { select: { fullName: true, email: true } } }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Bug report not found.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/admin/knowledge-base/upload-pdf
 * Upload a PDF file, extract text, chunk it, and embed all chunks into Qdrant.
 */
const uploadPdfDoc = async (req, res) => {
  try {
    // 1. Validate file presence
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded. Send a PDF as form-data field "file".' });
    }

    // 2. Validate MIME type (layer 1)
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ success: false, message: 'Only PDF files are allowed.' });
    }

    // 3. Validate magic bytes — %PDF (layer 2, prevents spoofed MIME type)
    const magic = req.file.buffer.slice(0, 4).toString();
    if (magic !== '%PDF') {
      return res.status(400).json({ success: false, message: 'File is not a valid PDF (magic bytes check failed).' });
    }

    // 4. Parse PDF text
    const pdfData = await pdfParse(req.file.buffer);
    const rawText = pdfData.text || '';

    if (rawText.trim().length < 50) {
      return res.status(400).json({
        success: false,
        message: 'No text could be extracted from this PDF. It may be a scanned image-only document.'
      });
    }

    // 5. Chunk text and embed
    const fileName = req.file.originalname;
    const category = req.body.category || 'pdf-upload';
    const chunks = chunkText(rawText);

    let chunksAdded = 0;
    for (let i = 0; i < chunks.length; i++) {
      await ragService.addDocument(chunks[i], {
        source: fileName,
        title: fileName,
        category,
        chunk_index: i
      });
      chunksAdded++;
    }

    logger.info(`[ADMIN] PDF ingested: ${fileName} → ${chunksAdded} chunks (${rawText.trim().length} chars)`);

    res.status(201).json({
      success: true,
      fileName,
      chunksAdded,
      totalChars: rawText.trim().length
    });

  } catch (error) {
    logger.error('[ADMIN] uploadPdfDoc error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to process PDF.' });
  }
};

module.exports = {
    getChatLogs,
    getRealtimeAnalytics,
    getHistoryAnalytics,
    listKnowledgeBase,
    addKnowledgeDoc,
    deleteKnowledgeDoc,
    getBugReports,
    updateBugReport,
    uploadPdfDoc,
    pdfUpload
};
