const ragService = require('../services/ragService'); 
const { generateAIResponse, testOpenAIConnection } = require('../services/openaiService');
const academicService = require('../services/academicService');
const prisma = require('../../config/prisma');

/**
 * ============================================================================
 * 1. FITUR UTAMA: CHATBOT INTELLIGENT (RAG + DATABASE + GUEST MODE) - FIXED
 * ============================================================================
 */

// ✅ FUNCTION SEND CHAT (SUPPORT GUEST MODE & RAG) - OPTIMIZED
const sendChat = async (req, res) => {
  try {
    const { message, conversationId, isNewChat } = req.body;
    
    // ✅ FIX: UserId bersifat opsional untuk Guest Mode
    const userId = req.user?.id || null; 

    console.log('💬 [AI CONTROLLER] Chat Request:', { 
      user: userId ? `User ID ${userId}` : 'GUEST MODE', 
      message,
      conversationId,
      isNewChat 
    });

    // 1. Validasi Input - ENHANCED
    if (!message || message.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: "Pesan tidak boleh kosong" 
      });
    }

    const cleanMessage = message.trim();

    // 2. Siapkan History Percakapan (HANYA JIKA USER LOGIN)
    let conversationHistory = [];
    
    if (userId && conversationId && !isNewChat) {
      try {
        console.log(`📚 [AI CONTROLLER] Loading history for conversation: ${conversationId}`);
        
        const existingMessages = await prisma.message.findMany({
          where: {
            conversationId: parseInt(conversationId),
            conversation: { userId: userId }
          },
          select: { role: true, content: true },
          orderBy: { createdAt: 'asc' },
          take: 8 // ✅ INCREASED: Ambil 8 pesan terakhir untuk konteks lebih baik
        });

        conversationHistory = existingMessages.map(msg => ({
          role: msg.role === 'bot' ? 'assistant' : 'user',
          content: msg.content
        }));
        
        console.log(`📚 [AI CONTROLLER] Loaded ${conversationHistory.length} history messages.`);
      } catch (error) {
        console.warn('⚠️ [AI CONTROLLER] Failed to load history (skipping):', error.message);
        // Lanjut tanpa history daripada gagal total
      }
    } else {
      console.log('📚 [AI CONTROLLER] No history loaded - Guest or new conversation');
    }

    // 3. 🧠 PANGGIL RAG SERVICE (CORE INTELLIGENCE) - ENHANCED
    console.log('🚀 [AI CONTROLLER] Calling RAG Service...');
    const aiResponse = await ragService.answerQuestion(cleanMessage, conversationHistory);

    // 4. LOGIC PENYIMPANAN DATABASE (HANYA JIKA USER LOGIN) - OPTIMIZED
    let currentConversationId = conversationId ? parseInt(conversationId) : null;
    let shouldCreateNewConversation = isNewChat || !conversationId;

    if (userId) {
      try {
        // --- BLOK LOGIKA USER LOGIN (SIMPAN KE DB) ---
        const conversationTitle = cleanMessage.substring(0, 50) + (cleanMessage.length > 50 ? '...' : '');

        if (shouldCreateNewConversation) {
          // A. Buat Percakapan Baru
          console.log('🆕 [AI CONTROLLER] Creating NEW conversation (User Login)');
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
          console.log(`✅ [AI CONTROLLER] New conversation created: ${currentConversationId}`);

        } else {
          // B. Lanjutkan Percakapan Lama
          console.log(`🔄 [AI CONTROLLER] Updating EXISTING conversation: ${currentConversationId}`);
          
          // Cek validitas conversation
          const existingConv = await prisma.conversation.findFirst({
            where: { 
              id: currentConversationId, 
              userId: userId 
            }
          });

          if (existingConv) {
            // Simpan pesan ke message table
            await prisma.message.createMany({
              data: [
                { conversationId: currentConversationId, role: 'user', content: cleanMessage },
                { conversationId: currentConversationId, role: 'bot', content: aiResponse }
              ]
            });

            // Update timestamp dan title jika perlu
            const updateData = { 
              updatedAt: new Date()
            };
            
            if (existingConv.title.length < 10 || existingConv.title.includes('...')) {
              updateData.title = conversationTitle;
            }

            await prisma.conversation.update({
              where: { id: currentConversationId },
              data: updateData
            });

            console.log(`✅ [AI CONTROLLER] Conversation ${currentConversationId} updated`);
          } else {
            // Fallback: Buat conversation baru
            console.warn('⚠️ [AI CONTROLLER] Conversation ID not found. Creating new conversation.');
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
            shouldCreateNewConversation = true;
          }
        }
      } catch (dbError) {
        console.error('❌ [AI CONTROLLER] Database save error:', dbError);
        // Jangan gagal total hanya karena database error
        // Tetap lanjut dengan response AI
      }
    } else {
      // --- BLOK LOGIKA GUEST ---
      console.log('👻 [AI CONTROLLER] Guest Mode - Skipping database save.');
      // Tidak menyimpan chat guest ke database
    }

    // 5. Kirim Response ke Frontend - ENHANCED
    const responseData = {
      success: true,
      reply: aiResponse,
      conversationId: currentConversationId, // Null jika guest
      timestamp: new Date().toISOString(),
      isNewConversation: userId ? shouldCreateNewConversation : true // Guest selalu dianggap 'baru'
    };

    console.log(`✅ [AI CONTROLLER] Response sent: ${responseData.isNewConversation ? 'NEW' : 'EXISTING'} conversation`);
    res.json(responseData);

  } catch (error) {
    console.error('❌ [AI CONTROLLER] Chat Error:', error);
    res.status(500).json({
      success: false,
      message: "Afwan, sistem sedang mengalami gangguan. Silakan coba lagi atau hubungi Admin Kampus di 0821-84-800-600.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * ============================================================================
 * 2. FITUR RAG SYSTEM (KNOWLEDGE BASE) - ENHANCED
 * ============================================================================
 */

// ✅ FUNCTION TRIGGER INGESTION (Manual Upload Data ke Qdrant) - IMPROVED
const triggerIngestion = async (req, res) => {
  try {
    console.log("🔄 [AI CONTROLLER] Memulai proses ingestion manual...");
    
    // Cek status sebelum ingestion
    const beforeStatus = await ragService.getCollectionInfo();
    console.log('📊 [AI CONTROLLER] Status sebelum ingestion:', beforeStatus);
    
    // Panggil fungsi ingestion di RagService
    const result = await ragService.ingestData();
    
    if (result.success) {
      // Cek status setelah ingestion
      const afterStatus = await ragService.getCollectionInfo();
      
      console.log(`✅ [AI CONTROLLER] Ingestion successful: ${result.count} chunks from ${result.filesProcessed?.length || 0} files`);
      
      res.json({
        success: true,
        message: `Alhamdulillah! ${result.count} data berhasil diproses dari ${result.filesProcessed?.length || 0} file.`,
        chunksProcessed: result.count,
        filesProcessed: result.filesProcessed,
        before: beforeStatus,
        after: afterStatus
      });
    } else {
      console.error('❌ [AI CONTROLLER] Ingestion failed:', result.error);
      res.status(500).json({
        success: false,
        message: result.message || "Gagal melakukan ingestion data.",
        error: result.error,
        details: result
      });
    }
  } catch (error) {
    console.error('❌ [AI CONTROLLER] Ingestion Error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Terjadi kesalahan sistem saat memproses data.",
      error: error.message 
    });
  }
};

/**
 * ============================================================================
 * 3. FITUR MANAJEMEN PERCAKAPAN (CRUD - AUTH REQUIRED) - OPTIMIZED
 * ============================================================================
 */

// ✅ GET ALL CONVERSATIONS - IMPROVED
const getConversations = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    console.log(`📂 [AI CONTROLLER] Getting conversations for user: ${userId}`);
    
    const conversations = await prisma.conversation.findMany({
      where: { userId: userId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true, createdAt: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50 // Limit untuk prevent overload
    });

    const formatted = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      lastMessage: conv.messages[0]?.content || 'No messages',
      messageCount: conv._count.messages,
      lastMessageTime: conv.messages[0]?.createdAt || conv.updatedAt,
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt
    }));

    console.log(`✅ [AI CONTROLLER] Found ${formatted.length} conversations for user ${userId}`);
    
    res.json({ 
      success: true, 
      conversations: formatted,
      total: formatted.length 
    });
  } catch (error) {
    console.error('❌ [AI CONTROLLER] Error getting conversations:', error);
    res.status(500).json({ 
      success: false, 
      message: "Gagal mengambil data percakapan",
      error: error.message 
    });
  }
};

// ✅ GET CHAT HISTORY (DETAIL) - ENHANCED
const getChatHistory = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    if (!chatId || isNaN(parseInt(chatId))) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid chat ID" 
      });
    }

    console.log(`📖 [AI CONTROLLER] Getting history for chat: ${chatId}, user: ${userId}`);
    
    const conversation = await prisma.conversation.findFirst({
      where: { 
        id: parseInt(chatId), 
        userId: userId 
      },
      include: {
        messages: {
          select: { 
            id: true,
            role: true, 
            content: true, 
            createdAt: true 
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        message: "Percakapan tidak ditemukan" 
      });
    }

    console.log(`✅ [AI CONTROLLER] Found ${conversation.messages.length} messages in conversation ${chatId}`);
    
    res.json({ 
      success: true, 
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      },
      messages: conversation.messages 
    });
  } catch (error) {
    console.error('❌ [AI CONTROLLER] Error getting history:', error);
    res.status(500).json({ 
      success: false, 
      message: "Gagal mengambil riwayat percakapan",
      error: error.message 
    });
  }
};

// ✅ DELETE CONVERSATION - IMPROVED
const deleteConversation = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    if (!chatId || isNaN(parseInt(chatId))) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid chat ID" 
      });
    }

    console.log(`🗑️ [AI CONTROLLER] Deleting conversation: ${chatId} for user: ${userId}`);
    
    // Gunakan transaction untuk atomic operation
    const result = await prisma.$transaction(async (tx) => {
      // Hapus messages dulu
      await tx.message.deleteMany({ 
        where: { 
          conversationId: parseInt(chatId) 
        } 
      });
      
      // Hapus conversation
      const deleteResult = await tx.conversation.deleteMany({
        where: { 
          id: parseInt(chatId), 
          userId: userId 
        }
      });

      return deleteResult;
    });

    if (result.count === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Percakapan tidak ditemukan" 
      });
    }

    console.log(`✅ [AI CONTROLLER] Successfully deleted conversation: ${chatId}`);
    
    res.json({ 
      success: true, 
      message: "Percakapan berhasil dihapus" 
    });
  } catch (error) {
    console.error('❌ [AI CONTROLLER] Error deleting conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: "Gagal menghapus percakapan",
      error: error.message 
    });
  }
};

/**
 * ============================================================================
 * 4. FITUR AKADEMIK AI (ANALYSIS - AUTH REQUIRED) - MAINTAINED
 * ============================================================================
 */

// ✅ ANALYZE ACADEMIC PERFORMANCE
const analyzeAcademicPerformance = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ 
      success: false,
      message: "Authentication required" 
    });

    console.log('🧠 [AI CONTROLLER] Analyzing academic for:', userId);
    const result = await academicService.analyzeAcademicPerformance(userId);

    if (result.success) {
      res.json({ 
        success: true, 
        data: result.data,
        message: result.message 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.message 
      });
    }

  } catch (error) {
    console.error('❌ [AI CONTROLLER] Academic analysis error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Gagal menganalisis performa akademik",
      error: error.message 
    });
  }
};

// ✅ GET STUDY RECOMMENDATIONS
const getStudyRecommendations = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ 
      success: false,
      message: "Authentication required" 
    });

    console.log('💡 [AI CONTROLLER] Getting recommendations for:', userId);
    const result = await academicService.getStudyRecommendations(userId);

    if (result.success) {
      res.json({ 
        success: true, 
        data: result.data,
        message: result.message 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.message 
      });
    }

  } catch (error) {
    console.error('❌ [AI CONTROLLER] Study recommendations error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Gagal mengambil rekomendasi belajar",
      error: error.message 
    });
  }
};

/**
 * ============================================================================
 * 5. TESTING UTILITIES - ENHANCED
 * ============================================================================
 */

// ✅ TEST RAW AI (Tanpa RAG, langsung OpenAI)
const testAI = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ 
        success: false,
        message: "Message required" 
      });
    }

    console.log('🔍 [AI CONTROLLER] AI Raw Test:', message);
    const aiResponse = await generateAIResponse(message, [], null); 

    res.json({ 
      success: true, 
      response: aiResponse,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [AI CONTROLLER] AI Test error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ TEST OPENAI CONNECTION - IMPROVED
const testOpenAIConnectionHandler = async (req, res) => {
  try {
    console.log('🔧 [AI CONTROLLER] Testing OpenAI connection...');
    const result = await testOpenAIConnection();
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'OpenAI Connection Successful', 
        details: result,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'OpenAI Connection Failed', 
        error: result.error 
      });
    }
  } catch (error) {
    console.error('❌ [AI CONTROLLER] OpenAI connection test error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'OpenAI Connection Test Failed',
      error: error.message 
    });
  }
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