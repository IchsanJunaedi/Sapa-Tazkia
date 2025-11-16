const express = require('express');
const router = express.Router();

// Import controller dan middleware
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// ========================================================
// PUBLIC ROUTES
// ========================================================

/**
 * @route   GET /api/auth/test
 * @desc    Test route untuk check auth routes working
 * @access  Public
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
 * @desc    Health check untuk auth controller
 * @access  Public
 */
router.get('/health', authController.healthCheck);

/**
 * @route   GET /api/auth/check-session
 * @desc    Check session status (untuk debugging)
 * @access  Public
 */
router.get('/check-session', authController.checkAuth);

/**
 * @route   GET /api/auth/google
 * @desc    Mulai proses otentikasi Google
 * @access  Public
 */
router.get('/google', authController.googleAuth);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Callback setelah login Google berhasil
 * @access  Public
 */
router.get('/google/callback', 
  authController.googleCallback,
  authController.googleCallbackSuccess
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user dengan NIM dan password
 * @access  Public
 */
router.post('/login', 
  // Tambahkan validation middleware jika ada
  authController.login
);

/**
 * @route   POST /api/auth/register
 * @desc    Registrasi user baru dengan validasi
 * @access  Public
 */
router.post('/register', 
  // Tambahkan validation middleware jika ada  
  authController.register
);

/**
 * @route   POST /api/auth/register-email
 * @desc    Registrasi user dengan email saja (auto-create user)
 * @access  Public
 */
router.post('/register-email', authController.registerWithEmail);

/**
 * @route   GET /api/auth/check-nim/:nim
 * @desc    Check apakah NIM sudah terdaftar
 * @access  Public
 */
router.get('/check-nim/:nim', authController.checkNIM);

// ========================================================
// PROTECTED ROUTES (memerlukan token)
// ========================================================

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authMiddleware.requireAuth, authController.logout);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify token dan get user data
 * @access  Private
 */
router.get('/verify', authMiddleware.requireAuth, authController.verify);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authMiddleware.requireAuth, authController.getProfile);

// ========================================================
// VERIFICATION ROUTES
// ========================================================

/**
 * @route   POST /api/auth/verify-student
 * @desc    Verify student data dengan academic system
 * @access  Private
 */
router.post('/verify-student', authMiddleware.requireAuth, authController.verifyStudent);

/**
 * @route   PATCH /api/auth/update-verification
 * @desc    Update user verification status
 * @access  Private
 */
router.patch('/update-verification', authMiddleware.requireAuth, authController.updateVerification);

/**
 * @route   PATCH /api/auth/update-profile
 * @desc    Update user profile (untuk Google OAuth)
 * @access  Private
 */
router.patch('/update-profile', authMiddleware.requireAuth, authController.updateProfile);

// ========================================================
// TEST ROUTES
// ========================================================

/**
 * @route   GET /api/auth/protected-test
 * @desc    Test route untuk protected routes
 * @access  Private
 */
router.get('/protected-test', authMiddleware.requireAuth, (req, res) => {
  res.json({
    success: true,
    message: 'Protected route working!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;