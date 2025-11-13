// routes/guestRoutes.js
const express = require('express');
const router = express.Router();
const { guestChat, getGuestConversation } = require('../controllers/guestController');

// Guest chat (tanpa auth)
router.post('/chat', guestChat);
router.get('/conversation/:sessionId', getGuestConversation);

module.exports = router;