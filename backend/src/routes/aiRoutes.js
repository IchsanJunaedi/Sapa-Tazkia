const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const aiController = require('../controllers/aiController');

// ✅ ROUTES - untuk authenticated users
router.post('/chat', authMiddleware.requireAuth, aiController.sendChat);
router.get('/conversations', authMiddleware.requireAuth, aiController.getConversations);
router.get('/history/:chatId', authMiddleware.requireAuth, aiController.getChatHistory);

// ✅ TEST ROUTES - tanpa auth untuk testing
router.post('/test-ai', aiController.testAI);
router.get('/test-gemini', aiController.testGeminiConnection);

// ✅ NEW: Public test route tanpa session dependency
router.get('/public-test', (req, res) => {
  res.json({
    success: true,
    message: 'Public test route working!',
    timestamp: new Date().toISOString(),
    session: req.sessionID || 'No session required'
  });
});

module.exports = router;