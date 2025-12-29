const authService = require('../services/authService');
const academicService = require('../services/academicService');
const emailService = require('../services/emailService');
const ragService = require('../services/ragService'); // ✅ IMPORT RAG SERVICE
const openaiService = require('../services/openaiService'); // ✅ BARU: Import OpenAI Service untuk Title
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================================================
// 1. AUTHENTICATION (Google, Callback, Login, Register)
// ============================================================================

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

// ✅ Google Callback Success
const googleCallbackSuccess = async (req, res) => {
  try {
    console.log('[DEBUG] Google callback success handler called');

    if (!req.user) {
      console.error('[ERROR] No user in request after Google auth');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=no_user_session`);
    }

    const userEmail = req.user.email;
    console.log(`[DEBUG] Google OAuth successful for user: ${userEmail}`);

    // Validasi domain
    const validDomains = ['student.tazkia.ac.id', 'student.stmik.tazkia.ac.id', 'tazkia.ac.id'];
    const userDomain = userEmail.split('@')[1];

    if (!validDomains.includes(userDomain)) {
      console.log(`🚫 [AUTH CONTROLLER] Google login rejected - Invalid domain: ${userEmail}`);
      // ✅ PERBAIKAN: Redirect ke landing page dengan auth_error agar error ditampilkan di modal
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/?auth_error=invalid_domain&message=${encodeURIComponent('Login gagal! Silakan gunakan email kampus Tazkia (@student.tazkia.ac.id, @student.stmik.tazkia.ac.id, atau @tazkia.ac.id)')}&email=${encodeURIComponent(userEmail)}`);
    }

    console.log(`[DEBUG] Checking if user is new for: ${userEmail}`);

    const existingUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        id: true,
        isEmailVerified: true,
        isProfileComplete: true,
        createdAt: true,
        authMethod: true
      }
    });

    console.log(`[DEBUG] Existing user query result:`, existingUser);

    // Logic deteksi new user (< 5 menit)
    const isNewUser = !existingUser ||
      (existingUser.authMethod === 'google' &&
        (new Date() - new Date(existingUser.createdAt)) < 300000);

    console.log(`[DEBUG] User status - isNewUser: ${isNewUser}, existing: ${!!existingUser}`);

    const shouldVerifyEmail = isNewUser;

    console.log(`[DEBUG] Final decision - shouldVerifyEmail: ${shouldVerifyEmail}`);

    // Generate token
    const token = authService.generateToken(req.user.id);

    // Buat session
    await authService.logoutAllUserSessions(req.user.id);
    await authService.createSession(req.user.id, token, req.ip, req.get('User-Agent'));

    console.log(`[DEBUG] Database session created for user: ${req.user.email}`);

    const userData = {
      id: req.user.id,
      nim: req.user.nim,
      email: req.user.email,
      fullName: req.user.fullName,
      status: req.user.status,
      authMethod: req.user.authMethod,
      userType: req.user.userType,
      isProfileComplete: req.user.isProfileComplete,
      isEmailVerified: shouldVerifyEmail ? false : req.user.isEmailVerified
    };

    console.log(`[DEBUG] User data to send:`, userData);
    console.log(`[DEBUG] Email verification required: ${shouldVerifyEmail}`);

    const encodedUserData = encodeURIComponent(JSON.stringify(userData));
    const verificationFlag = shouldVerifyEmail ? '&requires_verification=true' : '';

    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&user=${encodedUserData}&success=true${verificationFlag}`;
    console.log(`[DEBUG] Redirecting to: ${redirectUrl}`);

    res.redirect(redirectUrl);

  } catch (error) {
    console.error('[ERROR] Error in Google callback success:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=server_error`);
  }
};

// ============================================================================
// 2. VERIFICATION LOGIC
// ============================================================================

const verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    console.log('🔍 [AUTH CONTROLLER] Verify email code request:', { email, code });

    if (!email || !code) return res.status(400).json({ success: false, message: 'Email dan kode verifikasi harus diisi' });
    if (code.length !== 6 || !/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: 'Kode verifikasi harus 6 digit angka' });

    const result = await authService.verifyEmailCode(email, code);

    if (result.success) {
      console.log('✅ [AUTH CONTROLLER] Email verification successful:', email);
      // Kirim welcome email
      try {
        await emailService.sendWelcomeEmail(email, result.user.fullName || 'User', result.user.userType);
        console.log('✅ [AUTH CONTROLLER] Welcome email sent to:', email);
      } catch (emailError) {
        console.log('⚠️ [AUTH CONTROLLER] Failed to send welcome email:', emailError.message);
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
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Verify email code error:', error);
    if (error.message.includes('tidak valid') || error.message.includes('kadaluarsa')) return res.status(400).json({ success: false, message: error.message });
    if (error.message.includes('Terlalu banyak')) return res.status(429).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat verifikasi email' });
  }
};

const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('🔍 [AUTH CONTROLLER] Resend verification code request:', email);

    if (!email) return res.status(400).json({ success: false, message: 'Email harus diisi' });

    const result = await authService.resendVerificationCode(email);

    if (result.success) {
      console.log('✅ [AUTH CONTROLLER] Verification code resent to:', email);
      res.status(200).json({ success: true, message: result.message });
    } else {
      console.log('❌ [AUTH CONTROLLER] Resend verification code failed:', result.message);
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Resend verification code error:', error);
    if (error.message === 'Email sudah terverifikasi' || error.message === 'User tidak ditemukan') return res.status(400).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat mengirim ulang kode' });
  }
};

const checkEmailVerification = async (req, res) => {
  try {
    const { email } = req.params;
    console.log('🔍 [AUTH CONTROLLER] Check email verification status:', email);

    if (!email) return res.status(400).json({ success: false, message: 'Email harus diisi' });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, isEmailVerified: true, status: true, verificationCodeExpires: true }
    });

    if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

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
    console.error('❌ [AUTH CONTROLLER] Check verification error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// ============================================================================
// 3. REGISTER & LOGIN LOGIC
// ============================================================================

const register = async (req, res) => {
  try {
    const { fullName, nim, email, password } = req.body;
    console.log('🔍 [AUTH CONTROLLER] Register attempt:', { fullName, nim, email });

    if (!fullName || !nim || !email || !password) return res.status(400).json({ success: false, message: 'Semua field harus diisi' });

    const result = await authService.register({ fullName, nim, email, password });

    if (result.success) {
      console.log('✅ [AUTH CONTROLLER] Registration successful:', email);
      if (result.requiresVerification) {
        res.status(201).json({ success: true, message: result.message, requiresVerification: true, data: { email: result.data.email } });
      } else {
        res.status(201).json(result);
      }
    } else {
      console.log('❌ [AUTH CONTROLLER] Registration failed:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Register error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat registrasi' });
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    console.log(`[DEBUG] Login attempt for identifier: ${identifier}`);

    if (!identifier || !password) return res.status(400).json({ success: false, message: 'Email/NIM dan password harus diisi' });

    const result = await authService.login(identifier, password, ipAddress, userAgent);

    if (result.success) {
      req.login({ id: result.user.id, email: result.user.email }, (err) => {
        if (err) console.log('[DEBUG] Passport login in regular login failed:', err);
      });

      console.log(`[DEBUG] Login successful for user: ${result.user.email}`);

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
      if (result.requiresVerification) {
        return res.status(403).json({ success: false, message: result.message, requiresVerification: true, email: result.email });
      }
      res.status(401).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('[ERROR] Login controller error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat login' });
  }
};

const registerWithEmail = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('🔍 [AUTH CONTROLLER] Register with email request:', email);

    if (!email) return res.status(400).json({ success: false, message: 'Email harus diisi' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Format email tidak valid' });

    const result = await authService.registerWithEmail(email);

    if (result.success) {
      console.log('✅ [AUTH CONTROLLER] Email registration successful:', email);
      res.status(201).json({ success: true, message: result.message, requiresVerification: true, data: { email: result.data.email } });
    } else {
      console.log('❌ [AUTH CONTROLLER] Email registration failed:', result.message);
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Register with email error:', error);
    if (error.message === 'Email already registered') return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat registrasi' });
  }
};

// ============================================================================
// 4. STUDENT & PROFILE MANAGEMENT
// ============================================================================

const verifyStudent = async (req, res) => {
  try {
    const { nim, fullName, birthDate } = req.body;
    const userId = req.user.id;
    console.log('🔍 [AUTH CONTROLLER] Verifying student:', { nim, fullName, birthDate, userId });

    if (!nim || !fullName || !birthDate) return res.status(400).json({ success: false, message: 'Data tidak lengkap' });

    const validationResult = await academicService.validateStudent(nim, fullName, birthDate);

    if (validationResult.valid) {
      console.log('✅ [AUTH CONTROLLER] Student validation successful:', validationResult.data);
      await authService.updateUserVerification(userId, { nim: validationResult.data.nim, fullName: validationResult.data.fullName });
      res.json({ success: true, valid: true, data: validationResult.data, message: validationResult.message });
    } else {
      console.log('❌ [AUTH CONTROLLER] Student validation failed');
      res.status(400).json({ success: false, valid: false, message: validationResult.message });
    }
  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Verify student error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat verifikasi' });
  }
};

const updateVerification = async (req, res) => {
  try {
    const { nim, fullName } = req.body;
    const userId = req.user.id;
    console.log('🔍 [AUTH CONTROLLER] Updating verification:', { userId, nim, fullName });

    await authService.updateUserVerification(req.user.id, { nim, fullName });
    res.json({ success: true, message: 'Status verifikasi berhasil diperbarui' });
  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Update verification error:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui status verifikasi' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { email, nim, fullName } = req.body;
    const userId = req.user.id;
    console.log('🔍 [AUTH CONTROLLER] Updating profile:', { userId, email, nim, fullName });

    await authService.updateUserProfile(req.user.id, { email, nim, fullName });
    res.json({ success: true, message: 'Profile berhasil diperbarui' });
  } catch (error) {
    console.error('❌ [AUTH CONTROLLER] Update profile error:', error);
    res.status(500).json({ success: false, message: 'Gagal memperbarui profile' });
  }
};

const checkNIM = async (req, res) => {
  try {
    const { nim } = req.params;
    if (!nim) return res.status(400).json({ success: false, message: 'NIM harus diisi' });
    const result = await authService.checkNIMAvailability(nim);
    res.json({ success: true, available: result.available, message: result.message });
  } catch (error) {
    console.error('[ERROR] Check NIM controller error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat mengecek NIM' });
  }
};

// ============================================================================
// 5. SESSION UTILS
// ============================================================================

const verify = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ valid: false, message: 'Token tidak provided' });

    console.log(`[DEBUG] Token verification attempt`);

    const result = await authService.verifySession(token);
    if (result.valid) {
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
      res.status(401).json({ success: false, valid: false, message: result.message });
    }
  } catch (error) {
    console.error('[ERROR] Verify controller error:', error);
    res.status(500).json({ success: false, valid: false, message: 'Terjadi kesalahan server saat verifikasi token' });
  }
};

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

const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(400).json({ success: false, message: 'Token tidak provided' });

    console.log(`[DEBUG] Logout attempt for user: ${req.user?.id}`);

    req.logout((err) => {
      if (err) console.log('[DEBUG] Passport logout error:', err);
    });

    const result = await authService.logout(token);
    req.session.destroy((err) => {
      if (err) console.log('[DEBUG] Session destroy error:', err);
    });

    if (result.success) res.json({ success: true, message: result.message });
    else res.status(400).json({ success: false, message: result.message });
  } catch (error) {
    console.error('[ERROR] Logout controller error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat logout' });
  }
};

const getProfile = async (req, res) => {
  try {
    console.log('[DEBUG] Get profile - User:', req.user);
    if (!req.user) return res.status(401).json({ success: false, message: 'User tidak terautentikasi' });
    console.log(`[DEBUG] Get profile for user: ${req.user.email}`);
    res.json({ success: true, user: req.user });
  } catch (error) {
    console.error('[ERROR] Get profile controller error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat mengambil profil' });
  }
};

const checkAuth = (req, res) => {
  console.log('[DEBUG] Check auth - Session ID:', req.sessionID);
  console.log('[DEBUG] Check auth - User:', req.user);
  res.json({ authenticated: req.isAuthenticated ? req.isAuthenticated() : false, user: req.user || null, sessionID: req.sessionID });
};

// ============================================================================
// 🚨 CHAT FEATURE (FIXED: TYPE SAFETY, DEBUGGING & SMART TITLE)
// ============================================================================
// ============================================================================
// 🚨 CHAT FEATURE (FIXED: TYPE SAFETY, DEBUGGING & SMART TITLE & STREAMING)
// ============================================================================
const chat = async (req, res) => {
  const abortController = new AbortController();

  // 🛑 Listener untuk pembatalan (Refresh/Cancel)
  req.on('close', () => {
    if (!res.writableEnded) {
      console.log('⚠️ [AUTH CHAT CONTROLLER] Request closed by client before completion. Aborting AI...');
      abortController.abort();
    }
  });

  try {
    const userId = parseInt(req.user.id);
    const { message, conversationId, stream = true } = req.body; // Default stream: true

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    console.log(`👤 [AUTH CHAT] User: ${userId} | Msg: "${message}" | Stream: ${stream}`);

    // Step 1: Retrieve History
    let targetConversationId = conversationId ? parseInt(conversationId) : undefined;
    let conversationHistory = [];

    // Find last conversation to get history
    const lastConversation = await prisma.conversation.findFirst({
      where: {
        userId: userId,
        id: targetConversationId
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 6,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (lastConversation) {
      targetConversationId = lastConversation.id;
      // console.log(`📂 [AUTH CHAT] Found Conv ID: ${targetConversationId} | Msgs: ${lastConversation.messages.length}`);
      conversationHistory = lastConversation.messages.reverse().map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.content
      }));
    } else {
      console.log(`📂 [AUTH CHAT] No previous conversation found. Starting new.`);
    }

    // Step 2: RAG Process (Calling Service)
    const ragResult = await ragService.answerQuestion(
      message,
      conversationHistory,
      { abortSignal: abortController.signal, stream: stream }
    );

    // ===================================
    // A. STREAMING HANDLER
    // ===================================
    if (stream && ragResult.isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullBotAnswer = "";
      let tokenUsage = 0;

      // Send Meta
      res.write(`data: ${JSON.stringify({ type: 'meta', docs: ragResult.docsDetail, conversationId: targetConversationId })}\n\n`);

      // Stream Loop
      try {
        for await (const chunk of ragResult.stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullBotAnswer += content;
            res.write(`data: ${JSON.stringify({ type: 'content', chunk: content })}\n\n`);
          }
          if (chunk.usage) tokenUsage = chunk.usage.total_tokens;
        }
      } catch (streamErr) {
        console.error("Stream interrupted", streamErr);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`);
      }

      if (!tokenUsage) tokenUsage = Math.ceil((message.length + fullBotAnswer.length) / 4) + 100;

      // Finalize
      res.write(`data: ${JSON.stringify({ type: 'done', usage: tokenUsage })}\n\n`);
      res.end();

      // --- START BACKGROUND SAVE ---
      // Save to DB AFTER Response is sent (Non-blocking)
      const metricsGenTime = ragResult.metrics?.genTime || 0; // Might be missing in stream, can use 0 or estimate

      await handleDbSave(userId, targetConversationId, message, fullBotAnswer, tokenUsage, metricsGenTime, req, abortController);
      return;
    }

    // ===================================
    // B. FALLBACK (JSON)
    // ===================================
    const finalAnswer = ragResult.answer;
    const tokensUsed = ragResult.usage ? ragResult.usage.total_tokens : 0;
    const metricsGenTime = ragResult.metrics?.genTime || 0;

    // Use Helper for DB Save
    // Note: For JSON response, we specifically need the ID to return it, so we must await save FIRST if new chat
    // But helper approach might need adjustment. Let's keep logic inline for JSON to be safe about Conversation ID return.

    // ... Logic saving reused from Helper but we need the ID immediately ...
    const savedInfo = await handleDbSave(userId, targetConversationId, message, finalAnswer, tokensUsed, metricsGenTime, req, abortController);

    res.json({
      success: true,
      reply: finalAnswer,
      conversationId: savedInfo.conversationId,
      usage: { total_tokens: tokensUsed },
      title: savedInfo.title // Return title if new
    });

  } catch (error) {
    console.error("❌ [AUTH CHAT ERROR]", error);
    if (!res.headersSent) res.status(500).json({ success: false, message: "Server Error" });
    else res.end();
  }
};

// Helper: Handle DB Persistence (New Chat Creation / Message Saving)
async function handleDbSave(userId, conversationId, userMsg, botMsg, tokens, responseTime, req, abortController) {
  try {
    // 🛑 Abort Check
    if (req.socket.destroyed || abortController.signal.aborted) {
      console.log('🛑 [DB SAVE] Request aborted. Skipping DB save.');
      return { conversationId };
    }

    let finalConvId = conversationId;
    let titleResult = null;

    // Create Conversation if needed
    if (!finalConvId) {
      let smartTitle = userMsg.substring(0, 30) + "...";
      try {
        if (openaiService.generateTitle) {
          smartTitle = await openaiService.generateTitle(userMsg); // Generate from User Msg only (Fast)
        }
      } catch (e) { }

      const newConv = await prisma.conversation.create({
        data: {
          userId: userId,
          title: smartTitle
        }
      });
      finalConvId = newConv.id;
      titleResult = smartTitle;
      console.log(`✅ [DB] New Conversation Created: ${finalConvId}`);
    } else {
      await prisma.conversation.update({
        where: { id: finalConvId },
        data: { updatedAt: new Date() }
      });
    }

    // Save Messages
    await prisma.$transaction([
      prisma.message.create({
        data: { conversationId: finalConvId, role: 'user', content: userMsg }
      }),
      prisma.message.create({
        data: { conversationId: finalConvId, role: 'bot', content: botMsg, responseTime: parseFloat(responseTime || 0) }
      })
    ]);

    // Track Token Usage (Rate Limit Service)
    // Note: We don't await this to block return if we are in background mode, but for helper we await.
    // It's low latency DB call usually.
    // await rateLimitService.trackTokenUsage(...) -> Already imported top of file? No?
    // Check imports... `rateLimitService` IS imported?
    const rateLimitService = require('../services/rateLimitService'); // Ensure persistence
    await rateLimitService.trackTokenUsage(userId, req.ip, tokens);

    return { conversationId: finalConvId, title: titleResult };

  } catch (e) {
    console.error("❌ [DB SAVE ERROR]", e.message);
    return { conversationId };
  }
}

module.exports = {
  googleAuth, googleCallback, googleCallbackSuccess,
  login, register, registerWithEmail,
  verifyEmailCode, resendVerificationCode, checkEmailVerification,
  verifyStudent, updateVerification, updateProfile, checkNIM,
  logout, verify, getProfile, checkAuth, healthCheck,
  chat // ✅ Export chat
};