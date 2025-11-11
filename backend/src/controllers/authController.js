const authService = require('../services/authService');

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
      googleId: req.user.googleId,
      status: req.user.status
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
          status: result.user.status
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

// PERBAIKAN: Register dengan validasi yang lebih ketat
const register = async (req, res) => {
  try {
    const { fullName, nim, email, password } = req.body;

    console.log(`[DEBUG] Registration attempt for:`, { fullName, nim, email });

    // Validasi required fields
    if (!fullName || !nim || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Semua field harus diisi'
      });
    }

    // Validasi format
    if (fullName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap harus minimal 2 karakter'
      });
    }

    if (nim.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Format NIM tidak valid'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password harus minimal 6 karakter'
      });
    }

    // Validasi email format sederhana
    if (!email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid'
      });
    }

    const result = await authService.register(req.body);

    if (result.success) {
      console.log(`[DEBUG] Registration successful for: ${email}`);
      
      // PERBAIKAN: Kirim user data yang lengkap
      res.status(201).json({
        success: true,
        message: result.message,
        token: result.token,
        user: {
          id: result.user.id,
          nim: result.user.nim,
          email: result.user.email,
          fullName: result.user.fullName,
          status: result.user.status
        }
      });
    } else {
      console.log(`[DEBUG] Registration failed for: ${email} - ${result.message}`);
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('[ERROR] Register controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server saat registrasi'
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
          status: result.user.status
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
  register,
  checkNIM,
  logout,
  verify,
  getProfile,
  checkAuth,
  healthCheck
};