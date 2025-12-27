const ragService = require('../services/ragService');
// ✅ FIX 1: Import generateTitle yang sudah kita buat di service
const { generateAIResponse, testOpenAIConnection, generateTitle } = require('../services/openaiService');
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
    let shouldCreateNewConversation = false;

    // 🛑 Listener untuk pembatalan (Refresh/Cancel)
    req.on('close', () => {
        if (!res.writableEnded) {
            console.log('⚠️ [AI CONTROLLER] Request closed by client before completion. Aborting AI...');
            abortController.abort();
        }
    });

    try {
        const { message, conversationId, isNewChat } = req.body;
        const userId = req.user?.id || null;

        // 1. AUTH CHECK
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // 2. VALIDASI INPUT
        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong" });
        }
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

        // Kata kunci pemicu mode Akademik
        const academicKeywords = ['nilai', 'ipk', 'grade', 'transkrip', 'skor', 'hasil studi', 'pdf', 'download', 'unduh', 'semester'];
        const isAcademicQuery = academicKeywords.some(keyword => cleanMessage.toLowerCase().includes(keyword));

        let finalAnswer = "";
        let realTokenUsage = 0;

        if (isAcademicQuery) {
            // ---------------------------------------------------------
            // JALUR 1: PERTANYAAN AKADEMIK (Database -> OpenAI Langsung)
            // ---------------------------------------------------------
            console.log('🎓 [MODE] ACADEMIC QUERY DETECTED. BYPASSING RAG...');

            // A. Ambil Data DB
            const [userSummary, userGrades] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: userId },
                    include: { academicSummary: true, programStudi: true }
                }),
                prisma.academicGrade.findMany({
                    where: { userId: userId },
                    include: { course: true },
                    orderBy: { semester: 'asc' }
                })
            ]);

            if (userSummary) {
                const ipk = userSummary.academicSummary?.ipk || "0.00";
                const sks = userSummary.academicSummary?.totalSks || 0;
                const prodi = userSummary.programStudi?.name || "Tidak diketahui";

                const gradeList = userGrades.length > 0
                    ? userGrades.map(g => `- Sem ${g.semester}: ${g.course.name} (${g.grade})`).join('\n')
                    : "Belum ada data nilai.";

                // B. Buat Prompt Spesifik (Sangat Tegas)
                const academicPrompt = `
             KAMU ADALAH ASISTEN AKADEMIK PRIBADI. JANGAN CARI DATA DI INTERNET/DOKUMEN LAIN.
             GUNAKAN DATA DI BAWAH INI UNTUK MENJAWAB:

             [DATA VALID DARI DATABASE]
             Nama: ${userSummary.fullName}
             Prodi: ${prodi}
             IPK: ${ipk}
             Total SKS: ${sks}
             
             Rincian Nilai:
             ${gradeList}
             
             [INSTRUKSI WAJIB]
             1. Jawab pertanyaan user dengan ramah berdasarkan data di atas.
             2. Jika user bertanya "Bisa download PDF?" atau "Minta PDF", JAWAB "Bisa" dan TAMBAHKAN TAG INI DI AKHIR JAWABAN: [DOWNLOAD_PDF]
             3. JANGAN PERNAH MENOLAK PERMINTAAN DOWNLOAD PDF.
             
             Pertanyaan User: "${cleanMessage}"
             `;

                // C. Kirim ke OpenAI (Tanpa RAG)
                const aiRes = await generateAIResponse(
                    academicPrompt,
                    conversationHistory,
                    null,
                    { abortSignal: abortController.signal, mode: 'general' }
                );
                finalAnswer = typeof aiRes === 'object' ? aiRes.content : aiRes;
                realTokenUsage = 1500; // Estimasi token
                console.log('✅ [MODE] Academic Answer Generated directly via OpenAI.');
            } else {
                finalAnswer = "Maaf, data akademik Anda tidak ditemukan di database.";
            }

        } else {
            // ---------------------------------------------------------
            // JALUR 2: PERTANYAAN UMUM (RAG -> OpenAI)
            // ---------------------------------------------------------
            console.log('🌍 [MODE] GENERAL QUERY. USING RAG SERVICE...');

            try {
                const ragResult = await ragService.answerQuestion(
                    cleanMessage,
                    conversationHistory,
                    { abortSignal: abortController.signal }
                );
                finalAnswer = ragResult.answer;

                // ✅ FIX: Handle kasus {} (objek kosong) dari greeting/fast-path
                // Jika usage.total_tokens tidak ada atau NaN, gunakan estimasi
                const tokenFromUsage = ragResult.usage?.total_tokens;
                if (tokenFromUsage && !isNaN(tokenFromUsage) && tokenFromUsage > 0) {
                    realTokenUsage = tokenFromUsage;
                } else {
                    // Fallback: estimasi berdasarkan panjang output + minimal overhead
                    const estimatedTokens = Math.ceil((cleanMessage.length + (finalAnswer?.length || 0)) / 4) + 50;
                    realTokenUsage = Math.max(estimatedTokens, 100); // Minimal 100 token
                    console.log(`📊 [TOKEN] Using estimated tokens: ${realTokenUsage}`);
                }
            } catch (err) {
                console.error('RAG Error:', err);
                finalAnswer = "Maaf, saya sedang mengalami gangguan koneksi ke server pengetahuan kampus.";
            }
        }

        // =================================================================
        // 4. SAVE TO DB & TOKEN TRACKING
        // =================================================================

        // 🛑 ABORT CHECK: Jika client sudah putus koneksi (Cancel), jangan simpan ke DB
        if (req.socket.destroyed || abortController.signal.aborted) {
            console.log('🛑 [AI CONTROLLER] Request aborted. Skipping DB save & further processing.');
            return;
        }

        // Track Token dan ambil total usage langsung dari hasil operasi
        let currentRemaining = null;
        if (realTokenUsage > 0) {
            const trackResult = await rateLimitService.trackTokenUsage(userId, req.ip, realTokenUsage);
            console.log(`📉 [USER LIMIT] Deducted REAL usage: ${realTokenUsage} tokens`);

            if (trackResult && trackResult.success) {
                const userLimits = rateLimitService.getLimits('user');
                currentRemaining = Math.max(0, userLimits.tokenLimitDaily - trackResult.totalUsage);
                console.log(`📊 [USER LIMIT] Total Usage: ${trackResult.totalUsage} | Remaining: ${currentRemaining}`);
            } else {
                // Fallback ke getQuotaStatus jika trackTokenUsage gagal
                const quotaStatus = await rateLimitService.getQuotaStatus(userId, 'user');
                currentRemaining = quotaStatus.remaining;
                console.log(`📊 [USER LIMIT] (Fallback) Updated Balance: ${currentRemaining}`);
            }
        } else {
            // Jika tidak ada token usage, ambil status saja
            const quotaStatus = await rateLimitService.getQuotaStatus(userId, 'user');
            currentRemaining = quotaStatus.remaining;
        }

        // Save Conversation
        currentConversationId = conversationId ? parseInt(conversationId) : null;
        shouldCreateNewConversation = isNewChat || !currentConversationId;

        try {
            let conversationTitle = "Percakapan Baru"; // Default title

            // Auto Title untuk Chat Baru
            if (shouldCreateNewConversation) {
                // ✅ FIX 2: GUNAKAN FUNGSI DEDICATED DARI SERVICE
                // Kita kirim pesan user DAN jawaban AI agar judulnya pintar & sesuai konteks
                console.log("🏷️ Generating Smart Title...");
                conversationTitle = await generateTitle(cleanMessage, finalAnswer);

                const newConv = await prisma.conversation.create({
                    data: {
                        userId,
                        title: conversationTitle, // Title hasil generateTitle
                        messages: { create: [{ role: 'user', content: cleanMessage }, { role: 'bot', content: finalAnswer }] }
                    }
                });
                currentConversationId = newConv.id;
                console.log(`✅ New Conversation Created: [${newConv.id}] ${conversationTitle}`);
            } else {
                // Chat lama: update pesan saja
                await prisma.message.createMany({
                    data: [{ conversationId: currentConversationId, role: 'user', content: cleanMessage }, { conversationId: currentConversationId, role: 'bot', content: finalAnswer }]
                });
                // Update timestamp biar naik ke atas di sidebar
                await prisma.conversation.update({ where: { id: currentConversationId }, data: { updatedAt: new Date() } });
            }
        } catch (e) { console.error('DB Save Error:', e); }

        // 5. SEND RESPONSE
        res.json({
            success: true,
            reply: finalAnswer,
            conversationId: currentConversationId,
            timestamp: new Date().toISOString(),
            isNewConversation: shouldCreateNewConversation,
            // Jika chat baru, kirim title ke frontend agar UI bisa update realtime tanpa refresh
            title: shouldCreateNewConversation ? (await prisma.conversation.findUnique({ where: { id: currentConversationId } }))?.title : null,
            usage: {
                tokensUsed: realTokenUsage,
                remaining: currentRemaining
            }
        });

    } catch (error) {
        console.error('❌ [AI CONTROLLER] Fatal Error:', error);
        res.status(500).json({ success: false, message: "Terjadi kesalahan sistem." });
    }
};

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