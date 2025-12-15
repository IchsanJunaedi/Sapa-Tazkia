const authService = require('../services/authService');
const academicService = require('../services/academicService');
const emailService = require('../services/emailService');
const ragService = require('../services/ragService'); // ✅ IMPORT RAG SERVICE
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================================================
// 1. AUTHENTICATION (Google, Callback, Login, Register)
// ============================================================================

const googleAuth = (req, res, next) => {
  authService.passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
};

const googleCallback = (req, res, next) => {
  authService.passport.authenticate('google', { failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed` })(req, res, next);
};

const googleCallbackSuccess = async (req, res) => {
  try {
    if (!req.user) return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_user_session`);
    
    const userEmail = req.user.email;
    const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });
    const isNewUser = !existingUser || (existingUser.authMethod === 'google' && (new Date() - new Date(existingUser.createdAt)) < 300000);
    const shouldVerifyEmail = isNewUser;
    
    const token = authService.generateToken(req.user.id);
    await authService.logoutAllUserSessions(req.user.id);
    await authService.createSession(req.user.id, token, req.ip, req.get('User-Agent'));

    const userData = { ...req.user, isEmailVerified: shouldVerifyEmail ? false : req.user.isEmailVerified };
    const encodedUserData = encodeURIComponent(JSON.stringify(userData));
    const verificationFlag = shouldVerifyEmail ? '&requires_verification=true' : '';
    
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${encodedUserData}&success=true${verificationFlag}`);
  } catch (error) {
    res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
  }
};

// ... (Functions for Login, Register, Verify Email, etc. remain the same - ensure you keep your original logic here) ...
const verifyEmailCode = async (req, res) => { /* Use your original code */ };
const resendVerificationCode = async (req, res) => { /* Use your original code */ };
const checkEmailVerification = async (req, res) => { /* Use your original code */ };
const registerWithEmail = async (req, res) => { /* Use your original code */ };
const verifyStudent = async (req, res) => { /* Use your original code */ };
const updateVerification = async (req, res) => { /* Use your original code */ };
const updateProfile = async (req, res) => { /* Use your original code */ };
const checkNIM = async (req, res) => { /* Use your original code */ };
const verify = async (req, res) => { /* Use your original code */ };
const logout = async (req, res) => { /* Use your original code */ };
const getProfile = async (req, res) => { /* Use your original code */ };
const checkAuth = (req, res) => { res.json({ authenticated: req.isAuthenticated(), user: req.user }) };
const healthCheck = (req, res) => { res.json({ status: 'ok' }) };

const register = async (req, res) => {
    try {
        const { fullName, nim, email, password } = req.body;
        if (!fullName || !nim || !email || !password) return res.status(400).json({ success: false, message: 'All fields must be filled' });
        const result = await authService.register({ fullName, nim, email, password });
        if (result.success) res.status(201).json(result);
        else res.status(400).json(result);
    } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, message: 'Email/NIM and password required' });
    const result = await authService.login(identifier, password, req.ip, req.get('User-Agent'));
    if (result.success) {
      req.login({ id: result.user.id, email: result.user.email }, (err) => {});
      res.status(200).json({ success: true, message: result.message, token: result.token, user: result.user });
    } else {
      res.status(result.requiresVerification ? 403 : 401).json({ success: false, message: result.message, ...result });
    }
  } catch (error) { res.status(500).json({ success: false, message: 'Login server error' }); }
};

// ============================================================================
// 🚨 CHAT FEATURE (FIXED: TYPE SAFETY & DEBUGGING)
// ============================================================================
const chat = async (req, res) => {
    try {
        // ✅ FIX 1: Ensure User ID is an INTEGER
        const userId = parseInt(req.user.id); 
        const { message, conversationId } = req.body;

        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: "Message is required" });
        }

        console.log(`👤 [AUTH CHAT] User: ${userId} | Msg: "${message}"`);

        // Step 1: Retrieve History
        let targetConversationId = conversationId ? parseInt(conversationId) : undefined;
        let conversationHistory = [];

        // Find last conversation
        const lastConversation = await prisma.conversation.findFirst({
            where: { 
                userId: userId, // Ensure this matches DB type (Int)
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
            console.log(`📂 [AUTH CHAT] Found Conv ID: ${targetConversationId} | Msgs: ${lastConversation.messages.length}`);
            
            conversationHistory = lastConversation.messages.reverse().map(m => ({
                role: m.role === 'bot' ? 'assistant' : 'user', 
                content: m.content
            }));
        } else {
            console.log(`📂 [AUTH CHAT] No previous conversation found. Starting new.`);
        }

        // Step 2: RAG Process
        const ragResult = await ragService.answerQuestion(message, conversationHistory);
        const finalAnswer = ragResult.answer;
        const tokensUsed = ragResult.usage ? ragResult.usage.total_tokens : 0;

        // Step 3: Save to DB
        try {
            if (!targetConversationId) {
                const newConv = await prisma.conversation.create({
                    data: {
                        userId: userId,
                        title: message.substring(0, 30) + "..."
                    }
                });
                targetConversationId = newConv.id;
            } else {
                await prisma.conversation.update({
                    where: { id: targetConversationId },
                    data: { updatedAt: new Date() }
                });
            }

            // Save Chat Batch
            await prisma.$transaction([
                prisma.message.create({
                    data: { conversationId: targetConversationId, role: 'user', content: message }
                }),
                prisma.message.create({
                    data: { conversationId: targetConversationId, role: 'bot', content: finalAnswer, responseTime: parseFloat(ragResult.metrics?.genTime || 0) }
                })
            ]);
            
            console.log(`💾 [AUTH CHAT] Saved to Conv ID: ${targetConversationId}`);

        } catch (saveError) {
            console.error(`❌ [AUTH CHAT] DB Save Error:`, saveError.message);
        }

        res.json({
            success: true,
            reply: finalAnswer,
            conversationId: targetConversationId, 
            usage: { total_tokens: tokensUsed }
        });

    } catch (error) {
        console.error("❌ [AUTH CHAT ERROR]", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

module.exports = {
  googleAuth, googleCallback, googleCallbackSuccess,
  login, register, registerWithEmail,
  verifyEmailCode, resendVerificationCode, checkEmailVerification,
  verifyStudent, updateVerification, updateProfile, checkNIM,
  logout, verify, getProfile, checkAuth, healthCheck,
  chat // ✅ Export chat
};