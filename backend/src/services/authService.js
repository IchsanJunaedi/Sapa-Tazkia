// --- BAGIAN IMPORT ---
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// BARU: Import Passport dan Strategi Google
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const prisma = new PrismaClient();

// ========================================================
// KONFIGURASI PASSPORT (GOOGLE STRATEGY)
// ========================================================

// BARU: Logika utama Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. Cek apakah user sudah ada berdasarkan Google ID
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        if (user) {
          return done(null, user); // User ditemukan, login
        }

        // 2. Jika tidak ada, cek berdasarkan email
        const userEmail = profile.emails[0].value;
        user = await prisma.user.findUnique({
          where: { email: userEmail },
        });

        if (user) {
          // User ada tapi belum terhubung ke Google. Update datanya.
          const updatedUser = await prisma.user.update({
            where: { email: userEmail },
            data: { googleId: profile.id },
          });
          return done(null, updatedUser);
        }

        // 3. Jika tidak ada sama sekali, buat user baru
        // Ini HANYA akan berhasil jika Anda sudah mengubah schema.prisma
        const newUser = await prisma.user.create({
          data: {
            googleId: profile.id,
            email: userEmail,
            fullName: profile.displayName,
            nim: null, // Dibuat null karena login via Google
            passwordHash: null, // Dibuat null karena login via Google
          },
        });

        return done(null, newUser);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

// DIPERBARUI: Serializer (menyimpan user ID ke session)
// user.id Anda sekarang Int, ini tidak masalah
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// DIPERBARUI: Deserializer (mengambil data user dari session)
passport.deserializeUser(async (id, done) => {
  try {
    // ID dari session mungkin string, ubah ke Int untuk query
    const userId = parseInt(id, 10); 
    const user = await prisma.user.findUnique({ where: { id: userId } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// ========================================================
// FUNGSI TOKEN (TETAP SAMA)
// ========================================================
const generateToken = (userId) => {
  // userId Anda sekarang Int, JWT tidak masalah
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// ========================================================
// FUNGSI REGISTER (TETAP SAMA)
// ========================================================
const register = async (userData) => {
  const { fullName, nim, email, password } = userData;

  if (!fullName || !nim || !email || !password) {
    return { success: false, message: 'All fields are required' };
  }

  try {
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      return { success: false, message: 'User already exists with this email' };
    }

    const nimExists = await prisma.user.findUnique({ where: { nim } });
    if (nimExists) {
      return { success: false, message: 'User already exists with this NIM' };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        fullName,
        nim,
        email,
        passwordHash: hashedPassword,
      },
    });

    if (user) {
      const token = generateToken(user.id); // user.id (Int)
      return {
        success: true,
        message: 'Registration successful',
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          nim: user.nim,
        },
        token,
      };
    } else {
      return { success: false, message: 'Invalid user data' };
    }
  } catch (error) {
    console.error('Error in register service:', error);
    return { success: false, message: error.message || 'Database error' };
  }
};

// ========================================================
// FUNGSI LOGIN (DIPERBARUI)
// ========================================================
const login = async (nim, password, ipAddress, userAgent) => {
  const user = await prisma.user.findUnique({
    where: { nim },
  });

  // DIPERBARUI: Tambahkan cek 'user.passwordHash'
  // Ini untuk mencegah error jika user Google (passwordHash=null) mencoba login
  if (user && user.passwordHash && (await bcrypt.compare(password, user.passwordHash))) {
    
    const token = generateToken(user.id); // user.id (Int)

    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
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
      },
    };
  } else {
    return {
      success: false,
      message: 'NIM atau password salah',
    };
  }
};

// ========================================================
// FUNGSI LOGOUT (TETAP SAMA)
// ========================================================
const logout = async (token) => {
  await prisma.session.deleteMany({
    where: { token: token },
  });
  return {
    success: true,
    message: 'Logout berhasil',
  };
};

// ========================================================
// FUNGSI VERIFY (TETAP SAMA)
// ========================================================
const verifySession = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // decoded.id sekarang Int
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        nim: true,
      },
    });

    if (!user) {
      return { valid: false, message: 'User not found' };
    }

    return { valid: true, user: user };
  } catch (error) {
    return { valid: false, message: 'Token tidak valid atau kadaluarsa' };
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
  generateToken, // BARU: Ekspor generateToken
  passport, // BARU: Ekspor passport
};