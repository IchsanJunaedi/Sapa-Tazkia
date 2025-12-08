const ragService = require('../services/ragService'); 
const { generateAIResponse, testOpenAIConnection } = require('../services/openaiService');
const academicService = require('../services/academicService');
const rateLimitService = require('../services/rateLimitService'); 
const prisma = require('../../config/prisma');

/**
 * ============================================================================
 * 1. FITUR UTAMA: CHATBOT INTELLIGENT (USER LOGIN MODE)
 * ============================================================================
 */

const sendChat = async (req, res) => {
  let currentConversationId = null;
  let shouldCreateNewConversation = false;

  try {
    const { message, conversationId, isNewChat } = req.body;
    const userId = req.user?.id || null; 

    // ✅ STRICT AUTH CHECK: Hanya untuk user login
    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    console.log('💬 [AI CONTROLLER] User Chat Request:', { userId, conversationId, isNewChat });

    // Validasi Pesan Kosong
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong" });
    }

    // ✅ [NEW LOGIC] PEMBATASAN KARAKTER (Security Layer)
    // Mencegah request bypass via Postman/API yang melebihi batas frontend
    const MAX_CHARS = 250; // Sesuaikan dengan Frontend (250)
    if (message.length > MAX_CHARS) {
        return res.status(400).json({ 
            success: false, 
            message: `Maaf, pesan terlalu panjang. Maksimal ${MAX_CHARS} karakter.` 
        });
    }

    const cleanMessage = message.trim();

    // 2. Load History
    let conversationHistory = [];
    if (conversationId && !isNewChat) {
      try {
        const existingMessages = await prisma.message.findMany({
          where: { conversationId: parseInt(conversationId), conversation: { userId: userId } },
          select: { role: true, content: true },
          orderBy: { createdAt: 'asc' },
          take: 8 
        });
        conversationHistory = existingMessages.map(msg => ({
          role: msg.role === 'bot' ? 'assistant' : 'user',
          content: msg.content
        }));
      } catch (error) { console.warn('History load failed:', error.message); }
    }

    // 3. ✅ RAG PROCESS
    console.log('🚀 [AI CONTROLLER] Calling RAG Service...');
    
    let ragResult;     
    let finalAnswer;   
    let realTokenUsage = 0;

    try {
      // Call RAG
      ragResult = await ragService.answerQuestion(cleanMessage, conversationHistory);
      finalAnswer = ragResult.answer; 
      
      // ✅ Ambil Token Asli OpenAI
      realTokenUsage = ragResult.usage ? ragResult.usage.total_tokens : 0;

      // Fallback estimasi jika usage kosong
      if (!realTokenUsage) {
         const inputChars = cleanMessage.length + JSON.stringify(conversationHistory).length;
         const outputChars = finalAnswer ? finalAnswer.length : 0;
         realTokenUsage = Math.ceil((inputChars + outputChars) / 4) + 1400; 
      }

      console.log('✅ [AI CONTROLLER] RAG Success. Tokens:', realTokenUsage);

    } catch (ragError) {
      console.error('❌ [AI CONTROLLER] RAG Failed:', ragError.message);
      
      // FALLBACK
      console.log('🔄 Using OpenAI fallback...');
      try {
        const fallbackRes = await generateAIResponse(cleanMessage, conversationHistory, 'general');
        
        finalAnswer = typeof fallbackRes === 'object' ? fallbackRes.content : fallbackRes;
        const usageData = typeof fallbackRes === 'object' ? fallbackRes.usage : null;
        
        realTokenUsage = usageData ? usageData.total_tokens : Math.ceil((cleanMessage.length + finalAnswer.length)/4);

      } catch (fallbackError) {
        throw new Error('All AI services unavailable');
      }
    }

    // =================================================================
    // 4. ✅ TOKEN TRACKING & DEDUCTION (FIXED)
    // =================================================================
    let currentRemaining = null; 

    if (realTokenUsage > 0) {
        const trackerIdentifier = userId; 
        
        // Track Usage
        await rateLimitService.trackTokenUsage(trackerIdentifier, req.ip, realTokenUsage);
        console.log(`📉 [AI LIMIT] Deducted ${realTokenUsage} tokens for User ${userId}`);

        // Get Latest Balance (User)
        const quotaStatus = await rateLimitService.getQuotaStatus(trackerIdentifier, 'user');
        currentRemaining = quotaStatus.remaining;
        console.log(`📊 [AI LIMIT] Updated User Balance: ${currentRemaining} / ${quotaStatus.limit}`);
    }
    // =================================================================

    // 5. ✅ DB SAVE - ANTI-GHOSTING & SMART TITLE GENERATION
    currentConversationId = conversationId ? parseInt(conversationId) : null;
    shouldCreateNewConversation = isNewChat || !currentConversationId;

    try {
        // Default title: Potongan pesan user (Fallback)
        let conversationTitle = cleanMessage.substring(0, 50) + (cleanMessage.length > 50 ? '...' : '');

        if (!shouldCreateNewConversation) {
            const existingConv = await prisma.conversation.findFirst({
                where: { id: currentConversationId, userId: userId }
            });

            if (!existingConv) {
                console.warn(`⚠️ [DB] Conversation ID ${currentConversationId} not found. Creating new.`);
                shouldCreateNewConversation = true; 
                currentConversationId = null;
            }
        }

        if (shouldCreateNewConversation) {
          // 🧠 SMART TITLE GENERATION (FITUR BARU)
          // Kita minta AI membuat judul pendek berdasarkan pesan user
          try {
             // Prompt khusus agar judulnya singkat, padat, dan jelas (Title Case)
             const titlePrompt = `Buatkan judul percakapan yang sangat singkat (maksimal 4-5 kata), menarik, dan formal berdasarkan pertanyaan ini: "${cleanMessage}". Langsung tulis judulnya saja tanpa tanda kutip. Contoh: "Lokasi Kampus Tazkia" atau "Biaya Kuliah 2025".`;
             
             // Gunakan service OpenAI yang sudah ada
             const generatedTitleRes = await generateAIResponse(titlePrompt, [], 'general');
             const generatedTitle = typeof generatedTitleRes === 'object' ? generatedTitleRes.content : generatedTitleRes;
             
             if (generatedTitle && generatedTitle.length < 60) {
                 conversationTitle = generatedTitle.replace(/^["']|["']$/g, '').trim(); // Hapus tanda kutip jika ada
                 console.log(`✨ [AI TITLE] Generated Title: "${conversationTitle}"`);
             }
          } catch (titleError) {
             console.warn('⚠️ Title generation failed, using default:', titleError.message);
             // Tidak perlu crash, cukup pakai default title
          }

          // Buat Conversation Baru dengan Judul AI
          const newConversation = await prisma.conversation.create({
            data: {
              userId: userId,
              title: conversationTitle, // <-- Judul dari AI masuk sini
              messages: {
                create: [
                  { role: 'user', content: cleanMessage },
                  { role: 'bot', content: finalAnswer }
                ]
              }
            }
          });
          currentConversationId = newConversation.id;
          console.log(`✅ [DB] New Conversation Created: ID ${currentConversationId}`);
        } else {
          // Update Existing
          await prisma.message.createMany({
            data: [
              { conversationId: currentConversationId, role: 'user', content: cleanMessage },
              { conversationId: currentConversationId, role: 'bot', content: finalAnswer }
            ]
          });
          
          // Update timestamp
          await prisma.conversation.update({
              where: { id: currentConversationId },
              data: { updatedAt: new Date() }
          });
          console.log(`✅ [DB] Message saved & Timestamp updated for ID ${currentConversationId}`);
        }
    } catch (dbError) {
        console.error('❌ [DB SAVE ERROR]:', dbError.message);
    }

    // 6. RESPONSE
    res.json({
      success: true,
      reply: finalAnswer, 
      conversationId: currentConversationId,
      timestamp: new Date().toISOString(),
      isNewConversation: shouldCreateNewConversation,
      usage: {
        tokensUsed: realTokenUsage,
        policy: 'user', 
        remaining: currentRemaining 
      }
    });

  } catch (error) {
    console.error('❌ [AI CONTROLLER] Chat Error:', error);
    const errorMessage = error.message.includes('unavailable') 
      ? "Layanan sedang sibuk." : "Terjadi kesalahan sistem.";
      
    res.status(500).json({ success: false, message: errorMessage });
  }
};

// ... (Helper Functions - Dipertahankan) ...

const triggerIngestion = async (req, res) => { /* ... */ };

const getConversations = async (req, res) => { 
    try {
        const userId = req.user.id;
        const conversations = await prisma.conversation.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' }, // Urutkan dari yang terbaru diupdate
            take: 20
        });

        // MAPPING DATA (Fix Sidebar History)
        const formattedConversations = conversations.map(chat => ({
            ...chat,
            timestamp: chat.updatedAt || chat.createdAt, 
            lastMessage: chat.title 
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
        
        // ✅ PERBAIKAN: Validasi ID sebelum query ke database
        // Pastikan ID ada dan bisa diubah menjadi angka
        if (!id) {
            return res.status(400).json({ success: false, message: "ID Conversation diperlukan" });
        }

        const conversationId = parseInt(id);

        // Jika ID bukan angka (misal: "abc" atau undefined), stop proses agar Prisma tidak error
        if (isNaN(conversationId)) {
            return res.status(400).json({ success: false, message: "ID Conversation harus berupa angka valid" });
        }

        // Query menggunakan ID yang sudah dipastikan angka (conversationId)
        const chatCheck = await prisma.conversation.findFirst({
            where: { id: conversationId, userId }
        });

        if (!chatCheck) {
             return res.status(404).json({ success: false, message: "Chat not found" });
        }

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

const deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        await prisma.conversation.deleteMany({
            where: { id: parseInt(id), userId }
        });
        res.json({ success: true, message: "Deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete" });
    }
};

const analyzeAcademicPerformance = async (req, res) => { res.json({success: true, message: "Feature coming soon"}) };
const getStudyRecommendations = async (req, res) => { res.json({success: true, message: "Feature coming soon"}) };
const testAI = async (req, res) => { res.json({success: true, message: "Test OK"}) };
const testOpenAIConnectionHandler = async (req, res) => { 
    const result = await testOpenAIConnection();
    res.json(result);
};

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