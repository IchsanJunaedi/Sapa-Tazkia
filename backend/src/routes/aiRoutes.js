const express = require('express');
const router = express.Router();
const { testAI, testGeminiConnection } = require('../controllers/aiController');

// POST /api/test-ai
router.post('/test-ai', testAI);

// GET /api/test-gemini
router.get('/test-gemini', testGeminiConnection);

module.exports = router;