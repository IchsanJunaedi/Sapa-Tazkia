const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit'); // ✅ Library standar keamanan (Install dulu: npm install express-rate-limit)

// Import Controller & Middleware Auth
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// ❌ KITA HAPUS IMPORT INI
// const { ipRateLimit, userRateLimit } = require('../middleware/rateLimitMiddleware');
// Alasannya: Kita tidak mau Auth bergantung pada kuota Token AI.

// ========================================================
// 🛡️ SECURITY RATE LIMITERS (Pos Satpam Khusus Auth)
// ========================================================

// 1. Strict Limiter (Untuk Login/Register/OTP)
// Sangat ketat: Maksimal 5x percobaan per 1 menit.
// Jika dilanggar, blokir IP tersebut sementara.
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 5, 
  message: { success: false, message: "Terlalu banyak percobaan. Silakan coba lagi dalam 1 menit." },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// 2. Auth Provider Limiter (Google)
// Sedikit lebih longgar karena melibatkan redirect browser.
const providerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Terlalu banyak request auth." }
});

// 3. General Limiter (Navigasi Biasa)
// Untuk cek sesi, cek profil, logout.
// Cukup longgar (30x/menit) agar user experience tetap nyaman.
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30, 
  message: { success: false, message: "Terlalu banyak request. Santai sedikit." }
});

// ========================================================
// PUBLIC ROUTES
// ========================================================

router.get('/test', generalLimiter, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Auth routes working!', 
    timestamp: new Date().toISOString() 
  });
});

router.get('/health', authController.healthCheck);

router.get('/check-session', generalLimiter, authController.checkAuth);

/**
 * @route   GET /api/auth/google
 */
router.get('/google', providerLimiter, authController.googleAuth);

/**
 * @route   GET /api/auth/google/callback
 */
router.get('/google/callback', 
  authController.googleCallback,
  authController.googleCallbackSuccess
);

/**
 * @route   POST /api/auth/login
 * @limit   STRICT (Anti Brute-Force)
 */
router.post('/login', strictLimiter, authController.login);

/**
 * @route   POST /api/auth/register
 * @limit   STRICT (Anti Spam Account)
 */
router.post('/register', strictLimiter, authController.register);

/**
 * @route   POST /api/auth/register-email
 * @limit   STRICT
 */
router.post('/register-email', strictLimiter, authController.registerWithEmail);

// ========================================================
// ✅ EMAIL VERIFICATION ROUTES (HIGH RISK)
// ========================================================

/**
 * @route   POST /api/auth/verify-email
 * @limit   STRICT (Mencegah tebak paksa kode OTP)
 */
router.post('/verify-email', strictLimiter, authController.verifyEmailCode);

/**
 * @route   POST /api/auth/resend-verification
 * @limit   STRICT (Mencegah Email Bombing)
 */
router.post('/resend-verification', strictLimiter, authController.resendVerificationCode);

/**
 * @route   GET /api/auth/check-verification/:email
 */
router.get('/check-verification/:email', generalLimiter, authController.checkEmailVerification);

// ========================================================
// UTILITY ROUTES
// ========================================================

/**
 * @route   GET /api/auth/check-nim/:nim
 * @limit   STRICT (Anti Scraping Data NIM)
 */
router.get('/check-nim/:nim', strictLimiter, authController.checkNIM);

// ========================================================
// PROTECTED ROUTES (LOGGED IN USERS)
// ========================================================

// 💡 NOTE: Route ini menggunakan 'generalLimiter' BUKAN 'userRateLimit'.
// Ini memastikan user tetap bisa logout/cek profil meskipun kuota AI mereka 0.

router.post('/logout', authMiddleware.requireAuth, generalLimiter, authController.logout);

router.get('/verify', authMiddleware.requireAuth, generalLimiter, authController.verify);

router.get('/me', authMiddleware.requireAuth, generalLimiter, authController.getProfile);

// ========================================================
// VERIFICATION & PROFILE MANAGEMENT
// ========================================================

router.post('/verify-student', authMiddleware.requireAuth, strictLimiter, authController.verifyStudent);

router.patch('/update-verification', authMiddleware.requireAuth, generalLimiter, authController.updateVerification);

router.patch('/update-profile', authMiddleware.requireAuth, generalLimiter, authController.updateProfile);

// ========================================================
// TEST ROUTES
// ========================================================

router.get('/protected-test', authMiddleware.requireAuth, generalLimiter, (req, res) => {
  res.json({
    success: true,
    message: 'Protected route working!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;