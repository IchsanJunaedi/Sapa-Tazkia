const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Hash password
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
function generateToken(userId, nim) {
  return jwt.sign(
    { userId, nim },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Login user
 */
async function login(nim, password, ipAddress, userAgent) {
  try {
    // Find user by NIM
    const user = await prisma.user.findUnique({
      where: { nim },
      include: {
        programStudi: true,
        academicSummary: true
      }
    });

    if (!user) {
      return { success: false, message: 'NIM tidak ditemukan' };
    }

    // Check password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    
    if (!isPasswordValid) {
      return { success: false, message: 'Password salah' };
    }

    // Generate token
    const token = generateToken(user.id, user.nim);

    // Create session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: token,
        ipAddress: ipAddress,
        userAgent: userAgent,
        expiresAt: expiresAt
      }
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Return user data (without password)
    const userData = {
      id: user.id,
      nim: user.nim,
      fullName: user.fullName,
      email: user.email,
      programStudi: user.programStudi?.name || null,
      angkatan: user.angkatan,
      ipk: user.academicSummary?.ipk || null,
      status: user.status
    };

    return {
      success: true,
      message: 'Login berhasil',
      token: token,
      user: userData
    };

  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Terjadi kesalahan sistem' };
  }
}

/**
 * Logout user
 */
async function logout(token) {
  try {
    await prisma.session.updateMany({
      where: { token: token },
      data: { isActive: false }
    });

    return { success: true, message: 'Logout berhasil' };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, message: 'Terjadi kesalahan sistem' };
  }
}

/**
 * Verify user session
 */
async function verifySession(token) {
  try {
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return { valid: false, message: 'Token tidak valid' };
    }

    const session = await prisma.session.findFirst({
      where: {
        token: token,
        isActive: true,
        expiresAt: { gte: new Date() }
      },
      include: {
        user: {
          include: {
            programStudi: true,
            academicSummary: true
          }
        }
      }
    });

    if (!session) {
      return { valid: false, message: 'Session tidak ditemukan atau expired' };
    }

    // Update last activity
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivity: new Date() }
    });

    const userData = {
      id: session.user.id,
      nim: session.user.nim,
      fullName: session.user.fullName,
      email: session.user.email,
      programStudi: session.user.programStudi?.name || null,
      angkatan: session.user.angkatan,
      ipk: session.user.academicSummary?.ipk || null,
      status: session.user.status
    };

    return {
      valid: true,
      user: userData
    };

  } catch (error) {
    console.error('Verify session error:', error);
    return { valid: false, message: 'Terjadi kesalahan sistem' };
  }
}

module.exports = {
  hashPassword,
  login,
  logout,
  verifySession,
  verifyToken
};