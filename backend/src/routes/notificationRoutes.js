const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getNotifications, markAllRead, markRead } = require('../controllers/notificationController');

router.use(requireAuth);

router.get('/', getNotifications);
router.patch('/read-all', markAllRead);   // MUST be before /:id/read
router.patch('/:id/read', markRead);

module.exports = router;
