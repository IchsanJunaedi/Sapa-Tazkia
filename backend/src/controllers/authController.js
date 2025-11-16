const authService = require('../services/authService');
const academicService = require('../services/academicService');
const emailService = require('../services/emailService');

const googleAuth = (req, res, next) => {
  console.log('[DEBUG] Initiating Google OAuth');
  console.log('[DEBUG] Session before auth:', req.sessionID);
  
  authService.passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })(req, res, next);
};

const googleCallback = (req, res, next) => {
  console.log('[DEBUG] Google OAuth callback received');
  console.log('[DEBUG] Session ID in callback:', req.sessionID);
  
  authService.passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`
  })(req, res, next);
};

// PERBAIKAN: Google Callback Success - DITAMBAH VALIDASI DOMAIN
const googleCallbackSuccess = async (req, res) => {
  try {
    console.log('[DEBUG] Google callback success handler called');
    console.log('[DEBUG] Authenticated user:', req.user);
    console.log('[DEBUG] Is authenticated:', req.isAuthenticated());
    
    if (!req.user) {
      console.error('[ERROR] No user in request after Google auth');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=no_user_session`);
    }

    const userEmail = req.user.email;
    console.log(`[DEBUG] Google OAuth successful for user: ${userEmail}`);

    // ✅ ✅ ✅ TAMBAHKAN VALIDASI DOMAIN DI SINI ✅ ✅ ✅
    const validDomains = [
      'student.tazkia.ac.id',
      'student.stmik.tazkia.ac.id', 
      'tazkia.ac.id'
    ];
    
    const userDomain = userEmail.split('@')[1];
    const isValidDomain = validDomains.includes(userDomain);
    
    if (!isValidDomain) {
      console.log(`🚫 [AUTH CONTROLLER] Google login rejected - Invalid domain: ${userEmail}`);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=invalid_domain&message=Hanya email Tazkia yang diizinkan&email=${encodeURIComponent(userEmail)}`);
    }
    // ✅ ✅ ✅ END OF VALIDASI ✅ ✅ ✅

    // Generate token untuk API calls
    const token = authService.generateToken(req.user.id);

    // Buat session di database untuk tracking
    await authService.logoutAllUserSessions(req.user.id);
    await authService.createSession(req.user.id, token, req.ip, req.get('User-Agent'));

    console.log(`[DEBUG] Database session created for user: ${req.user.email}`);
    console.log(`[DEBUG] User authenticated in session:`, req.isAuthenticated());

    // PERBAIKAN: Siapkan user data lengkap untuk frontend
    const userData = {
      id: req.user.id,
      nim: req.user.nim,
      email: req.user.email,
      fullName: req.user.fullName,
      status: req.user.status,
      authMethod: req.user.authMethod,
      userType: req.user.userType,
      isProfileComplete: req.user.isProfileComplete,
      isEmailVerified: req.user.isEmailVerified
    };

    console.log(`[DEBUG] User data to send:`, userData);

    // PERBAIKAN: Encode user data untuk URL
    const encodedUserData = encodeURIComponent(JSON.stringify(userData));

    // PERBAIKAN: Redirect ke frontend dengan token DAN user data
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&user=${encodedUserData}&success=true`;
    console.log(`[DEBUG] Redirecting to: ${redirectUrl}`);
    
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('[ERROR] Error in Google callback success:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=server_error`);
  }
};

// ✅ BARU: VERIFY EMAIL CODE ENDPOINT
const verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    console.log('🔍 [AUTH CONTROLLER] Verify email code request:', { email, code });

    // Validasi input
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email dan kode verifikasi harus diisi'
      });
    }

    // Validasi format kode (6 digit)
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Kode verifikasi harus 6 digit angka'
      });
    }

    // Panggil service verifikasi
    const result = await authService.verifyEmailCode(email, code);

    if (result.success) {
      console.log('✅ [AUTH CONTROLLER] Email verification successful:', email);
      
      // Kirim email welcome setelah verifikasi berhasil
      try {
        await emailService.sendWelcomeEmail(
          email, 
          result.user.fullName || 'User', 
          result.user.userType
        );
        console.log('✅ [AUTH CONTROLLER] Welcome email sent to:', email);
      } catch (emailError) {
        console.log('⚠️ [AUTH CONTROLLER] Failed to send welcome email:', emailError.message);
        // Continue even if welcome email fails
      }

      res.status(200).json({
        success: true,
        message: result.message,
        token: result.token,
        user: {
          id: result.user.id,
          nim: result.user.nim,
          email: result.user.email,
          fullName: result.user.fullName,
          status: result.user.status,
          authMethod: result.user.authMethod,
          userType: result.user.userType,
          isProfileComplete: result.user.isProfileComplete,
          isEmailVerified: result.user.isEmailVerified
        },
        requiresProfileCompletion: !result.user.isProfileComplete
      });
    } else {
      console.log('❌ [AUTH CONTROLLER] Email verification failed:', result.message);
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Verify email code error:', error);
    
    // Handle specific errors
    if (error.message.includes('tidak valid') || error.message.includes('kadaluarsa')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('Terlalu banyak percobaan')) {
      return res.status(429).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat verifikasi email'
    });
  }
};

// ✅ BARU: RESEND VERIFICATION CODE ENDPOINT
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;

    console.log('🔍 [AUTH CONTROLLER] Resend verification code request:', email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email harus diisi'
      });
    }

    // Panggil service untuk kirim ulang kode
    const result = await authService.resendVerificationCode(email);

    if (result.success) {
      console.log('✅ [AUTH CONTROLLER] Verification code resent to:', email);
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      console.log('❌ [AUTH CONTROLLER] Resend verification code failed:', result.message);
      res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Resend verification code error:', error);
    
    if (error.message === 'Email sudah terverifikasi') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message === 'User tidak ditemukan') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat mengirim ulang kode verifikasi'
    });
  }
};

// ✅ BARU: CHECK EMAIL VERIFICATION STATUS
const checkEmailVerification = async (req, res) => {
  try {
    const { email } = req.params;

    console.log('🔍 [AUTH CONTROLLER] Check email verification status:', email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email harus diisi'
      });
    }

    // Cek user di database
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        isEmailVerified: true,
        status: true,
        verificationCodeExpires: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: {
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        status: user.status,
        hasActiveVerification: user.verificationCodeExpires && new Date() < user.verificationCodeExpires
      }
    });

  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Check email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat mengecek status verifikasi'
    });
  }
};

// ✅ BARU: REGISTER FUNCTION - DIPERBAIKI DENGAN VERIFIKASI
const register = async (req, res) => {
  try {
    const { fullName, nim, email, password } = req.body;

    console.log('🔍 [AUTH CONTROLLER] Register attempt:', { fullName, nim, email });

    // Validasi input
    if (!fullName || !nim || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Semua field harus diisi'
      });
    }

    // Panggil service register
    const result = await authService.register({ fullName, nim, email, password });

    if (result.success) {
      console.log('✅ [AUTH CONTROLLER] Registration successful:', email);
      
      // Kirim response yang sesuai dengan flow verifikasi
      if (result.requiresVerification) {
        res.status(201).json({
          success: true,
          message: result.message,
          requiresVerification: true,
          data: {
            email: result.data.email
          }
        });
      } else {
        res.status(201).json(result);
      }
    } else {
      console.log('❌ [AUTH CONTROLLER] Registration failed:', result.message);
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat registrasi'
    });
  }
};

// PERBAIKAN: Login dengan validasi yang lebih ketat - DIPERBAIKI DENGAN VERIFIKASI
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    console.log(`[DEBUG] Login attempt for identifier: ${identifier}`);

    // Validasi input
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/NIM dan password harus diisi'
      });
    }

    const result = await authService.login(identifier, password, ipAddress, userAgent);

    if (result.success) {
      // Login ke Passport session untuk konsistensi
      req.login({ id: result.user.id, email: result.user.email }, (err) => {
        if (err) {
          console.log('[DEBUG] Passport login in regular login failed:', err);
        }
      });

      console.log(`[DEBUG] Login successful for user: ${result.user.email}`);

      // PERBAIKAN: Kirim user data yang lengkap termasuk status verifikasi
      res.status(200).json({
        success: true,
        message: result.message,
        token: result.token,
        user: {
          id: result.user.id,
          nim: result.user.nim,
          email: result.user.email,
          fullName: result.user.fullName,
          status: result.user.status,
          authMethod: result.user.authMethod,
          userType: result.user.userType,
          isProfileComplete: result.user.isProfileComplete,
          isEmailVerified: result.user.isEmailVerified
        }
      });
    } else {
      console.log(`[DEBUG] Login failed for identifier: ${identifier} - ${result.message}`);
      
      // Handle case where email verification is required
      if (result.requiresVerification) {
        return res.status(403).json({
          success: false,
          message: result.message,
          requiresVerification: true,
          email: result.email
        });
      }
      
      res.status(401).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('[ERROR] Login controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat login'
    });
  }
};

// ✅ BARU: REGISTER WITH EMAIL ONLY - DIPERBAIKI
const registerWithEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('🔍 [AUTH CONTROLLER] Register with email request:', email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email harus diisi'
      });
    }

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid'
      });
    }

    // Panggil service registerWithEmail
    const result = await authService.registerWithEmail(email);

    if (result.success) {
      console.log('✅ [AUTH CONTROLLER] Email registration successful:', email);
      return res.status(201).json({
        success: true,
        message: result.message,
        requiresVerification: true,
        data: {
          email: result.data.email
        }
      });
    } else {
      console.log('❌ [AUTH CONTROLLER] Email registration failed:', result.message);
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Register with email error:', error);
    
    if (error.message === 'Email already registered') {
      return res.status(409).json({
        success: false,
        message: 'Email sudah terdaftar'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat registrasi'
    });
  }
};

// ✅ BARU: Verify student data dengan academic system
const verifyStudent = async (req, res) => {
  try {
    const { nim, fullName, birthDate } = req.body;
    const userId = req.user.id;

    console.log('🔍 [AUTH CONTROLLER] Verifying student:', { nim, fullName, birthDate, userId });

    // Validasi input
    if (!nim || !fullName || !birthDate) {
      return res.status(400).json({
        success: false,
        message: 'NIM, nama lengkap, dan tanggal lahir harus diisi'
      });
    }

    // Validasi format NIM (10-12 digit)
    if (nim.length < 10 || nim.length > 12) {
      return res.status(400).json({
        success: false,
        message: 'NIM harus 10-12 digit'
      });
    }

    // Validasi format tanggal lahir
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return res.status(400).json({
        success: false,
        message: 'Format tanggal lahir tidak valid (gunakan YYYY-MM-DD)'
      });
    }

    // Panggil academic service untuk validasi
    const validationResult = await academicService.validateStudent(nim, fullName, birthDate);

    if (validationResult.valid) {
      console.log('✅ [AUTH CONTROLLER] Student validation successful:', validationResult.data);

      // Update user verification status di database
      await authService.updateUserVerification(userId, {
        nim: validationResult.data.nim,
        fullName: validationResult.data.fullName
      });

      res.json({
        success: true,
        valid: true,
        data: validationResult.data,
        message: validationResult.message
      });
    } else {
      console.log('❌ [AUTH CONTROLLER] Student validation failed');
      res.status(400).json({
        success: false,
        valid: false,
        message: validationResult.message
      });
    }

  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Verify student error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan sistem saat verifikasi'
    });
  }
};

// ✅ BARU: Update user verification status
const updateVerification = async (req, res) => {
  try {
    const { nim, fullName } = req.body;
    const userId = req.user.id;

    console.log('🔍 [AUTH CONTROLLER] Updating verification:', { userId, nim, fullName });

    await authService.updateUserVerification(userId, {
      nim,
      fullName
    });

    res.json({
      success: true,
      message: 'Status verifikasi berhasil diperbarui'
    });

  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Update verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui status verifikasi'
    });
  }
};

// ✅ BARU: Update user profile
const updateProfile = async (req, res) => {
  try {
    const { email, nim, fullName } = req.body;
    const userId = req.user.id;

    console.log('🔍 [AUTH CONTROLLER] Updating profile:', { userId, email, nim, fullName });

    await authService.updateUserProfile(userId, { email, nim, fullName });

    res.json({
      success: true,
      message: 'Profile berhasil diperbarui'
    });

  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui profile'
    });
  }
};

// PERBAIKAN: Tambahkan endpoint untuk check NIM
const checkNIM = async (req, res) => {
  try {
    const { nim } = req.params;
    
    if (!nim) {
      return res.status(400).json({
        success: false,
        message: 'NIM harus diisi'
      });
    }

    const result = await authService.checkNIMAvailability(nim);
    
    res.json({
      success: true,
      available: result.available,
      message: result.message
    });
  } catch (error) {
    console.error('[ERROR] Check NIM controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat mengecek NIM'
    });
  }
};

// PERBAIKAN: Update verify endpoint - DIPERBAIKI DENGAN VERIFIKASI
const verify = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        valid: false,
        message: 'Token tidak provided'
      });
    }

    console.log(`[DEBUG] Token verification attempt`);

    const result = await authService.verifySession(token);
    
    if (result.valid) {
      // PERBAIKAN: Kirim user data yang lengkap termasuk status verifikasi
      res.json({
        success: true,
        valid: true,
        user: {
          id: result.user.id,
          nim: result.user.nim,
          email: result.user.email,
          fullName: result.user.fullName,
          status: result.user.status,
          authMethod: result.user.authMethod,
          userType: result.user.userType,
          isProfileComplete: result.user.isProfileComplete,
          isEmailVerified: result.user.isEmailVerified
        }
      });
    } else {
      res.status(401).json({
        success: false,
        valid: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('[ERROR] Verify controller error:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Terjadi kesalahan server saat verifikasi token'
    });
  }
};

// PERBAIKAN: Health check endpoint
const healthCheck = (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is healthy',
    timestamp: new Date().toISOString(),
    service: 'Authentication Service',
    features: {
      emailVerification: true,
      googleOAuth: true,
      sessionManagement: true
    }
  });
};

// Fungsi lainnya tetap sama...
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token tidak provided'
      });
    }

    console.log(`[DEBUG] Logout attempt for user: ${req.user?.id}`);

    req.logout((err) => {
      if (err) console.log('[DEBUG] Passport logout error:', err);
    });

    const result = await authService.logout(token);

    req.session.destroy((err) => {
      if (err) {
        console.log('[DEBUG] Session destroy error:', err);
      }
    });

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('[ERROR] Logout controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat logout'
    });
  }
};

const getProfile = async (req, res) => {
  try {
    console.log('[DEBUG] Get profile - User:', req.user);
    console.log('[DEBUG] Get profile - Is authenticated:', req.isAuthenticated ? req.isAuthenticated() : 'no isAuthenticated method');
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User tidak terautentikasi'
      });
    }

    console.log(`[DEBUG] Get profile for user: ${req.user.email}`);

    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('[ERROR] Get profile controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat mengambil profil'
    });
  }
};

const checkAuth = (req, res) => {
  console.log('[DEBUG] Check auth - Session ID:', req.sessionID);
  console.log('[DEBUG] Check auth - User:', req.user);
  console.log('[DEBUG] Check auth - Is authenticated:', req.isAuthenticated ? req.isAuthenticated() : 'no method');
  
  res.json({
    authenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    user: req.user || null,
    sessionID: req.sessionID,
    message: req.user ? 'User is authenticated' : 'User is not authenticated'
  });
};

module.exports = {
  googleAuth,
  googleCallback,
  googleCallbackSuccess,
  login,
  register,
  registerWithEmail,
  verifyEmailCode,
  resendVerificationCode,
  checkEmailVerification,
  verifyStudent,
  updateVerification,  
  updateProfile,
  checkNIM,
  logout,
  verify,
  getProfile,
  checkAuth,
  healthCheck
};