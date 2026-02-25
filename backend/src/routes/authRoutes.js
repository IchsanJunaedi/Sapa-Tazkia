const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Import Controller & Middleware Auth
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const {
  validateRegister,
  validateRegisterEmail,
  validateLogin,
  validateVerifyEmail,
  validateRefreshToken,
  validateNimParam
} = require('../middleware/validationMiddleware');

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
// Untuk cek sesi, cek profil, logout, DAN CHAT.
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
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login dengan NIM + password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login berhasil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Kredensial tidak valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', strictLimiter, validateLogin, authController.login);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrasi akun baru (NIM + email + password)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, nim, email, password]
 *             properties:
 *               fullName: { type: string, example: 'Budi Santoso' }
 *               nim: { type: string, example: '20230001' }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201:
 *         description: Registrasi berhasil, kode OTP dikirim ke email
 *       422:
 *         description: Validasi gagal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', strictLimiter, validateRegister, authController.register);

/**
 * @swagger
 * /api/auth/register-email:
 *   post:
 *     tags: [Auth]
 *     summary: Registrasi via email (untuk Google OAuth flow)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Kode OTP dikirim ke email
 */
router.post('/register-email', strictLimiter, validateRegisterEmail, authController.registerWithEmail);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token menggunakan refresh token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string, description: 'Refresh token dari login' }
 *     responses:
 *       200:
 *         description: Access token baru berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 token: { type: string, description: 'JWT access token baru (valid 1 day)' }
 *       401:
 *         description: Refresh token tidak valid atau expired
 */
router.post('/refresh', strictLimiter, validateRefreshToken, authController.refreshToken);

// ========================================================
// ✅ EMAIL VERIFICATION ROUTES (HIGH RISK)
// ========================================================

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Verifikasi email dengan kode OTP 6 digit
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string, minLength: 6, maxLength: 6, example: '123456' }
 *     responses:
 *       200:
 *         description: Email berhasil diverifikasi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Kode tidak valid atau expired
 */
router.post('/verify-email', strictLimiter, validateVerifyEmail, authController.verifyEmailCode);

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

// ✅ ✅ ✅ NEW: CHAT ENDPOINT (DITAMBAHKAN DI SINI)
// Menggunakan generalLimiter agar aman tapi tidak seketat login
router.post('/chat', authMiddleware.requireAuth, generalLimiter, authController.chat);

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