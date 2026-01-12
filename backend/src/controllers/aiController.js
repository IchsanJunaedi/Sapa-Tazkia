const ragService = require('../services/ragService');
// ✅ FIX 1: Import generateTitle yang sudah kita buat di service
const { generateAIResponse, testOpenAIConnection, generateTitle, isGreeting } = require('../services/openaiService');
const academicService = require('../services/academicService');
const rateLimitService = require('../services/rateLimitService');
const prisma = require('../../config/prisma');

/**
 * ============================================================================
 * 1. FITUR UTAMA: CHATBOT INTELLIGENT (SMART ROUTING)
 * ============================================================================
 */

const sendChat = async (req, res) => {
    const abortController = new AbortController();
    let currentConversationId = null;

    // 🛑 Listener untuk pembatalan
    req.on('close', () => {
        if (!res.writableEnded) {
            abortController.abort();
        }
    });

    try {
        const { message, conversationId, isNewChat, stream = true } = req.body;
        const userId = req.user?.id || null;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
        if (!message || message.trim() === '') return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong" });

        const cleanMessage = message.trim();

        // 3. LOAD HISTORY
        let conversationHistory = [];
        if (conversationId && !isNewChat) {
            try {
                const existingMessages = await prisma.message.findMany({
                    where: { conversationId: parseInt(conversationId), conversation: { userId: userId } },
                    select: { role: true, content: true },
                    orderBy: { createdAt: 'asc' },
                    take: 6
                });
                conversationHistory = existingMessages.map(msg => ({
                    role: msg.role === 'bot' ? 'assistant' : 'user',
                    content: msg.content
                }));
            } catch (error) { console.warn('History load failed:', error.message); }
        }

        // =================================================================
        // 🧠 LOGIC: SMART ROUTING (AKADEMIK vs UMUM)
        // =================================================================
        const academicKeywords = ['nilai', 'ipk', 'grade', 'transkrip', 'skor', 'hasil studi', 'pdf', 'download', 'unduh', 'semester'];
        const isAcademicQuery = academicKeywords.some(keyword => cleanMessage.toLowerCase().includes(keyword));

        let aiStream = null;
        let finalAnswer = "";
        let realTokenUsage = 0;
        let docsDetail = [];

        if (isAcademicQuery) {
            console.log('🎓 [MODE] ACADEMIC QUERY DETECTED');
            const [userSummary, userGrades] = await Promise.all([
                prisma.user.findUnique({ where: { id: userId }, include: { academicSummary: true, programStudi: true } }),
                prisma.academicGrade.findMany({ where: { userId: userId }, include: { course: true }, orderBy: { semester: 'asc' } })
            ]);

            if (userSummary) {
                const ipk = userSummary.academicSummary?.ipk || "0.00";
                const sks = userSummary.academicSummary?.totalSks || 0;
                const prodi = userSummary.programStudi?.name || "Tidak diketahui";
                const gradeList = userGrades.length > 0 ? userGrades.map(g => `- Sem ${g.semester}: ${g.course.name} (${g.grade})`).join('\n') : "Belum ada data nilai.";

                const academicPrompt = `
             KAMU ADALAH ASISTEN AKADEMIK PRIBADI. JANGAN CARI DATA DI INTERNET/DOKUMEN LAIN.
             GUNAKAN DATA DI BAWAH INI UNTUK MENJAWAB:
             [DATA VALID] Nama: ${userSummary.fullName}, Prodi: ${prodi}, IPK: ${ipk}, Total SKS: ${sks}
             Rincian Nilai: ${gradeList}
             [INSTRUKSI WAJIB] Jawab pertanyaan user dengan ramah. Jika tanya PDF, jawab "Bisa" & tag [DOWNLOAD_PDF] di akhir.
             Pertanyaan User: "${cleanMessage}"`;

                const response = await generateAIResponse(academicPrompt, conversationHistory, null, { abortSignal: abortController.signal, stream });
                if (stream) aiStream = response;
                else finalAnswer = response.content;
                realTokenUsage = 1500; // Est
            } else {
                finalAnswer = "Maaf, data akademik Anda tidak ditemukan di database.";
            }

        } else {
            console.log('🌍 [MODE] GENERAL QUERY (RAG)');
            const ragResult = await ragService.answerQuestion(cleanMessage, conversationHistory, { abortSignal: abortController.signal, stream });

            if (stream && ragResult.isStream) {
                aiStream = ragResult.stream;
                docsDetail = ragResult.docsDetail;
            } else {
                finalAnswer = ragResult.answer;
                realTokenUsage = ragResult.usage?.total_tokens || 100;
                docsDetail = ragResult.docsDetail;
            }
        }

        // =================================================================
        // A. STREAMING HANDLER
        // =================================================================
        if (stream && (aiStream || finalAnswer)) {
            // Jika finalAnswer ada tapi stream diminta (fallback/academic error case)
            // Kita kirim static stream jika aiStream null
            if (!aiStream && finalAnswer) {
                // Manual SSE for static text
                res.setHeader('Content-Type', 'text/event-stream');
                res.write(`data: ${JSON.stringify({ type: 'content', chunk: finalAnswer })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'done', usage: 100 })}\n\n`);
                res.end();
                // Save (async)
                await handleSaveAndTrack(userId, currentConversationId, conversationId, isNewChat, cleanMessage, finalAnswer, 100, req.ip);
                return;
            }

            if (aiStream) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');

                if (docsDetail.length > 0) res.write(`data: ${JSON.stringify({ type: 'meta', docs: docsDetail })}\n\n`);

                let streamedText = "";
                let streamUsage = 0;

                for await (const chunk of aiStream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        streamedText += content;
                        res.write(`data: ${JSON.stringify({ type: 'content', chunk: content })}\n\n`);
                    }
                    if (chunk.usage) streamUsage = chunk.usage.total_tokens;
                }

                if (!streamUsage) streamUsage = Math.ceil(streamedText.length / 4);

                // Track & Calc Remaining
                let remaining = null;
                if (streamUsage > 0) {
                    const track = await rateLimitService.trackTokenUsage(userId, req.ip, streamUsage);
                    const limits = rateLimitService.getLimits('user');
                    remaining = Math.max(0, limits.tokenLimitDaily - track.totalUsage);
                }

                const savedId = await handleSaveAndTrack(userId, currentConversationId, conversationId, isNewChat, cleanMessage, streamedText, 0, req.ip, true);

                res.write(`data: ${JSON.stringify({ type: 'done', usage: streamUsage, remaining, conversationId: savedId })}\n\n`);
                res.end();
                return;
            }
        }

        // =================================================================
        // B. NON-STREAM HANDLER (JSON)
        // =================================================================
        // Logic for JSON response (Tracking + Saving)
        let currentRemaining = null;
        if (realTokenUsage > 0) {
            const trackResult = await rateLimitService.trackTokenUsage(userId, req.ip, realTokenUsage);
            if (trackResult && trackResult.success) {
                const userLimits = rateLimitService.getLimits('user');
                currentRemaining = Math.max(0, userLimits.tokenLimitDaily - trackResult.totalUsage);
            }
        }

        const savedId = await handleSaveAndTrack(userId, currentConversationId, conversationId, isNewChat, cleanMessage, finalAnswer, 0, req.ip, true);

        res.json({
            success: true,
            reply: finalAnswer,
            conversationId: savedId,
            timestamp: new Date().toISOString(),
            isNewConversation: shouldCreateNewConversation,
            title: shouldCreateNewConversation ? (await prisma.conversation.findUnique({ where: { id: savedId } }))?.title : null,
            usage: {
                tokensUsed: realTokenUsage,
                remaining: currentRemaining
            }
        });

    } catch (error) {
        console.error('❌ [AI] Error:', error);
        if (!res.headersSent) res.status(500).json({ success: false, message: "Error sistem." });
    }
};

// Helper internal untuk saving DB (karena dipakai Stream & JSON)
async function handleSaveAndTrack(userId, currentId, reqConvId, isNewChat, userMsg, botMsg, usageToTrack, ip, alreadyTracked = false) {
    // 1. Track if needed
    let remaining = null;
    if (!alreadyTracked && usageToTrack > 0) {
        await rateLimitService.trackTokenUsage(userId, ip, usageToTrack);
    }

    // 2. Save DB
    let convId = reqConvId ? parseInt(reqConvId) : null;
    try {
        if (isNewChat || !convId) {
            const title = await generateTitle(userMsg, botMsg);
            const newConv = await prisma.conversation.create({
                data: {
                    userId,
                    title,
                    messages: { create: [{ role: 'user', content: userMsg }, { role: 'bot', content: botMsg }] }
                }
            });
            return newConv.id;
        } else {
            // Existing chat: Add messages
            await prisma.message.createMany({
                data: [{ conversationId: convId, role: 'user', content: userMsg }, { conversationId: convId, role: 'bot', content: botMsg }]
            });

            // ✅ Defer Title Generation Logic
            try {
                const existingConv = await prisma.conversation.findUnique({ where: { id: convId } });

                // Cek apakah judul masih default dan pesan BUKAN greeting
                if (existingConv && existingConv.title === 'Percakapan Baru' && !isGreeting(userMsg)) {
                    console.log('🏷️ [TITLE] Updating deferred title for Conversation ID:', convId);

                    const newTitle = await generateTitle(userMsg, botMsg);

                    if (newTitle && newTitle !== 'Percakapan Baru') {
                        await prisma.conversation.update({
                            where: { id: convId },
                            data: { title: newTitle }
                        });
                        console.log(`✅ [TITLE] Updated to: "${newTitle}"`);
                    }
                }
            } catch (err) {
                console.error("⚠️ [TITLE UPDATE] Error (Non-fatal):", err.message);
            }

            await prisma.conversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });
            return convId;
        }
    } catch (e) { console.error("DB Save Fail", e); return null; }
}

/**
 * ============================================================================
 * 2. HELPER FUNCTIONS (RESTORED FULLY)
 * ============================================================================
 */

const triggerIngestion = async (req, res) => {
    // Fungsi dummy atau implementasi asli jika ada
    return res.json({ success: true, message: "Ingestion triggered (dummy)" });
};

const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversations = await prisma.conversation.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            take: 20
        });

        const formattedConversations = conversations.map(chat => ({
            ...chat,
            timestamp: chat.updatedAt || chat.createdAt,
            lastMessage: chat.title // Pastikan frontend menampilkan title, bukan isi pesan
        }));

        res.json({
            success: true,
            data: formattedConversations,
            conversations: formattedConversations
        });

    } catch (error) {
        console.error("❌ [GET CONVERSATIONS ERROR]", error);
        res.status(500).json({ success: false, message: "Failed to load conversations" });
    }
};

const getChatHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        if (!id) return res.status(400).json({ success: false, message: "ID Conversation diperlukan" });

        const conversationId = parseInt(id);
        if (isNaN(conversationId)) return res.status(400).json({ success: false, message: "ID Conversation harus berupa angka valid" });

        const chatCheck = await prisma.conversation.findFirst({
            where: { id: conversationId, userId }
        });

        if (!chatCheck) return res.status(404).json({ success: false, message: "Chat not found" });

        const messages = await prisma.message.findMany({
            where: { conversationId: conversationId },
            orderBy: { createdAt: 'asc' }
        });

        res.json({
            success: true,
            data: messages,
            messages: messages
        });

    } catch (error) {
        console.error("History Error:", error);
        res.status(500).json({ success: false, message: "Failed to load history" });
    }
};

// ✅ FIX 3: IMPROVED DELETE FUNCTION
const deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Validasi ID
        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({ success: false, message: "ID Chat tidak valid" });
        }

        // Gunakan deleteMany untuk keamanan (ID + userId)
        // Karena Schema sudah onDelete: Cascade, ini akan otomatis menghapus message
        const result = await prisma.conversation.deleteMany({
            where: {
                id: parseInt(id),
                userId: userId // Security: Hanya hapus milik sendiri
            }
        });

        // Cek apakah ada yang terhapus (jika 0 berarti tidak ditemukan atau bukan pemilik)
        if (result.count === 0) {
            return res.status(404).json({ success: false, message: "Chat tidak ditemukan atau Anda tidak memiliki akses" });
        }

        res.json({ success: true, message: "Percakapan berhasil dihapus" });
    } catch (error) {
        // Log error yang sebenarnya ke console server agar bisa ditelusuri
        console.error("❌ [DELETE ERROR]", error);
        res.status(500).json({
            success: false,
            message: "Gagal menghapus percakapan. Silakan coba lagi nanti."
        });
    }
};

// Fungsi Placeholder agar Router tidak error
const analyzeAcademicPerformance = async (req, res) => { res.json({ success: true, message: "Feature coming soon" }) };
const getStudyRecommendations = async (req, res) => { res.json({ success: true, message: "Feature coming soon" }) };
const testAI = async (req, res) => { res.json({ success: true, message: "Test OK" }) };
const testOpenAIConnectionHandler = async (req, res) => {
    const result = await testOpenAIConnection();
    res.json(result);
};

// =================================================================
// 3. EXPORTS (PASTIKAN SEMUA FUNGSI ADA DI SINI)
// =================================================================
module.exports = {
    sendChat,
    triggerIngestion,
    getConversations,
    getChatHistory,
    deleteConversation,
    analyzeAcademicPerformance,
    getStudyRecommendations,
    testAI,
    testOpenAIConnection: testOpenAIConnectionHandler
};