const express = require('express');
const router = express.Router();

// Import Controller
const academicController = require('../controllers/academicController');

// ✅ PERBAIKAN DI SINI:
// Kita sesuaikan dengan nama asli di authMiddleware.js yaitu 'requireAuth'
const { requireAuth } = require('../middleware/authMiddleware');

// ==========================================
// 🛣️ ACADEMIC ROUTES
// Base URL: /api/academic (Sudah didaftarkan di app.js)
// ==========================================

/**
 * @route   GET /api/academic/summary
 * @desc    Ambil ringkasan akademik (IPK, SKS, Prodi) user yang login
 * @access  Private (Mahasiswa)
 */
// Gunakan 'requireAuth' sebagai middleware
router.get('/summary', requireAuth, academicController.getAcademicSummary);

/**
 * @route   GET /api/academic/grades
 * @desc    Ambil daftar nilai. Bisa filter ?semester=1
 * @access  Private (Mahasiswa)
 */
router.get('/grades', requireAuth, academicController.getGrades);

/**
 * @route   GET /api/academic/transcript
 * @desc    Ambil transkrip lengkap (Summary + Semua Nilai)
 * @access  Private (Mahasiswa)
 */
router.get('/transcript', requireAuth, academicController.getTranscript);

/**
 * @route   POST /api/academic/analyze
 * @desc    Analisis performa akademik menggunakan AI berdasarkan data DB
 * @access  Private (Mahasiswa)
 */
router.post('/analyze', requireAuth, academicController.analyzePerformance);

module.exports = router;