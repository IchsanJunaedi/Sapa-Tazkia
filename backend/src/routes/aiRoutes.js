const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const aiController = require('../controllers/aiController');

// ✅ ROUTES - pastikan path nya benar
router.post('/test-ai', aiController.testAI);
router.get('/test-gemini', aiController.testGeminiConnection);

// ✅ CHAT ROUTES - tanpa /api prefix di sini
router.post('/chat', authMiddleware.requireAuth, aiController.sendChat);
router.get('/chat/conversations', authMiddleware.requireAuth, aiController.getConversations);
router.get('/chat/history/:chatId', authMiddleware.requireAuth, aiController.getChatHistory);

module.exports = router;