const authService = require('../services/authService');
const academicService = require('../services/academicService');


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

// PERBAIKAN: Google Callback Success - KIRIM USER DATA LENGKAP
const googleCallbackSuccess = async (req, res) => {
  try {
    console.log('[DEBUG] Google callback success handler called');
    console.log('[DEBUG] Authenticated user:', req.user);
    console.log('[DEBUG] Is authenticated:', req.isAuthenticated());
    
    if (!req.user) {
      console.error('[ERROR] No user in request after Google auth');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=no_user_session`);
    }

    console.log(`[DEBUG] Google OAuth successful for user: ${req.user.email}`);

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
      isProfileComplete: req.user.isProfileComplete
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

// ✅ BARU: REGISTER FUNCTION
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
      res.status(201).json(result);
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

// PERBAIKAN: Login dengan validasi yang lebih ketat
const login = async (req, res) => {
  try {
    const { nim, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    console.log(`[DEBUG] Login attempt for NIM: ${nim}`);

    // Validasi input
    if (!nim || !password) {
      return res.status(400).json({
        success: false,
        message: 'NIM dan password harus diisi'
      });
    }

    // Validasi format NIM (minimal 3 digit)
    if (nim.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Format NIM tidak valid'
      });
    }

    // Validasi format password (minimal 6 karakter)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password harus minimal 6 karakter'
      });
    }

    const result = await authService.login(nim, password, ipAddress, userAgent);

    if (result.success) {
      // Login ke Passport session untuk konsistensi
      req.login({ id: result.user.id, email: result.user.email }, (err) => {
        if (err) {
          console.log('[DEBUG] Passport login in regular login failed:', err);
        }
      });

      console.log(`[DEBUG] Login successful for user: ${result.user.email}`);

      // PERBAIKAN: Kirim user data yang lengkap
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
          isProfileComplete: result.user.isProfileComplete
        }
      });
    } else {
      console.log(`[DEBUG] Login failed for NIM: ${nim} - ${result.message}`);
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

// ✅ BARU: REGISTER WITH EMAIL ONLY
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

    // Panggil service registerWithEmail
    const result = await authService.registerWithEmail(email);

    if (result.success) {
      console.log('✅ [AUTH CONTROLLER] Email registration successful:', email);
      return res.status(201).json(result);
    } else {
      console.log('❌ [AUTH CONTROLLER] Email registration failed:', result.message);
      return res.status(400).json(result);
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

// PERBAIKAN: Update verify endpoint
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
      // PERBAIKAN: Kirim user data yang lengkap
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
          isProfileComplete: result.user.isProfileComplete
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
    service: 'Authentication Service'
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
  register,           // ✅ DITAMBAHKAN
  registerWithEmail,  // ✅ DITAMBAHKAN
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