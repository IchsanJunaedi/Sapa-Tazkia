const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { createBugReport } = require('../controllers/bugReportController');

router.post('/', requireAuth, createBugReport);

module.exports = router;
