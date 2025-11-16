// --- BAGIAN IMPORT ---
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import Passport dan Strategi Google
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const prisma = new PrismaClient();

// ========================================================
// ✅ BARU: FUNGSI FIND OR CREATE USER BY EMAIL
// ========================================================

const findOrCreateUserByEmail = async (email, googleData = null) => {
  try {
    console.log('🔍 [AUTH SERVICE] Find or create user by email:', email);

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email }
    });

    if (user) {
      console.log('✅ [AUTH SERVICE] User found:', user.nim);
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
        console.log('🎓 [AUTH SERVICE] Student detected, NIM:', nim);
      }
    }

    // If not student email or NIM not extracted, generate random NIM
    if (!nim) {
      nim = 'E' + Math.floor(10000000 + Math.random() * 90000000).toString();
      fullName = googleData?.name || '';
      console.log('👤 [AUTH SERVICE] Regular user, generated NIM:', nim);
    }

    // Use Google data if available
    if (googleData?.name && !fullName) {
      fullName = googleData.name;
    }

    // Create user data
    const userData = {
      nim: nim,
      email: email,
      fullName: fullName,
      authMethod: googleData ? 'google' : 'email',
      userType: userType,
      isProfileComplete: !!fullName, // If name is provided, consider profile complete
      status: 'active'
    };

    user = await prisma.user.create({
      data: userData
    });

    console.log('✅ [AUTH SERVICE] New user created:', { 
      email: user.email, 
      nim: user.nim, 
      type: userType,
      isNewUser: true 
    });

    return { user, isNewUser: true };

  } catch (error) {
    console.error('❌ [AUTH SERVICE] Find or create user error:', error);
    throw error;
  }
};


// ========================================================
// ✅ BARU: FUNGSI REGISTER WITH EMAIL ONLY
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

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        nim: nim,
        email: email,
        fullName: '', // Will be filled in AboutYouPage
        authMethod: 'email',
        userType: userType,
        isProfileComplete: false,
        status: 'active'
      }
    });

    console.log('✅ [AUTH SERVICE] User created with email:', { 
      email: newUser.email, 
      nim: newUser.nim, 
      type: userType 
    });

    // Generate token
    const token = jwt.sign(
      { 
        userId: newUser.id,
        nim: newUser.nim,
        email: newUser.email,
        isProfileComplete: newUser.isProfileComplete,
        userType: userType
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    // Create session
    await createSession(newUser.id, token, 'email-registration', 'email-registration');

    return {
      success: true,
      message: userType === 'student' 
        ? 'Registrasi berhasil. Silakan lengkapi profil Anda.' 
        : 'Registration successful. Please complete your profile.',
      data: {
        user: {
          id: newUser.id,
          nim: newUser.nim,
          email: newUser.email,
          fullName: newUser.fullName,
          isProfileComplete: newUser.isProfileComplete,
          userType: userType,
          authMethod: newUser.authMethod
        },
        token: token,
        requiresProfileCompletion: true
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
          
          // ✅ PERBAIKAN: Gunakan fungsi findOrCreateUserByEmail yang baru
          const { user, isNewUser } = await findOrCreateUserByEmail(userEmail, {
            name: profile.displayName,
            picture: profile.photos?.[0]?.value
          });

          console.log(`[DEBUG] Google OAuth result:`, {
            email: userEmail,
            isNewUser: isNewUser,
            nim: user.nim
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
// FUNGSI TOKEN
// ========================================================
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn: '30d',
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
  } catch (error) {
    console.error('[ERROR] Token verification failed:', error);
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

    const session = await prisma.session.create({
      data: {
        userId: userId,
        token,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 hari
      },
    });
    
    console.log(`[DEBUG] Session created for user: ${userId}`);
    return session;
  } catch (error) {
    console.error('[ERROR] Error creating session:', error);
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
        isProfileComplete: true
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
        isProfileComplete: true
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

    // Buat user baru
    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        nim: nim.trim(),
        email: email.trim(),
        passwordHash: hashedPassword,
        authMethod: 'nim',
        userType: 'student',
        isProfileComplete: true, // Complete profile for NIM registration
        status: 'active'
      },
    });

    console.log(`[DEBUG] User registered successfully:`, {
      id: user.id,
      email: user.email,
      nim: user.nim
    });

    // Generate token
    const token = generateToken(user.id);
    
    // Buat session
    await createSession(user.id, token, 'registration', 'registration');

    return {
      success: true,
      message: 'Registrasi berhasil',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        nim: user.nim,
        status: user.status,
        authMethod: user.authMethod,
        userType: user.userType,
        isProfileComplete: user.isProfileComplete
      },
      token,
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
        isProfileComplete: user.isProfileComplete
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
// EXPORTS - TAMBAH FUNGSI BARU
// ========================================================
module.exports = {
  register,
  login,
  logout,
  verifySession,
  generateToken,
  verifyToken,
  getUserById,
  createSession,
  logoutAllUserSessions,
  checkNIMAvailability,
  updateUserVerification,
  updateUserProfile,
  // ✅ FUNGSI BARU
  findOrCreateUserByEmail,
  registerWithEmail,
  passport,
};