const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const prisma = new PrismaClient();

// Fungsi untuk membuat JWT (Token)
const generateToken = (userId) => {
  // Pastikan Anda menambahkan JWT_SECRET di file .env Anda!
  // Contoh: JWT_SECRET=inirahasiabanget
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d', // Token berlaku 30 hari
  });
};

// ========================================================
// FUNGSI REGISTER (YANG HILANG)
// ========================================================
const register = async (userData) => {
  const { fullName, nim, email, password } = userData;

  // 1. Cek validasi dasar
  if (!fullName || !nim || !email || !password) {
    // Kirim objek error yang konsisten
    return { success: false, message: 'All fields are required' };
  }

  try {
    // 2. Cek apakah email sudah ada
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      return { success: false, message: 'User already exists with this email' };
    }

    // 3. Cek apakah NIM sudah ada
    const nimExists = await prisma.user.findUnique({ where: { nim } });
    if (nimExists) {
      return { success: false, message: 'User already exists with this NIM' };
    }

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Buat user di database
    const user = await prisma.user.create({
      data: {
        fullName,
        nim,
        email,
        // --- PERBAIKAN: Mengubah 'password' menjadi 'passwordHash' ---
        passwordHash: hashedPassword,
      },
    });

    // 6. Buat token dan kirim kembali data (auto-login)
    if (user) {
      const token = generateToken(user.id);
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
// FUNGSI LOGIN (YANG SUDAH ANDA MILIKI)
// ========================================================
const login = async (nim, password, ipAddress, userAgent) => {
  // 1. Cari user berdasarkan NIM
  const user = await prisma.user.findUnique({
    where: { nim },
  });

  // 2. Jika user ada DAN password cocok
  // --- PERBAIKAN: Mengubah 'user.password' menjadi 'user.passwordHash' ---
  if (user && (await bcrypt.compare(password, user.passwordHash))) {
    // 3. Buat token
    const token = generateToken(user.id);

    // 4. (Opsional) Catat sesi login di database
    await prisma.session.create({
      data: {
        userId: user.id,
        token, // Simpan token untuk referensi (bisa di-hash)
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 hari
      },
    });

    // 5. Kirim data
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
    // 6. Jika tidak, kirim error
    return {
      success: false,
      message: 'NIM atau password salah',
    };
  }
};

// ========================================================
// FUNGSI LOGOUT (YANG SUDAH ANDA MILIKI)
// ========================================================
const logout = async (token) => {
  // Hapus sesi dari database
  await prisma.session.deleteMany({
    where: { token: token },
  });
  return {
    success: true,
    message: 'Logout berhasil',
  };
};

// ========================================================
// FUNGSI VERIFY (YANG SUDAH ANDA MILIKI)
// ========================================================
const verifySession = async (token) => {
  try {
    // 1. Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 2. Cari user
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


// --- INI BAGIAN PALING PENTING ---
// Pastikan 'register' ada di sini
module.exports = {
  register, // <-- PASTIKAN INI ADA
  login,
  logout,
  verifySession,
};