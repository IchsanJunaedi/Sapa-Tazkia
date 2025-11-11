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
// KONFIGURASI PASSPORT (GOOGLE STRATEGY) - DIPERBAIKI NIM EXTRACTION
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
          
          // --- LOGIKA EKSTRAKSI NIM - DIPERBAIKI ---
          let studentNim = null;
          const academicDomain = '@student.stmik.tazkia.ac.id';
          
          if (userEmail.endsWith(academicDomain)) {
              // PERBAIKAN: Ambil bagian sebelum @ sebagai NIM
              studentNim = userEmail.split('@')[0];
              
              // PERBAIKAN: Hapus karakter non-digit jika ada (seperti titik)
              studentNim = studentNim.replace(/\D/g, '');
              
              // Validasi panjang NIM (minimal 10 digit)
              if (studentNim.length >= 10) {
                  console.log(`[DEBUG] NIM ditemukan: ${studentNim} dari email: ${userEmail}`);
              } else {
                  console.log(`[WARNING] NIM terlalu pendek: ${studentNim} dari email: ${userEmail}`);
                  // Tetap gunakan, tapi log warning
              }
          } else {
              console.log(`[DEBUG] Email non-akademik: ${userEmail}`);
              return done(new Error('Hanya email akademik (@student.stmik.tazkia.ac.id) yang diizinkan'), false);
          }

          // Validasi NIM berhasil diekstrak
          if (!studentNim || studentNim.length < 10) {
            console.error('[ERROR] Gagal mengekstrak NIM yang valid dari email:', userEmail);
            return done(new Error('Gagal mengekstrak NIM dari email. Pastikan format email benar.'), false);
          }

          console.log(`[DEBUG] Final NIM: ${studentNim}`);

          // 1. Cek apakah user sudah ada berdasarkan Google ID
          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          console.log(`[DEBUG] User by Google ID:`, user ? 'Found' : 'Not found');

          if (user) {
            console.log(`[DEBUG] User found by Google ID, logging in`);
            
            // PERBAIKAN: Update NIM jika masih null atau berbeda
            if (!user.nim || user.nim !== studentNim) {
              console.log(`[DEBUG] Updating NIM for existing user: ${user.nim} -> ${studentNim}`);
              user = await prisma.user.update({
                where: { id: user.id },
                data: { nim: studentNim }
              });
            }
            
            return done(null, user);
          }

          // 2. Cek user berdasarkan email
          user = await prisma.user.findUnique({
            where: { email: userEmail },
          });

          console.log(`[DEBUG] User by email:`, user ? 'Found' : 'Not found');

          if (user) {
            console.log(`[DEBUG] User found by email, updating Google ID dan NIM`);
            
            // PERBAIKAN: Update user dengan Google ID dan NIM yang benar
            const updatedUser = await prisma.user.update({
              where: { email: userEmail },
              data: { 
                googleId: profile.id,
                nim: studentNim // SELALU update dengan NIM yang diekstrak
              }, 
            });
            
            console.log(`[DEBUG] User updated with Google ID and NIM`);
            return done(null, updatedUser);
          }

          // 3. Cek apakah NIM sudah digunakan oleh user lain
          const existingUserWithNim = await prisma.user.findUnique({
            where: { nim: studentNim },
          });

          if (existingUserWithNim) {
            console.error(`[ERROR] NIM ${studentNim} sudah digunakan oleh user lain`);
            return done(new Error('NIM sudah digunakan oleh akun lain. Silakan hubungi administrator.'), false);
          }

          // 4. Buat user baru
          console.log(`[DEBUG] Creating new user with:`, {
            email: userEmail,
            nim: studentNim,
            name: profile.displayName
          });

          const newUser = await prisma.user.create({
            data: {
              googleId: profile.id,
              email: userEmail,
              fullName: profile.displayName,
              nim: studentNim,
              passwordHash: null, 
              status: 'active'
            },
          });

          console.log(`[DEBUG] New user created successfully:`, {
            id: newUser.id,
            email: newUser.email,
            nim: newUser.nim
          });

          return done(null, newUser);
          
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
      
      // PERBAIKAN: Handle both string and number IDs
      const userId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      const user = await prisma.user.findUnique({ 
        where: { id: userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          nim: true,
          googleId: true,
          status: true
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
            status: true
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

    // Validasi format email kampus
    if (!email.endsWith('@student.stmik.tazkia.ac.id')) {
      return { success: false, message: 'Hanya email akademik (@student.stmik.tazkia.ac.id) yang diizinkan' };
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
        status: user.status
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
const login = async (nim, password, ipAddress, userAgent) => {
  try {
    console.log(`[DEBUG] Login attempt for NIM: ${nim}`);

    // Validasi input
    if (!nim || !password) {
      return {
        success: false,
        message: 'NIM dan password harus diisi',
      };
    }

    // Validasi format NIM
    if (nim.trim().length < 3) {
      return {
        success: false,
        message: 'Format NIM tidak valid',
      };
    }

    // Validasi format password
    if (password.length < 6) {
      return {
        success: false,
        message: 'Password harus minimal 6 karakter',
      };
    }

    // Cari user by NIM (case sensitive, exact match)
    const user = await prisma.user.findUnique({
      where: { 
        nim: nim.trim() // PERBAIKAN: Gunakan trim() untuk consistency
      },
    });

    if (!user) {
      console.log(`[DEBUG] User not found for NIM: ${nim}`);
      return {
        success: false,
        message: 'NIM atau password salah', // Jangan kasih tahu yang mana yang salah
      };
    }

    // Cek status user
    if (user.status !== 'active') {
      console.log(`[DEBUG] User ${nim} is not active`);
      return {
        success: false,
        message: 'Akun tidak aktif. Silakan hubungi administrator.',
      };
    }

    // Cek jika user adalah user Google (tidak ada password)
    if (!user.passwordHash) {
      console.log(`[DEBUG] User ${nim} is Google-only user`);
      return {
        success: false,
        message: 'Akun ini hanya dapat login melalui Google. Silakan gunakan Login dengan Google.',
      };
    }

    // Verifikasi password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      console.log(`[DEBUG] Invalid password for user: ${user.email}`);
      return {
        success: false,
        message: 'NIM atau password salah', // Jangan kasih tahu yang mana yang salah
      };
    }

    // Login berhasil
    const token = generateToken(user.id);

    // Hapus session lama dan buat session baru
    await logoutAllUserSessions(user.id);
    await createSession(user.id, token, ipAddress, userAgent);

    console.log(`[DEBUG] Login successful for user:`, {
      id: user.id,
      email: user.email,
      nim: user.nim
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
        status: user.status
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
  verifyToken,
  getUserById,
  createSession,
  logoutAllUserSessions,
  checkNIMAvailability, // PERBAIKAN: Export fungsi baru
  passport,
};