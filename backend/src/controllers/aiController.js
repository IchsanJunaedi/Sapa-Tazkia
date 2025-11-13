const { generateGeminiResponse, testGeminiConnection } = require('../services/geminiService');
const prisma = require('../../config/prisma');

// ✅ FUNCTION TEST AI - PANGGIL GEMINI
const testAI = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    console.log('🔍 AI Test Request:', message);

    // ✅ PANGGIL GEMINI SERVICE
    const aiResponse = await generateGeminiResponse(message);

    res.json({
      success: true,
      message: "AI test successful",
      input: message,
      response: aiResponse
    });

  } catch (error) {
    console.error('❌ AI Test Error:', error);
    res.status(500).json({
      success: false,
      message: "AI service error",
      error: error.message
    });
  }
};

// ✅ FUNCTION TEST GEMINI CONNECTION - PERBAIKI NAMA FUNCTION
const testGeminiConnectionHandler = async (req, res) => {
  try {
    console.log('🔧 Testing Gemini connection...');
    
    // ✅ GUNAKAN service yang sudah di-import di atas file
    const result = await testGeminiConnection();

    if (result.success) {
      res.json({
        success: true,
        message: 'Gemini connection test successful',
        response: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Gemini connection test failed',
        error: result.error,
        details: result.details
      });
    }
    
  } catch (error) {
    console.error('❌ Gemini connection test error:', error);
    res.status(500).json({
      success: false,
      message: 'Gemini connection test failed',
      error: error.message
    });
  }
};

// ✅ FUNCTION SEND CHAT - SEKARANG PAKAI PRISMA DAN SIMPAN KE DATABASE
const sendChat = async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const userId = req.user?.id;

    console.log('💬 Chat Request:', { userId, message, conversationId });

    // Validasi manual
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    const deleteConversation = async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user.id;

        console.log(`🗑️ [AI CONTROLLER] Deleting conversation: ${chatId} for user: ${userId}`);

        // Cari conversation di database
        const conversation = await Conversation.findById(chatId);

        if (!conversation) {
            console.log(`❌ [AI CONTROLLER] Conversation not found: ${chatId}`);
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        // Validasi: Pastikan conversation milik user yang login
        if (conversation.userId.toString() !== userId) {
            console.log(`🚫 [AI CONTROLLER] Unauthorized delete attempt. User: ${userId}, Conversation Owner: ${conversation.userId}`);
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this conversation'
            });
        }

        // Hapus conversation dari database
        await Conversation.findByIdAndDelete(chatId);
        
        console.log(`✅ [AI CONTROLLER] Conversation deleted successfully: ${chatId}`);

        res.json({
            success: true,
            message: 'Conversation deleted successfully'
        });

    } catch (error) {
        console.error('❌ [AI CONTROLLER] Error deleting conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting conversation',
            error: error.message
        });
    }
};


    // ✅ PANGGIL GEMINI SERVICE
    const aiResponse = await generateGeminiResponse(message);
    
    let currentConversationId;
    const conversationTitle = message.substring(0, 50) + (message.length > 50 ? '...' : '');

    if (!conversationId) {
      // ✅ BUAT CONVERSATION BARU + SIMPAN MESSAGES
      const newConversation = await prisma.conversation.create({
        data: {
          userId: userId,
          title: conversationTitle,
          messages: {
            create: [
              {
                role: 'user',
                content: message
              },
              {
                role: 'bot',
                content: aiResponse
              }
            ]
          }
        }
      });
      currentConversationId = newConversation.id;
    } else {
      // ✅ UPDATE CONVERSATION YANG SUDAH ADA
      currentConversationId = parseInt(conversationId);
      
      // Verifikasi conversation milik user
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          id: currentConversationId,
          userId: userId
        }
      });

      if (!existingConversation) {
        return res.status(404).json({
          success: false,
          message: "Conversation not found"
        });
      }

      // Tambahkan messages baru
      await prisma.message.createMany({
        data: [
          {
            conversationId: currentConversationId,
            role: 'user',
            content: message
          },
          {
            conversationId: currentConversationId,
            role: 'bot',
            content: aiResponse
          }
        ]
      });

      // Update judul conversation
      await prisma.conversation.update({
        where: {
          id: currentConversationId
        },
        data: {
          title: conversationTitle,
          updatedAt: new Date()
        }
      });
    }

    const responseData = {
      success: true,
      reply: aiResponse,
      conversationId: currentConversationId, // Sekarang ID integer dari database
      timestamp: new Date().toISOString(),
      hasPDF: false
    };

    console.log('✅ Chat Response saved to database');
    res.json(responseData);

  } catch (error) {
    console.error('❌ Chat Error:', error);
    res.status(500).json({
      success: false,
      message: "Chat service error",
      error: error.message
    });
  }
};

// ✅ FUNCTION GET CONVERSATIONS - SEKARANG AMBIL DARI DATABASE
const getConversations = async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log('📋 Get Conversations for user:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    // ✅ AMBIL DARI DATABASE - AWALNYA KOSONG KALAU BELUM ADA CHAT
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: userId
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          select: {
            content: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Format response
    const formattedConversations = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      lastMessage: conv.messages[0]?.content || 'No messages',
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt
    }));

    res.json({
      success: true,
      conversations: formattedConversations
    });

  } catch (error) {
    console.error('❌ Get Conversations Error:', error);
    res.status(500).json({
      success: false,
      message: "Error getting conversations",
      error: error.message
    });
  }
};

// ✅ FUNCTION GET CHAT HISTORY - SEKARANG AMBIL DARI DATABASE
const getChatHistory = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    console.log('📜 Get Chat History:', { userId, chatId });

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    // ✅ AMBIL DARI DATABASE - VERIFIKASI CONVERSATION MILIK USER
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: parseInt(chatId),
        userId: userId
      },
      include: {
        messages: {
          select: {
            role: true,
            content: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    res.json({
      success: true,
      messages: conversation.messages
    });

  } catch (error) {
    console.error('❌ Get Chat History Error:', error);
    res.status(500).json({
      success: false,
      message: "Error getting chat history",
      error: error.message
    });
  }
};

// ✅ FUNCTION DELETE CONVERSATION - TAMBAHAN BARU
const deleteConversation = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    // Hapus messages terlebih dahulu
    await prisma.message.deleteMany({
      where: {
        conversationId: parseInt(chatId)
      }
    });

    // Hapus conversation
    const result = await prisma.conversation.deleteMany({
      where: {
        id: parseInt(chatId),
        userId: userId
      }
    });

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found"
      });
    }

    res.json({
      success: true,
      message: "Conversation deleted successfully"
    });

  } catch (error) {
    console.error('❌ Delete Conversation Error:', error);
    res.status(500).json({
      success: false,
      message: "Error deleting conversation",
      error: error.message
    });
  }
};

// ✅ EXPORTS FUNCTION - PERBAIKI NAMA
module.exports = {
  testAI,
  testGeminiConnection: testGeminiConnectionHandler, // ✅ PERBAIKI: Export dengan nama yang benar
  sendChat,
  getConversations,
  getChatHistory,
  deleteConversation
};

// Test di akhir file
console.log('✅ AI Controller loaded successfully');
console.log('- testAI is function:', typeof testAI === 'function');
console.log('- testGeminiConnectionHandler is function:', typeof testGeminiConnectionHandler === 'function');
console.log('- sendChat is function:', typeof sendChat === 'function');