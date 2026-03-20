const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/authMiddleware');
const { getChatLogs, getRealtimeAnalytics, getHistoryAnalytics, listKnowledgeBase, addKnowledgeDoc, deleteKnowledgeDoc, getBugReports, updateBugReport, uploadPdfDoc, pdfUpload } = require('../controllers/adminController');
const logger = require('../utils/logger');

// ============================================================
// IP WHITELIST MIDDLEWARE
// Set ADMIN_ALLOWED_IPS in .env as comma-separated IPs.
// If not set, all IPs are allowed (backward compatible).
// Example: ADMIN_ALLOWED_IPS=192.168.1.1,10.0.0.5
// ============================================================
// Parse once at module load — env is static after startup
const allowedAdminIPs = process.env.ADMIN_ALLOWED_IPS
  ? process.env.ADMIN_ALLOWED_IPS.split(',').map(ip => ip.trim())
  : null;

const isProduction = process.env.NODE_ENV === 'production';

const ipWhitelist = (req, res, next) => {
  // Jika ADMIN_ALLOWED_IPS tidak dikonfigurasi:
  //   - production → tolak semua (fail-secure)
  //   - development → izinkan semua (kemudahan dev)
  if (!allowedAdminIPs) {
    if (isProduction) {
      logger.warn('[ADMIN] ADMIN_ALLOWED_IPS not set — blocking all admin access in production');
      return res.status(403).json({ success: false, message: 'Admin access not configured' });
    }
    return next();
  }

  const clientIP = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');

  if (allowedAdminIPs.includes(clientIP)) return next();

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
router.post('/knowledge-base/upload-pdf', (req, res, next) => {
  pdfUpload.single('file')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10MB.' });
    }
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, uploadPdfDoc);

// Bug Reports
router.get('/bug-reports', getBugReports);
router.patch('/bug-reports/:id', updateBugReport);

module.exports = router;
