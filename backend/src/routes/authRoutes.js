const express = require('express');
const router = express.Router();

// Import Controller & Middleware Auth
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// ✅ IMPORT RATE LIMIT MIDDLEWARE (NEW)
// ipRateLimit: Limit ketat (5 request/menit) untuk endpoint publik berbahaya.
// userRateLimit: Limit lega (20-100 request/menit) untuk user yang sudah login.
const { ipRateLimit, userRateLimit } = require('../middleware/rateLimitMiddleware');

// ========================================================
// PUBLIC ROUTES (OPEN TO EVERYONE)
// ========================================================

/**
 * @route   GET /api/auth/test
 * @desc    Test route check
 * @access  Public
 * @limit   None (Monitoring purpose)
 */
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Auth routes working!', 
    timestamp: new Date().toISOString() 
  });
});

/**
 * @route   GET /api/auth/health
 * @desc    Health check
 * @access  Public
 */
router.get('/health', authController.healthCheck);

/**
 * @route   GET /api/auth/check-session
 * @desc    Check session status
 * @access  Public
 */
router.get('/check-session', authController.checkAuth);

/**
 * @route   GET /api/auth/google
 * @desc    Mulai proses otentikasi Google
 * @access  Public
 * @limit   IP Limit (Prevent spamming auth provider)
 */
router.get('/google', ipRateLimit, authController.googleAuth);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Callback Google login
 * @access  Public
 */
router.get('/google/callback', 
  authController.googleCallback,
  authController.googleCallbackSuccess
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user (Email/NIM + Password)
 * @access  Public
 * @limit   STRICT IP LIMIT (Anti Brute-Force)
 */
// 🛡️ SECURITY: Hanya boleh coba login 5x per menit.
router.post('/login', ipRateLimit, authController.login);

/**
 * @route   POST /api/auth/register
 * @desc    Registrasi user baru
 * @access  Public
 * @limit   STRICT IP LIMIT (Anti Spam Account)
 */
// 🛡️ SECURITY: Mencegah bot membuat ribuan akun palsu.
router.post('/register', ipRateLimit, authController.register);

/**
 * @route   POST /api/auth/register-email
 * @desc    Registrasi email only
 * @access  Public
 * @limit   STRICT IP LIMIT
 */
router.post('/register-email', ipRateLimit, authController.registerWithEmail);

// ========================================================
// ✅ EMAIL VERIFICATION ROUTES (HIGH RISK TARGETS)
// ========================================================

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verifikasi kode OTP 6 digit
 * @access  Public
 * @limit   STRICT IP LIMIT
 */
// 🛡️ SECURITY: Mencegah hacker menebak kode OTP secara paksa.
router.post('/verify-email', ipRateLimit, authController.verifyEmailCode);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Kirim ulang kode OTP
 * @access  Public
 * @limit   STRICT IP LIMIT
 */
// 🛡️ SECURITY: SANGAT PENTING! Mencegah "Email Bombing" yang bisa merusak reputasi domain kampus.
router.post('/resend-verification', ipRateLimit, authController.resendVerificationCode);

/**
 * @route   GET /api/auth/check-verification/:email
 * @desc    Cek status verifikasi
 * @access  Public
 * @limit   IP Limit
 */
router.get('/check-verification/:email', ipRateLimit, authController.checkEmailVerification);

// ========================================================
// UTILITY ROUTES
// ========================================================

/**
 * @route   GET /api/auth/check-nim/:nim
 * @desc    Cek ketersediaan NIM
 * @access  Public
 * @limit   IP Limit (Anti Scraping)
 */
// 🛡️ SECURITY: Mencegah orang mencuri database NIM mahasiswa.
router.get('/check-nim/:nim', ipRateLimit, authController.checkNIM);

// ========================================================
// PROTECTED ROUTES (LOGGED IN USERS)
// ========================================================

// 💡 NOTE: Semua route di bawah ini menggunakan 'authMiddleware.requireAuth'
// Kita tambahkan 'userRateLimit' agar API tidak di-abuse oleh user yang sudah login.

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authMiddleware.requireAuth, userRateLimit, authController.logout);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token & user data
 * @access  Private
 */
router.get('/verify', authMiddleware.requireAuth, userRateLimit, authController.verify);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authMiddleware.requireAuth, userRateLimit, authController.getProfile);

// ========================================================
// VERIFICATION & PROFILE MANAGEMENT
// ========================================================

/**
 * @route   POST /api/auth/verify-student
 * @desc    Verifikasi data akademik mahasiswa
 * @access  Private
 */
router.post('/verify-student', authMiddleware.requireAuth, userRateLimit, authController.verifyStudent);

/**
 * @route   PATCH /api/auth/update-verification
 * @desc    Update status verifikasi
 * @access  Private
 */
router.patch('/update-verification', authMiddleware.requireAuth, userRateLimit, authController.updateVerification);

/**
 * @route   PATCH /api/auth/update-profile
 * @desc    Update user profile
 * @access  Private
 */
router.patch('/update-profile', authMiddleware.requireAuth, userRateLimit, authController.updateProfile);

// ========================================================
// TEST ROUTES
// ========================================================

/**
 * @route   GET /api/auth/protected-test
 * @desc    Test protected route
 * @access  Private
 */
router.get('/protected-test', authMiddleware.requireAuth, userRateLimit, (req, res) => {
  res.json({
    success: true,
    message: 'Protected route working!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;