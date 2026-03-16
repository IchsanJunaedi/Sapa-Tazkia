const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { getChatLogs, getRealtimeAnalytics, getHistoryAnalytics, listKnowledgeBase, addKnowledgeDoc, deleteKnowledgeDoc } = require('../controllers/adminController');
const logger = require('../utils/logger');

// ============================================================
// IP WHITELIST MIDDLEWARE
// Set ADMIN_ALLOWED_IPS in .env as comma-separated IPs.
// If not set, all IPs are allowed (backward compatible).
// Example: ADMIN_ALLOWED_IPS=192.168.1.1,10.0.0.5
// ============================================================
const ipWhitelist = (req, res, next) => {
  const allowedIPs = process.env.ADMIN_ALLOWED_IPS;
  if (!allowedIPs) return next(); // not configured = allow all

  const clientIP = (req.ip || req.connection.remoteAddress || '').replace('::ffff:', '');
  const allowed = allowedIPs.split(',').map(ip => ip.trim());

  if (allowed.includes(clientIP)) return next();

  logger.warn(`[ADMIN] Blocked unauthorized IP: ${clientIP}`);
  return res.status(403).json({ success: false, message: 'Access denied' });
};

// Apply IP whitelist first, then admin auth
router.use(ipWhitelist);
router.use(requireAdmin);

// Logs
router.get('/chat-logs', getChatLogs);

// Analytics
router.get('/analytics/realtime', getRealtimeAnalytics);
router.get('/analytics/history', getHistoryAnalytics);

// Knowledge Base CRUD
router.get('/knowledge-base', listKnowledgeBase);
router.post('/knowledge-base', addKnowledgeDoc);
router.delete('/knowledge-base/:id', deleteKnowledgeDoc);

module.exports = router;
