const { generateAIResponse, testOpenAIConnection } = require('../services/openaiService');
const academicService = require('../services/academicService');
const prisma = require('../../config/prisma');

// ✅ FUNCTION TEST AI - PANGGIL OPENAI
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

    // ✅ PANGGIL OPENAI SERVICE
    const aiResponse = await generateAIResponse(message);

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

// ✅ FUNCTION TEST OPENAI CONNECTION
const testOpenAIConnectionHandler = async (req, res) => {
  try {
    console.log('🔧 Testing OpenAI connection...');
    
    // ✅ GUNAKAN service yang sudah di-import di atas file
    const result = await testOpenAIConnection();

    if (result.success) {
      res.json({
        success: true,
        message: 'OpenAI connection test successful',
        response: result.message,
        model: result.model,
        tokens: result.tokens
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'OpenAI connection test failed',
        error: result.error,
        details: result.details,
        code: result.code
      });
    }
    
  } catch (error) {
    console.error('❌ OpenAI connection test error:', error);
    res.status(500).json({
      success: false,
      message: 'OpenAI connection test failed',
      error: error.message
    });
  }
};

// ✅ FUNCTION SEND CHAT - DENGAN LOGIC isNewChat YANG BENAR
const sendChat = async (req, res) => {
  try {
    const { message, conversationId, isNewChat } = req.body;
    const userId = req.user?.id;

    console.log('💬 Chat Request:', { 
      userId, 
      message, 
      conversationId, 
      isNewChat,
      requestBody: req.body // ✅ DEBUG: Log seluruh request body
    });

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

    // ✅ DAPATKAN CONVERSATION HISTORY JIKA LANJUTKAN CHAT
    let conversationHistory = [];
    if (conversationId && !isNewChat) {
      const existingMessages = await prisma.message.findMany({
        where: {
          conversationId: parseInt(conversationId),
          conversation: {
            userId: userId
          }
        },
        select: {
          role: true,
          content: true
        },
        orderBy: {
          createdAt: 'asc'
        },
        take: 10 // Ambil 10 pesan terakhir untuk context
      });
      
      conversationHistory = existingMessages;
      console.log('📚 Loaded conversation history:', conversationHistory.length, 'messages');
    }

    // ✅ PANGGIL OPENAI SERVICE DENGAN HISTORY
    const aiResponse = await generateAIResponse(message, conversationHistory);
    
    let currentConversationId;
    const conversationTitle = message.substring(0, 50) + (message.length > 50 ? '...' : '');

    // ✅ LOGIC UNTUK MENENTUKAN APAKAH BUAT CONVERSATION BARU ATAU LANJUTKAN EXISTING
    const shouldCreateNewConversation = isNewChat || !conversationId;

    console.log('🔍 [AI CONTROLLER] Conversation decision:', {
      shouldCreateNewConversation,
      isNewChat,
      conversationId,
      hasConversationId: !!conversationId
    });

    if (shouldCreateNewConversation) {
      // ✅ BUAT CONVERSATION BARU + SIMPAN MESSAGES
      console.log('🆕 [AI CONTROLLER] Creating NEW conversation');
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
      console.log('✅ [AI CONTROLLER] New conversation created:', currentConversationId);
    } else {
      // ✅ LANJUTKAN CONVERSATION YANG SUDAH ADA
      console.log('🔄 [AI CONTROLLER] Continuing EXISTING conversation:', conversationId);
      currentConversationId = parseInt(conversationId);
      
      // Verifikasi conversation milik user
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          id: currentConversationId,
          userId: userId
        }
      });

      if (!existingConversation) {
        console.log('❌ [AI CONTROLLER] Conversation not found, creating new one');
        // Jika conversation tidak ditemukan, buat yang baru
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
        // ✅ TAMBAHKAN MESSAGES BARU KE CONVERSATION EXISTING
        console.log('📝 [AI CONTROLLER] Adding messages to existing conversation');
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

        // Update judul conversation hanya jika perlu
        if (existingConversation.title.length < 10) { // Hanya update jika judul terlalu pendek
          await prisma.conversation.update({
            where: {
              id: currentConversationId
            },
            data: {
              title: conversationTitle,
              updatedAt: new Date()
            }
          });
        } else {
          // Hanya update timestamp
          await prisma.conversation.update({
            where: {
              id: currentConversationId
            },
            data: {
              updatedAt: new Date()
            }
          });
        }
        console.log('✅ [AI CONTROLLER] Messages added to existing conversation');
      }
    }

    const responseData = {
      success: true,
      reply: aiResponse,
      conversationId: currentConversationId,
      timestamp: new Date().toISOString(),
      hasPDF: false,
      isNewConversation: shouldCreateNewConversation // ✅ DEBUG: Kirim info apakah conversation baru
    };

    console.log('✅ [AI CONTROLLER] Chat Response saved to database:', {
      conversationId: currentConversationId,
      isNewConversation: shouldCreateNewConversation,
      messageCount: '2 messages added'
    });

    res.json(responseData);

  } catch (error) {
    console.error('❌ [AI CONTROLLER] Chat Error:', error);
    res.status(500).json({
      success: false,
      message: "Chat service error",
      error: error.message
    });
  }
};

// ✅ FUNCTION GET CONVERSATIONS - AMBIL DARI DATABASE
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

// ✅ FUNCTION GET CHAT HISTORY - AMBIL DARI DATABASE
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

// ✅ FUNCTION DELETE CONVERSATION
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

// ✅ NEW FUNCTION: ANALYZE ACADEMIC PERFORMANCE
const analyzeAcademicPerformance = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    console.log('🧠 [AI CONTROLLER] Analyzing academic performance for user:', userId);

    const result = await academicService.analyzeAcademicPerformance(userId);

    if (result.success) {
      res.json({
        success: true,
        message: "Academic analysis generated successfully",
        data: result.data
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
      message: "Error analyzing academic performance",
      error: error.message
    });
  }
};

// ✅ NEW FUNCTION: GET STUDY RECOMMENDATIONS
const getStudyRecommendations = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required"
      });
    }

    console.log('💡 [AI CONTROLLER] Getting study recommendations for user:', userId);

    const result = await academicService.getStudyRecommendations(userId);

    if (result.success) {
      res.json({
        success: true,
        message: "Study recommendations generated successfully",
        data: result.data
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
      message: "Error generating study recommendations",
      error: error.message
    });
  }
};

// ✅ EXPORTS FUNCTION
  module.exports = {
  testAI,
  testOpenAIConnection: testOpenAIConnectionHandler,
  sendChat,
  getConversations,
  getChatHistory,
  deleteConversation,
  analyzeAcademicPerformance,
  getStudyRecommendations
};

// Test di akhir file
console.log('✅ AI Controller loaded successfully');
console.log('- testAI is function:', typeof testAI === 'function');
console.log('- testOpenAIConnectionHandler is function:', typeof testOpenAIConnectionHandler === 'function');
console.log('- sendChat is function:', typeof sendChat === 'function');
console.log('- analyzeAcademicPerformance is function:', typeof analyzeAcademicPerformance === 'function');
console.log('- getStudyRecommendations is function:', typeof getStudyRecommendations === 'function');