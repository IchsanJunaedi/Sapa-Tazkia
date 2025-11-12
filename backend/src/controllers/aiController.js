const { generateGeminiResponse, testGeminiConnection } = require('../services/geminiService');
const { validationResult } = require('express-validator');

// ✅ FUNCTION TEST AI YANG DIPERBAIKI - PANGGIL GEMINI
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

    // ✅ PERBAIKAN: PANGGIL GEMINI SERVICE
    const aiResponse = await generateGeminiResponse(message);

    res.json({
      success: true,
      message: "AI test successful",
      input: message,
      response: aiResponse  // Response dari Gemini, bukan static text
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

// ✅ FUNCTION TEST GEMINI CONNECTION YANG DIPERBAIKI
const testGeminiConnectionHandler = async (req, res) => {
  try {
    console.log('🔍 Gemini Connection Test');
    
    // ✅ PERBAIKAN: PANGGIL GEMINI SERVICE
    const result = await testGeminiConnection();
    
    if (result.success) {
      res.json({
        success: true,
        message: "Gemini connection test successful",
        response: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Gemini connection test failed",
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('❌ Gemini Test Error:', error);
    res.status(500).json({
      success: false,
      message: "Gemini test error",
      error: error.message
    });
  }
};

// ✅ FUNCTION SEND CHAT YANG DIPERBAIKI - PANGGIL GEMINI
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

    // ✅ PERBAIKAN: PANGGIL GEMINI SERVICE
    const aiResponse = await generateGeminiResponse(message);
    
    const responseData = {
      success: true,
      reply: aiResponse,  // Response dari Gemini
      conversationId: conversationId || `conv-${Date.now()}`,
      timestamp: new Date().toISOString(),
      hasPDF: false
    };

    console.log('✅ Chat Response sent');
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

// ✅ FUNCTION GET CONVERSATIONS
const getConversations = async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log('📋 Get Conversations for user:', userId);

    const mockConversations = [
      {
        id: 'conv-1',
        title: 'Pertanyaan tentang jurusan',
        lastMessage: 'Apa saja jurusan di STMIK Tazkia?',
        updatedAt: new Date().toISOString()
      },
      {
        id: 'conv-2', 
        title: 'Informasi lokasi kampus',
        lastMessage: 'Dimana lokasi STMIK Tazkia?',
        updatedAt: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      conversations: mockConversations
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

// ✅ FUNCTION GET CHAT HISTORY
const getChatHistory = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;

    console.log('📜 Get Chat History:', { userId, chatId });

    const mockMessages = [
      {
        role: 'user',
        content: 'Halo, apa saja jurusan di STMIK Tazkia?',
        createdAt: new Date().toISOString()
      },
      {
        role: 'bot', 
        content: 'STMIK Tazkia memiliki jurusan Sistem Informasi (S1) dan Teknik Informatika (S1) dengan akreditasi A.',
        createdAt: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      messages: mockMessages
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

// ✅ PASTIKAN EXPORTS FUNCTION, BUKAN OBJECT
module.exports = {
  testAI,
  testGeminiConnection: testGeminiConnectionHandler, // Perhatikan nama di sini
  sendChat,
  getConversations,
  getChatHistory
};

// Test di akhir file
console.log('✅ AI Controller loaded successfully');
console.log('- testAI is function:', typeof testAI === 'function');
console.log('- sendChat is function:', typeof sendChat === 'function');
console.log('- generateGeminiResponse available:', typeof generateGeminiResponse === 'function');