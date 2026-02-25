// --- BAGIAN IMPORT ---
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

// Import Passport dan Strategi Google
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Import email service
const emailService = require('./emailService');

// Import logger
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// ✅ SECURITY: Fail fast if JWT_SECRET is not set in production
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production!');
  } else {
    logger.warn('[AUTH SERVICE] JWT_SECRET not set. Using insecure default for development only.');
  }
}

// ========================================================
// ✅ BARU: FUNGSI VERIFIKASI EMAIL
// ========================================================

/**
 * Generate verification code (6 digit angka)
 */
const generateVerificationCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Send verification email
 */
const sendVerificationEmail = async (email, verificationCode) => {
  try {
    const subject = 'Kode Verifikasi Email - Sapa-Tazkia';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Verifikasi Email Anda</h2>
        <p>Terima kasih telah mendaftar di Sapa-Tazkia. Gunakan kode verifikasi berikut untuk menyelesaikan pendaftaran:</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #2563eb; font-size: 32px; letter-spacing: 5px; margin: 0;">
            ${verificationCode}
          </h1>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          Kode ini akan kadaluarsa dalam 10 menit. Jangan berikan kode ini kepada siapapun.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          Jika Anda tidak merasa mendaftar, abaikan email ini.
        </p>
      </div>
    `;

    await emailService.sendEmail(email, subject, html);
    console.log('✅ [AUTH SERVICE] Verification email sent to:', email);

    return true;
  } catch (error) {
    console.error('❌ [AUTH SERVICE] Failed to send verification email:', error);
    throw new Error('Gagal mengirim email verifikasi');
  }
};

/**
 * Verify email with code
 */
const verifyEmailCode = async (email, code) => {
  try {
    console.log('🔍 [AUTH SERVICE] Verifying email code:', { email, code });

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('User tidak ditemukan');
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      console.log('✅ [AUTH SERVICE] Email already verified, returning user data');
      return {
        success: true,
        message: 'Email sudah terverifikasi',
        user: user,
        requiresProfileCompletion: !user.isProfileComplete || !user.fullName || user.fullName.trim() === ''
      };
    }

    // Check verification code
    if (!user.verificationCode || user.verificationCode !== code) {
      // Increment verification attempts
      await prisma.user.update({
        where: { email },
        data: {
          verificationAttempts: { increment: 1 }
        }
      });

      throw new Error('Kode verifikasi tidak valid');
    }

    // Check if code is expired
    if (user.verificationCodeExpires && new Date() > user.verificationCodeExpires) {
      throw new Error('Kode verifikasi sudah kadaluarsa');
    }

    // Check max attempts
    if (user.verificationAttempts >= 5) {
      throw new Error('Terlalu banyak percobaan. Silakan request kode baru.');
    }

    // ✅ PERBAIKAN: Update user as verified - TAPI JANGAN set profile complete untuk new user
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        isEmailVerified: true,
        verificationCode: null, // Clear the code
        verificationCodeExpires: null,
        verificationAttempts: 0,
        status: 'active'
        // ✅ JANGAN set isProfileComplete: true di sini!
        // Biarkan false agar user diarahkan ke AboutYouPage
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        nim: true,
        status: true,
        authMethod: true,
        userType: true,
        isProfileComplete: true,  // Ini akan false untuk new user
        isEmailVerified: true
      }
    });

    console.log('✅ [AUTH SERVICE] Email verified successfully:', {
      email: updatedUser.email,
      isProfileComplete: updatedUser.isProfileComplete,
      fullName: updatedUser.fullName
    });

    // Generate token for the verified user
    const token = generateToken(updatedUser.id);

    // Create session
    await createSession(updatedUser.id, token, 'email-verification', 'email-verification');

    // ✅ PERBAIKAN: Return requiresProfileCompletion yang benar
    const requiresProfileCompletion = !updatedUser.isProfileComplete ||
      !updatedUser.fullName ||
      updatedUser.fullName.trim() === '';

    return {
      success: true,
      message: 'Email berhasil diverifikasi',
      user: updatedUser,
      token: token,
      requiresProfileCompletion: requiresProfileCompletion
    };

  } catch (error) {
    console.error('❌ [AUTH SERVICE] Verify email code error:', error);
    throw error;
  }
};

/**
 * Resend verification code
 */
const resendVerificationCode = async (email) => {
  try {
    console.log('🔍 [AUTH SERVICE] Resending verification code to:', email);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('User tidak ditemukan');
    }

    if (user.isEmailVerified) {
      throw new Error('Email sudah terverifikasi');
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user with new verification code
    await prisma.user.update({
      where: { email },
      data: {
        verificationCode: verificationCode,
        verificationCodeExpires: expirationTime,
        verificationAttempts: 0
      }
    });

    // Send verification email
    await sendVerificationEmail(email, verificationCode);

    console.log('✅ [AUTH SERVICE] Verification code resent to:', email);

    return {
      success: true,
      message: 'Kode verifikasi baru telah dikirim ke email Anda'
    };

  } catch (error) {
    console.error('❌ [AUTH SERVICE] Resend verification code error:', error);
    throw error;
  }
};

// ========================================================
// ✅ HELPER: Generate Unique NIM dengan retry mechanism
// ========================================================

/**
 * Generate unique NIM with retry mechanism
 * @param {string} prefix - Prefix for NIM (e.g., 'E' for external users, 'S' for student fallback)
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<string>} - Unique NIM
 */
const generateUniqueNIM = async (prefix = 'E', maxRetries = 10) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Generate random 8-digit number
    const randomPart = Math.floor(10000000 + Math.random() * 90000000).toString();
    const candidateNIM = `${prefix}${randomPart}`;

    // Check if NIM already exists
    const existingUser = await prisma.user.findUnique({
      where: { nim: candidateNIM }
    });

    if (!existingUser) {
      console.log(`[AUTH SERVICE] Generated unique NIM: ${candidateNIM} (attempt ${attempt + 1})`);
      return candidateNIM;
    }

    console.log(`[AUTH SERVICE] NIM collision detected: ${candidateNIM}, retrying...`);
  }

  // Fallback: Use timestamp-based NIM to guarantee uniqueness
  const timestampNIM = `${prefix}${Date.now().toString().slice(-8)}`;
  console.log(`[AUTH SERVICE] Fallback timestamp NIM: ${timestampNIM}`);
  return timestampNIM;
};

// ========================================================
// ✅ PERBAIKAN BESAR: FUNGSI FIND OR CREATE USER BY EMAIL - SEMUA USER BUTUH VERIFIKASI
// ========================================================

const findOrCreateUserByEmail = async (email, googleData = null) => {
  try {
    console.log('[AUTH SERVICE] Find or create user by email:', email);

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (user) {
      console.log('[AUTH SERVICE] User found:', user.nim);
      return { user, isNewUser: false };
    }

    // EXTRACT NIM FROM EMAIL IF STUDENT EMAIL
    let nim = null;
    let userType = 'regular';
    let fullName = '';

    if (email.includes('@student.tazkia.ac.id') || email.includes('@student.stmik.tazkia.ac.id')) {
      // Extract NIM from student email: 102834567812.gab@student.tazkia.ac.id
      const nimMatch = email.match(/^(\d+)\./);
      if (nimMatch && nimMatch[1]) {
        nim = nimMatch[1];
        userType = 'student';
        fullName = ''; // Will be filled in AboutYouPage
        console.log('[AUTH SERVICE] Student detected, NIM:', nim);

        // CHECK: Apakah NIM student ini sudah ada di database?
        const existingNimUser = await prisma.user.findUnique({
          where: { nim: nim }
        });

        if (existingNimUser) {
          // NIM sudah ada tapi dengan email berbeda
          console.log('[AUTH SERVICE] Student NIM already exists with different email:', {
            existingEmail: existingNimUser.email,
            newEmail: email
          });

          // Generate fallback NIM dengan prefix 'S' untuk student
          nim = await generateUniqueNIM('S');
          console.log('[AUTH SERVICE] Using fallback NIM for student:', nim);
        }
      }
    }

    // If not student email or NIM not extracted, generate UNIQUE random NIM
    if (!nim) {
      nim = await generateUniqueNIM('E');
      fullName = googleData?.name || '';
      console.log('[AUTH SERVICE] Regular user, generated unique NIM:', nim);
    }

    // Use Google data if available
    if (googleData?.name && !fullName) {
      fullName = googleData.name;
    }

    // Generate verification code untuk SEMUA new users (termasuk Google)
    const verificationCode = generateVerificationCode();
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Untuk new user, set isProfileComplete ke false
    const isProfileComplete = !!(googleData?.name && googleData.name.trim() !== '');

    // SEMUA new user (termasuk Google) harus through verification
    const userData = {
      nim: nim,
      email: email,
      fullName: fullName,
      authMethod: googleData ? 'google' : 'email',
      userType: userType,
      isProfileComplete: isProfileComplete,
      status: 'pending',
      isEmailVerified: false,
      verificationCode: verificationCode,
      verificationCodeExpires: expirationTime,
      verificationAttempts: 0
    };

    // FIX: Wrap CREATE dengan try-catch untuk handle race condition
    try {
      user = await prisma.user.create({
        data: userData
      });
    } catch (createError) {
      // Handle race condition: jika NIM collision terjadi, regenerate dan retry
      if (createError.code === 'P2002' && createError.meta?.target?.includes('nim')) {
        console.log('[AUTH SERVICE] Race condition detected, regenerating NIM...');
        userData.nim = await generateUniqueNIM('E');
        user = await prisma.user.create({
          data: userData
        });
      } else {
        throw createError;
      }
    }

    console.log('[AUTH SERVICE] New user created:', {
      email: user.email,
      nim: user.nim,
      type: userType,
      isProfileComplete: user.isProfileComplete,
      isEmailVerified: user.isEmailVerified,
      hasVerificationCode: !!user.verificationCode
    });

    // ✅ ✅ ✅ PERBAIKAN: Kirim verification email untuk SEMUA new users (termasuk Google)
    await sendVerificationEmail(email, verificationCode);
    console.log('✅ [AUTH SERVICE] Verification email sent for Google OAuth user:', email);

    return { user, isNewUser: true };

  } catch (error) {
    console.error('❌ [AUTH SERVICE] Find or create user error:', error);
    throw error;
  }
};

// ========================================================
// ✅ BARU: FUNGSI REGISTER WITH EMAIL ONLY - DIPERBAIKI DENGAN VERIFIKASI
// ========================================================

const registerWithEmail = async (email) => {
  try {
    console.log('🔍 [AUTH SERVICE] Register with email:', email);

    if (!email) {
      throw new Error('Email is required');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // EXTRACT NIM FROM EMAIL IF STUDENT EMAIL
    let nim = null;
    let userType = 'regular';

    if (email.includes('@student.tazkia.ac.id') || email.includes('@student.stmik.tazkia.ac.id')) {
      // Extract NIM from student email: 102834567812.gab@student.tazkia.ac.id
      const nimMatch = email.match(/^(\d+)\./);
      if (nimMatch && nimMatch[1]) {
        nim = nimMatch[1];
        userType = 'student';
        console.log('🎓 [AUTH SERVICE] Student detected, NIM:', nim);
      }
    }

    // If not student email, generate random NIM
    if (!nim) {
      nim = 'E' + Math.floor(10000000 + Math.random() * 90000000).toString();
      console.log('👤 [AUTH SERVICE] Regular user, generated NIM:', nim);
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // ✅ PERBAIKAN: Create new user dengan isProfileComplete: false
    const newUser = await prisma.user.create({
      data: {
        nim: nim,
        email: email,
        fullName: '', // Kosong, akan diisi di AboutYouPage
        authMethod: 'email',
        userType: userType,
        isProfileComplete: false, // ✅ FALSE agar user diarahkan ke AboutYouPage
        status: 'pending', // Pending until email verified
        isEmailVerified: false,
        verificationCode: verificationCode,
        verificationCodeExpires: expirationTime,
        verificationAttempts: 0
      }
    });

    console.log('✅ [AUTH SERVICE] User created with email:', {
      email: newUser.email,
      nim: newUser.nim,
      type: userType,
      isProfileComplete: newUser.isProfileComplete // Harus false
    });

    // Send verification email
    await sendVerificationEmail(email, verificationCode);

    return {
      success: true,
      message: 'Kode verifikasi telah dikirim ke email Anda. Silakan verifikasi email untuk melanjutkan.',
      data: {
        email: newUser.email,
        requiresVerification: true
      }
    };

  } catch (error) {
    console.error('❌ [AUTH SERVICE] Register with email error:', error);
    throw error;
  }
};

// ========================================================
// KONFIGURASI PASSPORT (GOOGLE STRATEGY) - DIPERBAIKI DENGAN FUNGSI BARU
// ========================================================

// HANYA JALANKAN JIKA ADA GOOGLE CLIENT ID
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log(`[DEBUG] Google OAuth triggered for:`, {
            email: profile.emails?.[0]?.value || 'No email',
            id: profile.id,
            name: profile.displayName
          });

          // Validasi profile memiliki email
          if (!profile.emails || profile.emails.length === 0) {
            console.error('[ERROR] No email found in Google profile');
            return done(new Error('No email found in Google profile'), false);
          }

          const userEmail = profile.emails[0].value;

          // ✅ PERBAIKAN: Gunakan fungsi findOrCreateUserByEmail yang sudah diperbaiki
          const { user, isNewUser } = await findOrCreateUserByEmail(userEmail, {
            name: profile.displayName,
            picture: profile.photos?.[0]?.value
          });

          console.log(`[DEBUG] Google OAuth result:`, {
            email: userEmail,
            isNewUser: isNewUser,
            nim: user.nim,
            isProfileComplete: user.isProfileComplete,
            isEmailVerified: user.isEmailVerified, // Harus false
            hasVerificationCode: !!user.verificationCode // Harus true
          });

          return done(null, user);

        } catch (error) {
          console.error(`[ERROR] Google Strategy error:`, error);
          return done(error, false);
        }
      }
    )
  );

  // SERIALIZE & DESERIALIZE USER - DIPERBAIKI
  passport.serializeUser((user, done) => {
    console.log(`[DEBUG] Serializing user:`, user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      console.log(`[DEBUG] Deserializing user:`, id);

      const user = await prisma.user.findUnique({
        where: { id: id },
        select: {
          id: true,
          email: true,
          fullName: true,
          nim: true,
          googleId: true,
          status: true,
          authMethod: true,
          userType: true,
          isProfileComplete: true,
          isEmailVerified: true,
          passwordHash: true,
          phone: true,
          programStudiId: true,
          angkatan: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true
        }
      });

      if (!user) {
        console.error(`[ERROR] User not found during deserialization:`, id);
        return done(new Error('User not found'), null);
      }

      console.log(`[DEBUG] User deserialized:`, user.email);
      done(null, user);
    } catch (error) {
      console.error('[ERROR] Deserialize user error:', error);
      done(error, null);
    }
  });

  console.log('[DEBUG] Google OAuth strategy configured successfully');
} else {
  console.log('[WARNING] Google OAuth credentials not found. Google login will be disabled.');
}

// ========================================================
// FUNGSI TOKEN - SECURE
// ========================================================

/**
 * Generate short-lived access token (default: 1d via JWT_EXPIRES_IN env)
 */
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    { id: userId, type: 'access' },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

/**
 * Generate long-lived refresh token (default: 30d via JWT_REFRESH_EXPIRES_IN env)
 */
const generateRefreshToken = (userId) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
  return jwt.sign(
    { id: userId, type: 'refresh' },
    secret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

const verifyToken = (token) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    return jwt.verify(token, secret);
  } catch (error) {
    logger.debug('[AUTH SERVICE] Token verification failed: ' + error.message);
    return null;
  }
};

const verifyRefreshToken = (token) => {
  try {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
    return jwt.verify(token, secret);
  } catch (error) {
    logger.debug('[AUTH SERVICE] Refresh token verification failed: ' + error.message);
    return null;
  }
};

// ========================================================
// FUNGSI SESSION MANAGEMENT - DIPERBAIKI
// ========================================================
const createSession = async (userId, token, ipAddress, userAgent) => {
  try {
    // PERBAIKAN: Hapus session lama untuk user ini terlebih dahulu
    await prisma.session.deleteMany({
      where: {
        userId: userId,
        expiresAt: { lt: new Date() } // Hapus yang sudah expired
      }
    });

    // Session expiry matches JWT refresh token expiry (30d by default)
    const sessionExpiryMs = 30 * 24 * 60 * 60 * 1000;
    const session = await prisma.session.create({
      data: {
        userId: userId,
        token,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        expiresAt: new Date(Date.now() + sessionExpiryMs),
      },
    });

    logger.debug(`[AUTH SERVICE] Session created for user: ${userId}`);
    return session;
  } catch (error) {
    logger.error('[AUTH SERVICE] Error creating session: ' + error.message);
    throw error;
  }
};

const logoutAllUserSessions = async (userId) => {
  try {
    const result = await prisma.session.deleteMany({
      where: { userId: userId },
    });

    console.log(`[DEBUG] Logged out ${result.count} sessions for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('[ERROR] Error logging out all sessions:', error);
    throw error;
  }
};

// ========================================================
// FUNGSI VERIFY SESSION - DIPERBAIKI
// ========================================================
const verifySession = async (token) => {
  try {
    console.log(`[DEBUG] Verifying session token`);

    // Verifikasi token JWT dasar dulu
    const decoded = verifyToken(token);
    if (!decoded) {
      return { valid: false, message: 'Token tidak valid' };
    }

    // Cek di session database
    const session = await prisma.session.findFirst({
      where: {
        token: token,
        expiresAt: { gt: new Date() },
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            nim: true,
            status: true,
            authMethod: true,
            userType: true,
            isProfileComplete: true,
            isEmailVerified: true,
            passwordHash: true,
            phone: true,
            programStudiId: true,
            angkatan: true
          }
        }
      }
    });

    if (!session) {
      return { valid: false, message: 'Session tidak ditemukan atau sudah kadaluarsa' };
    }

    // Update last activity
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivity: new Date() }
    });

    return {
      valid: true,
      user: session.user
    };
  } catch (error) {
    console.error('[ERROR] Verify session error:', error);
    return { valid: false, message: 'Terjadi kesalahan saat verifikasi session' };
  }
};

// ========================================================
// ✅ BARU: FUNGSI VERIFICATION MANAGEMENT - DIPERBAIKI
// ========================================================

/**
 * Update user verification status
 */
const updateUserVerification = async (userId, verificationData) => {
  try {
    console.log('🔍 [AUTH SERVICE] Updating user verification:', { userId, verificationData });

    const updateData = {
      nim: verificationData.nim,
      fullName: verificationData.fullName
    };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        nim: true,
        status: true,
        authMethod: true,
        userType: true,
        isProfileComplete: true,
        isEmailVerified: true
      }
    });

    console.log('✅ [AUTH SERVICE] User verification updated:', updatedUser);
    return updatedUser;

  } catch (error) {
    console.error('❌ [AUTH SERVICE] Update user verification error:', error);
    throw new Error('Gagal memperbarui status verifikasi user');
  }
};

/**
 * Update user profile
 */
const updateUserProfile = async (userId, profileData) => {
  try {
    console.log('🔍 [AUTH SERVICE] Updating user profile:', { userId, profileData });

    const updateData = {
      email: profileData.email,
      nim: profileData.nim,
      fullName: profileData.fullName,
      isProfileComplete: true // Mark as complete after profile update
    };

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        nim: true,
        status: true,
        authMethod: true,
        userType: true,
        isProfileComplete: true,
        isEmailVerified: true
      }
    });

    console.log('✅ [AUTH SERVICE] User profile updated:', updatedUser);
    return updatedUser;

  } catch (error) {
    console.error('❌ [AUTH SERVICE] Update user profile error:', error);
    throw new Error('Gagal memperbarui profile user');
  }
};

// ========================================================
// FUNGSI LOGIN & REGISTER - DIPERBAIKI DENGAN VALIDASI KETAT
// ========================================================

// PERBAIKAN: Tambahkan fungsi untuk check NIM availability
const checkNIMAvailability = async (nim) => {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { nim: nim }
    });

    if (existingUser) {
      return {
        available: false,
        message: 'NIM sudah terdaftar'
      };
    }

    return {
      available: true,
      message: 'NIM tersedia'
    };
  } catch (error) {
    console.error('[ERROR] Check NIM availability error:', error);
    return {
      available: false,
      message: 'Terjadi kesalahan saat mengecek NIM'
    };
  }
};

const register = async (userData) => {
  try {
    const { fullName, nim, email, password } = userData;

    console.log(`[DEBUG] Registration attempt for:`, { fullName, nim, email });

    // Validasi input
    if (!fullName || !nim || !email || !password) {
      return { success: false, message: 'Semua field harus diisi' };
    }

    // Validasi format
    if (fullName.trim().length < 2) {
      return { success: false, message: 'Nama lengkap harus minimal 2 karakter' };
    }

    if (nim.trim().length < 3) {
      return { success: false, message: 'Format NIM tidak valid' };
    }

    if (password.length < 6) {
      return { success: false, message: 'Password harus minimal 6 karakter' };
    }

    // Cek apakah email sudah ada
    const emailExists = await prisma.user.findUnique({
      where: { email: email.trim() }
    });

    if (emailExists) {
      return { success: false, message: 'User sudah terdaftar dengan email ini' };
    }

    // Cek apakah NIM sudah ada
    const nimExists = await prisma.user.findUnique({
      where: { nim: nim.trim() }
    });

    if (nimExists) {
      return { success: false, message: 'User sudah terdaftar dengan NIM ini' };
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate verification code for email verification
    const verificationCode = generateVerificationCode();
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Buat user baru dengan status pending
    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        nim: nim.trim(),
        email: email.trim(),
        passwordHash: hashedPassword,
        authMethod: 'nim',
        userType: 'student',
        isProfileComplete: true, // Complete profile for NIM registration
        status: 'pending', // Pending until email verified
        isEmailVerified: false,
        verificationCode: verificationCode,
        verificationCodeExpires: expirationTime,
        verificationAttempts: 0
      },
    });

    console.log(`[DEBUG] User registered successfully:`, {
      id: user.id,
      email: user.email,
      nim: user.nim
    });

    // Send verification email
    await sendVerificationEmail(email, verificationCode);

    return {
      success: true,
      message: 'Registrasi berhasil. Kode verifikasi telah dikirim ke email Anda.',
      requiresVerification: true,
      data: {
        email: user.email
      }
    };
  } catch (error) {
    console.error('[ERROR] Register service error:', error);
    return {
      success: false,
      message: error.message || 'Database error'
    };
  }
};

// PERBAIKAN: Login function dengan validasi yang lebih ketat
const login = async (identifier, password, ipAddress, userAgent) => {
  try {
    console.log(`[DEBUG] Login attempt for identifier: ${identifier}`);

    // Validasi input
    if (!identifier || !password) {
      return {
        success: false,
        message: 'Email/NIM dan password harus diisi',
      };
    }

    // Tentukan apakah identifier adalah email atau NIM
    const isEmail = identifier.includes('@');
    let user;

    if (isEmail) {
      // ✅ PERBAIKAN: Login dengan email
      console.log(`[DEBUG] Attempting email login for: ${identifier}`);

      user = await prisma.user.findUnique({
        where: {
          email: identifier.trim()
        },
      });

      if (!user) {
        console.log(`[DEBUG] User not found for email: ${identifier}`);
        return {
          success: false,
          message: 'Email atau password salah',
        };
      }
    } else {
      // Login dengan NIM (existing logic)
      user = await prisma.user.findUnique({
        where: {
          nim: identifier.trim()
        },
      });

      if (!user) {
        console.log(`[DEBUG] User not found for NIM: ${identifier}`);
        return {
          success: false,
          message: 'NIM atau password salah',
        };
      }
    }

    // Cek status user
    if (user.status !== 'active') {
      if (user.status === 'pending') {
        return {
          success: false,
          message: 'Email belum diverifikasi. Silakan cek email Anda untuk kode verifikasi.',
          requiresVerification: true,
          email: user.email
        };
      }

      console.log(`[DEBUG] User ${identifier} is not active`);
      return {
        success: false,
        message: 'Akun tidak aktif. Silakan hubungi administrator.',
      };
    }

    // ✅ PERBAIKAN: Handle user tanpa password (email-only users)
    if (!user.passwordHash) {
      // Untuk user tanpa password, gunakan NIM sebagai password sementara
      const extractedNim = user.nim || identifier.split('@')[0].split('.')[0];
      if (password === extractedNim) {
        // Password match dengan NIM, lanjutkan login
        console.log(`[DEBUG] Email-only user authenticated with NIM`);
      } else {
        console.log(`[DEBUG] Invalid password for email-only user: ${user.email}`);
        return {
          success: false,
          message: 'Email atau password salah',
        };
      }
    } else {
      // User dengan password, verifikasi normal
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        console.log(`[DEBUG] Invalid password for user: ${user.email}`);
        return {
          success: false,
          message: 'Email/NIM atau password salah',
        };
      }
    }

    // Login berhasil
    const token = generateToken(user.id);

    // Hapus session lama dan buat session baru
    await logoutAllUserSessions(user.id);
    await createSession(user.id, token, ipAddress, userAgent);

    console.log(`[DEBUG] Login successful for user:`, {
      id: user.id,
      email: user.email,
      nim: user.nim,
      hasPassword: !!user.passwordHash
    });

    return {
      success: true,
      message: 'Login berhasil',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        nim: user.nim,
        status: user.status,
        authMethod: user.authMethod,
        userType: user.userType,
        isProfileComplete: user.isProfileComplete,
        isEmailVerified: user.isEmailVerified
      },
    };

  } catch (error) {
    console.error('[ERROR] Login service error:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan sistem. Silakan coba lagi.',
    };
  }
};

const logout = async (token) => {
  try {
    await prisma.session.deleteMany({
      where: { token: token },
    });

    console.log(`[DEBUG] Logout successful for token`);

    return {
      success: true,
      message: 'Logout berhasil',
    };
  } catch (error) {
    console.error('[ERROR] Logout service error:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan saat logout',
    };
  }
};

// ========================================================
// FUNGSI TAMBAHAN
// ========================================================
const getUserById = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        nim: true,
        googleId: true,
        status: true,
        authMethod: true,
        userType: true,
        isProfileComplete: true,
        isEmailVerified: true,
        createdAt: true
      }
    });

    return user;
  } catch (error) {
    console.error('[ERROR] Get user by ID error:', error);
    return null;
  }
};

// ========================================================
// EXPORTS
// ========================================================
module.exports = {
  register,
  login,
  logout,
  verifySession,
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  getUserById,
  createSession,
  logoutAllUserSessions,
  checkNIMAvailability,
  updateUserVerification,
  updateUserProfile,
  findOrCreateUserByEmail,
  registerWithEmail,
  generateVerificationCode,
  sendVerificationEmail,
  verifyEmailCode,
  resendVerificationCode,
  passport,
};