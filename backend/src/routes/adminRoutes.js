const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { getChatLogs, getRealtimeAnalytics, getHistoryAnalytics } = require('../controllers/adminController');

// All routes here should be protected by requireAdmin
// Note: requireAdmin internally calls requireAuth, so we only need requireAdmin here
router.use(requireAdmin);

// Logs
router.get('/chat-logs', getChatLogs);

// Analytics
router.get('/analytics/realtime', getRealtimeAnalytics);
router.get('/analytics/history', getHistoryAnalytics);

module.exports = router;
