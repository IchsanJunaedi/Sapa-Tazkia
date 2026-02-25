// backend/src/middleware/validationMiddleware.js
// Input validation using express-validator

const { body, param, validationResult } = require('express-validator');

/**
 * Centralized handler — returns 422 with structured errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false,
            message: 'Input tidak valid',
            errors: errors.array().map(e => ({
                field: e.path,
                message: e.msg
            }))
        });
    }
    next();
};

// ============================================================
// AUTH VALIDATIONS
// ============================================================

/**
 * POST /api/auth/register — NIM + email + password
 */
const validateRegister = [
    body('fullName')
        .trim()
        .notEmpty().withMessage('Nama lengkap wajib diisi')
        .isLength({ min: 2, max: 100 }).withMessage('Nama lengkap harus antara 2-100 karakter'),
    body('nim')
        .trim()
        .notEmpty().withMessage('NIM wajib diisi')
        .isLength({ min: 3, max: 20 }).withMessage('NIM harus antara 3-20 karakter'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email wajib diisi')
        .isEmail().withMessage('Format email tidak valid')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password wajib diisi')
        .isLength({ min: 8 }).withMessage('Password minimal 8 karakter')
        .matches(/[A-Za-z]/).withMessage('Password harus mengandung huruf')
        .matches(/[0-9]/).withMessage('Password harus mengandung angka'),
    handleValidationErrors
];

/**
 * POST /api/auth/register-email — email only (Google OAuth flow)
 */
const validateRegisterEmail = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email wajib diisi')
        .isEmail().withMessage('Format email tidak valid')
        .normalizeEmail(),
    handleValidationErrors
];

/**
 * POST /api/auth/login
 */
const validateLogin = [
    body('nim')
        .optional()
        .trim()
        .notEmpty().withMessage('NIM tidak boleh kosong'),
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Format email tidak valid')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password wajib diisi'),
    handleValidationErrors
];

/**
 * POST /api/auth/verify-email
 */
const validateVerifyEmail = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email wajib diisi')
        .isEmail().withMessage('Format email tidak valid')
        .normalizeEmail(),
    body('code')
        .trim()
        .notEmpty().withMessage('Kode verifikasi wajib diisi')
        .isLength({ min: 6, max: 6 }).withMessage('Kode verifikasi harus 6 digit')
        .isNumeric().withMessage('Kode verifikasi harus berupa angka'),
    handleValidationErrors
];

/**
 * POST /api/auth/refresh
 */
const validateRefreshToken = [
    body('refreshToken')
        .notEmpty().withMessage('Refresh token wajib diisi'),
    handleValidationErrors
];

// ============================================================
// CHAT / AI VALIDATIONS
// ============================================================

/**
 * POST /api/ai/chat — user chat message
 */
const validateChatMessage = [
    body('message')
        .trim()
        .notEmpty().withMessage('Pesan tidak boleh kosong')
        .isLength({ max: 2000 }).withMessage('Pesan terlalu panjang (maksimal 2000 karakter)'),
    body('conversationId')
        .optional()
        .isInt({ min: 1 }).withMessage('conversationId harus berupa angka positif'),
    handleValidationErrors
];

/**
 * POST /api/guest/chat — guest chat message
 */
const validateGuestChatMessage = [
    body('message')
        .trim()
        .notEmpty().withMessage('Pesan tidak boleh kosong')
        .isLength({ max: 1000 }).withMessage('Pesan terlalu panjang (maksimal 1000 karakter)'),
    body('sessionId')
        .optional()
        .isString().withMessage('sessionId harus berupa string'),
    handleValidationErrors
];

/**
 * GET /api/auth/check-nim/:nim
 */
const validateNimParam = [
    param('nim')
        .trim()
        .notEmpty().withMessage('NIM wajib diisi')
        .isLength({ min: 3, max: 20 }).withMessage('Format NIM tidak valid'),
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    validateRegister,
    validateRegisterEmail,
    validateLogin,
    validateVerifyEmail,
    validateRefreshToken,
    validateChatMessage,
    validateGuestChatMessage,
    validateNimParam
};
