const ragService = require('../services/ragService'); 
const { generateAIResponse, testOpenAIConnection } = require('../services/openaiService');
const academicService = require('../services/academicService');
const prisma = require('../../config/prisma');

/**
 * ============================================================================
 * 1. FITUR UTAMA: CHATBOT INTELLIGENT (RAG + DATABASE + GUEST MODE)
 * ============================================================================
 */

// ✅ FUNCTION SEND CHAT (SUPPORT GUEST MODE & RAG)
const sendChat = async (req, res) => {
  try {
    const { message, conversationId, isNewChat } = req.body;
    
    // ✅ FIX: UserId bersifat opsional untuk Guest Mode
    const userId = req.user?.id || null; 

    console.log('💬 [AI CONTROLLER] Chat Request:', { 
      user: userId ? `User ID ${userId}` : 'GUEST MODE', 
      conversationId: conversationId || 'New',
      isNewChat 
    });

    // 1. Validasi Input
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong" });
    }

    const cleanMessage = message.trim();

    // 2. Siapkan History Percakapan (HANYA JIKA USER LOGIN & BUKAN CHAT BARU)
    let conversationHistory = [];
    
    if (userId && conversationId && !isNewChat) {
      try {
        const existingMessages = await prisma.message.findMany({
          where: {
            conversationId: parseInt(conversationId),
            conversation: { userId: userId }
          },
          select: { role: true, content: true },
          orderBy: { createdAt: 'asc' },
          take: 8 // Mengambil konteks secukupnya
        });

        conversationHistory = existingMessages.map(msg => ({
          role: msg.role === 'bot' ? 'assistant' : 'user',
          content: msg.content
        }));
      } catch (error) {
        console.warn('⚠️ [AI CONTROLLER] Failed to load history (skipping):', error.message);
      }
    }

    // 3. 🧠 PANGGIL RAG SERVICE (CORE INTELLIGENCE)
    console.log('🚀 [AI CONTROLLER] Calling RAG Service...');
    const aiResponse = await ragService.answerQuestion(cleanMessage, conversationHistory);

    // 4. LOGIC PENYIMPANAN DATABASE (HANYA JIKA USER LOGIN)
    let currentConversationId = conversationId ? parseInt(conversationId) : null;
    let shouldCreateNewConversation = isNewChat || !conversationId;

    if (userId) {
      try {
        // Judul otomatis dari 50 karakter pertama
        const conversationTitle = cleanMessage.substring(0, 50) + (cleanMessage.length > 50 ? '...' : '');

        if (shouldCreateNewConversation) {
          // A. Buat Percakapan Baru
          const newConversation = await prisma.conversation.create({
            data: {
              userId: userId,
              title: conversationTitle,
              messages: {
                create: [
                  { role: 'user', content: cleanMessage },
                  { role: 'bot', content: aiResponse }
                ]
              }
            }
          });
          currentConversationId = newConversation.id;
          console.log(`🆕 [AI CONTROLLER] Created Conversation ID: ${currentConversationId}`);

        } else {
          // B. Lanjutkan Percakapan Lama
          const existingConv = await prisma.conversation.findFirst({
            where: { id: currentConversationId, userId: userId }
          });

          if (existingConv) {
            // Simpan pesan
            await prisma.message.createMany({
              data: [
                { conversationId: currentConversationId, role: 'user', content: cleanMessage },
                { conversationId: currentConversationId, role: 'bot', content: aiResponse }
              ]
            });

            // Update judul jika masih default/pendek
            const updateData = { updatedAt: new Date() };
            if (existingConv.title.length < 10 || existingConv.title.includes('...')) {
              updateData.title = conversationTitle;
            }

            await prisma.conversation.update({
              where: { id: currentConversationId },
              data: updateData
            });
            console.log(`🔄 [AI CONTROLLER] Updated Conversation ID: ${currentConversationId}`);
            
          } else {
            // Fallback: ID tidak ditemukan/milik user lain -> Buat Baru
            const fallbackConv = await prisma.conversation.create({
              data: {
                userId: userId,
                title: conversationTitle,
                messages: {
                  create: [
                    { role: 'user', content: cleanMessage },
                    { role: 'bot', content: aiResponse }
                  ]
                }
              }
            });
            currentConversationId = fallbackConv.id;
            shouldCreateNewConversation = true;
          }
        }
      } catch (dbError) {
        console.error('❌ [AI CONTROLLER] Database save error (Response sent anyway):', dbError.message);
      }
    }

    // 5. Kirim Response
    res.json({
      success: true,
      reply: aiResponse,
      conversationId: currentConversationId,
      timestamp: new Date().toISOString(),
      isNewConversation: userId ? shouldCreateNewConversation : true
    });

  } catch (error) {
    console.error('❌ [AI CONTROLLER] Chat Error:', error);
    res.status(500).json({
      success: false,
      message: "Afwan, sistem sedang mengalami gangguan.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ============================================================================
 * 2. FITUR RAG SYSTEM (KNOWLEDGE BASE) - ENHANCED
 * ============================================================================
 */

// ✅ FUNCTION TRIGGER INGESTION (HARD RESET MODE)
// Menggunakan resetAndReingest() agar data lama/hantu terhapus bersih
const triggerIngestion = async (req, res) => {
  try {
    console.log("🔄 [AI CONTROLLER] Memulai PROSES RESET & RE-INGESTION...");
    
    // 1. Cek Status Awal
    const beforeStatus = await ragService.getCollectionInfo();
    console.log('📊 [AI CONTROLLER] Status sebelum reset:', beforeStatus);
    
    // 2. Lakukan Hard Reset & Ingest Ulang
    // Ini akan menghapus collection lama dan membuatnya baru dari file yang ada sekarang
    const result = await ragService.resetAndReingest();
    
    if (result.success) {
      // 3. Cek Status Akhir
      const afterStatus = await ragService.getCollectionInfo();
      
      console.log(`✅ [AI CONTROLLER] Database Refreshed! New Count: ${result.count}`);

      res.json({
        success: true,
        message: `Alhamdulillah! Database berhasil dibersihkan dan diisi ulang. ${result.count} chunks data aktif.`,
        chunksProcessed: result.count,
        before: beforeStatus,
        after: afterStatus
      });
    } else {
      throw new Error(result.error || "Ingestion failed unknown reason");
    }
  } catch (error) {
    console.error('❌ [AI CONTROLLER] Ingestion Error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Gagal memproses data knowledge base.",
      error: error.message 
    });
  }
};

/**
 * ============================================================================
 * 3. FITUR MANAJEMEN PERCAKAPAN (CRUD)
 * ============================================================================
 */

const getConversations = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Auth required" });

    const conversations = await prisma.conversation.findMany({
      where: { userId: userId },
      select: {
        id: true, title: true, createdAt: true, updatedAt: true,
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, createdAt: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });

    const formatted = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      lastMessage: conv.messages[0]?.content || '',
      updatedAt: conv.updatedAt,
    }));
    
    res.json({ success: true, conversations: formatted });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching conversations" });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Auth required" });

    const conversation = await prisma.conversation.findFirst({
      where: { id: parseInt(chatId), userId: userId },
      include: {
        messages: {
          select: { id: true, role: true, content: true, createdAt: true },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!conversation) return res.status(404).json({ success: false, message: "Chat not found" });
    
    res.json({ success: true, conversation: { id: conversation.id, title: conversation.title }, messages: conversation.messages });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching history" });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Auth required" });

    await prisma.$transaction([
      prisma.message.deleteMany({ where: { conversationId: parseInt(chatId) } }),
      prisma.conversation.deleteMany({ where: { id: parseInt(chatId), userId: userId } })
    ]);

    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

/**
 * ============================================================================
 * 4. FITUR AKADEMIK & TESTING
 * ============================================================================
 */

const analyzeAcademicPerformance = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: "Auth required" });
  const result = await academicService.analyzeAcademicPerformance(userId);
  res.status(result.success ? 200 : 400).json(result);
};

const getStudyRecommendations = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: "Auth required" });
  const result = await academicService.getStudyRecommendations(userId);
  res.status(result.success ? 200 : 400).json(result);
};

const testAI = async (req, res) => {
  try {
    const { message } = req.body;
    const response = await generateAIResponse(message, [], null);
    res.json({ success: true, response });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

const testOpenAIConnectionHandler = async (req, res) => {
  const result = await testOpenAIConnection();
  res.status(result.success ? 200 : 500).json(result);
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