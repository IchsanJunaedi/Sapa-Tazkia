const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const aiController = require('../controllers/aiController');

// ========================================================
// AUTHENTICATED AI ROUTES - untuk users yang sudah login
// ========================================================

// ✅ CHAT ROUTES
router.post('/chat', authMiddleware.requireAuth, aiController.sendChat);
router.get('/conversations', authMiddleware.requireAuth, aiController.getConversations);
router.get('/history/:chatId', authMiddleware.requireAuth, aiController.getChatHistory);
router.delete('/conversations/:chatId', authMiddleware.requireAuth, aiController.deleteConversation);

// ✅ ACADEMIC ANALYSIS ROUTES - Fitur baru dengan OpenAI
router.post('/analyze-academic', authMiddleware.requireAuth, aiController.analyzeAcademicPerformance);
router.post('/study-recommendations', authMiddleware.requireAuth, aiController.getStudyRecommendations);

// ========================================================
// TEST ROUTES - tanpa auth untuk testing
// ========================================================

// ✅ AI TEST ROUTES
router.post('/test-ai', aiController.testAI);
router.get('/test-openai', aiController.testOpenAIConnection); // ✅ PERBAIKAN: Gunakan function yang benar

// ✅ PUBLIC TEST ROUTE - tanpa session dependency
router.get('/public-test', (req, res) => {
  res.json({
    success: true,
    message: 'Public test route working!',
    timestamp: new Date().toISOString(),
    session: req.sessionID || 'No session required',
    aiProvider: process.env.AI_PROVIDER || 'openai',
    aiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  });
});

// ========================================================
// HEALTH CHECK ROUTES - untuk monitoring
// ========================================================

// ✅ AI SERVICE HEALTH CHECK
router.get('/health', async (req, res) => {
  try {
    const { testOpenAIConnection } = require('../services/openaiService');
    const aiHealth = await testOpenAIConnection();
    
    res.json({
      success: true,
      service: 'AI Service',
      status: aiHealth.success ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      details: {
        provider: process.env.AI_PROVIDER || 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        apiKeyConfigured: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'),
        connectionTest: aiHealth
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'AI Service',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// ========================================================
// ROUTE INFO ENDPOINT - untuk dokumentasi
// ========================================================

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🤖 SAPA TAZKIA AI API ROUTES',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    aiProvider: process.env.AI_PROVIDER || 'openai',
    aiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    endpoints: {
      authenticated: {
        'POST /api/ai/chat': 'Send chat message',
        'GET /api/ai/conversations': 'Get user conversations',
        'GET /api/ai/history/:chatId': 'Get chat history',
        'DELETE /api/ai/conversations/:chatId': 'Delete conversation',
        'POST /api/ai/analyze-academic': 'Analyze academic performance',
        'POST /api/ai/study-recommendations': 'Get study recommendations'
      },
      public: {
        'POST /api/ai/test-ai': 'Test AI with message',
        'GET /api/ai/test-openai': 'Test OpenAI connection',
        'GET /api/ai/public-test': 'Public test route',
        'GET /api/ai/health': 'AI service health check',
        'GET /api/ai': 'Route information (this endpoint)'
      }
    },
    features: {
      chat: true,
      conversationHistory: true,
      academicAnalysis: true,
      studyRecommendations: true,
      multipleModels: false,
      fileUpload: false
    }
  });
});

module.exports = router;