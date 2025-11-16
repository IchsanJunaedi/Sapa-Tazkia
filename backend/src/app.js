const express = require('express');
const session = require('express-session');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');
const guestRoutes = require('./routes/guestRoutes');

// Import services
const authService = require('./services/authService');

const app = express();
const prisma = new PrismaClient();

// ========================================================
// MIDDLEWARE SETUP - DIPERBAIKI UNTUK SUPPORT PATCH
// ========================================================

// CORS configuration - Updated for better security
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://192.168.100.48:3000',
  'http://192.168.100.11:3000'
];

// ✅ PERBAIKAN: Enhanced CORS configuration dengan PATCH method
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, postman, server-to-server)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      const msg = `CORS policy: Origin ${origin} not allowed`;
      console.log('🔒 CORS Blocked:', origin);
      return callback(new Error(msg), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Length', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// ✅ PERBAIKAN: Handle preflight requests dengan PATCH support
app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('CORS not allowed'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ]
}));

// Body parser middleware with better limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100
}));

// Security headers middleware
app.use((req, res, next) => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // CORS headers are handled by cors middleware
  next();
});

// Session configuration - Enhanced security
app.use(session({
  name: 'sapa-tazkia.sid',
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-session-secret-12345-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: process.env.NODE_ENV === 'production' ? '.tazkia.ac.id' : undefined
  },
  store: process.env.NODE_ENV === 'production' ? 
    new session.MemoryStore() : new session.MemoryStore()
}));

// Passport middleware
app.use(authService.passport.initialize());
app.use(authService.passport.session());

// Request logging middleware
app.use((req, res, next) => {
  console.log('🌐 [REQUEST]', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// ========================================================
// BASIC ROUTES & HEALTH CHECKS
// ========================================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Sapa Tazkia Backend API',
    version: '3.2.0', // ✅ UPDATE VERSION
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      authentication: true,
      emailVerification: true, // ✅ FEATURE BARU
      googleOAuth: !!process.env.GOOGLE_CLIENT_ID,
      aiChat: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'AIzaSy.....')
    },
    endpoints: {
      auth: '/api/auth',
      ai: '/api/ai',
      guest: '/api/guest',
      health: '/health',
      status: '/status'
    }
  });
});

// Health check endpoint - Enhanced
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {}
  };

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = 'Connected';
    
    // Test Gemini connection if API key exists
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'AIzaSy.....') {
      healthCheck.services.gemini = 'Configured';
    } else {
      healthCheck.services.gemini = 'Not Configured';
    }

    // Test email service configuration
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      healthCheck.services.email = 'Configured';
    } else {
      healthCheck.services.email = 'Not Configured';
    }
    
    res.json(healthCheck);
  } catch (error) {
    console.error('Health check error:', error);
    healthCheck.status = 'ERROR';
    healthCheck.services.database = 'Disconnected';
    healthCheck.error = error.message;
    
    res.status(503).json(healthCheck);
  }
});

// Status endpoint with more details
app.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    serverTime: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    features: {
      authentication: !!process.env.GOOGLE_CLIENT_ID,
      emailVerification: true, // ✅ FEATURE BARU
      ai: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'AIzaSy.....'),
      database: !!process.env.DATABASE_URL,
      emailService: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
    }
  });
});

// Session debug endpoint
app.get('/session-debug', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    sessionExists: !!req.session,
    user: req.user || null,
    authenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    passport: {
      initialized: !!authService.passport,
      session: !!req._passport
    },
    cookies: req.headers.cookie || 'No cookies'
  });
});

// Simple test route
app.get('/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'Test route working!',
    session: req.sessionID ? 'Active' : 'No session',
    timestamp: new Date().toISOString(),
    headers: {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent']
    }
  });
});

// ========================================================
// API ROUTES - UPDATED WITH BETTER ORGANIZATION
// ========================================================

// Auth routes - User authentication
app.use('/api/auth', authRoutes);

// Guest routes - For non-authenticated users
app.use('/api/guest', guestRoutes);

// AI routes - For authenticated AI interactions
app.use('/api/ai', aiRoutes);

// ========================================================
// ERROR HANDLING MIDDLEWARE - ENHANCED
// ========================================================

// 404 Handler - Enhanced with better error information
app.use('*', (req, res) => {
  console.log('❌ [404] Route not found:', req.method, req.originalUrl);
  
  res.status(404).json({ 
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      auth: [
        'POST /api/auth/login',
        'POST /api/auth/register', 
        'POST /api/auth/register-email', // ✅ ENDPOINT BARU
        'POST /api/auth/verify-email', // ✅ ENDPOINT BARU
        'POST /api/auth/resend-verification', // ✅ ENDPOINT BARU
        'GET  /api/auth/check-verification/:email', // ✅ ENDPOINT BARU
        'GET  /api/auth/google',
        'GET  /api/auth/google/callback',
        'POST /api/auth/logout',
        'GET  /api/auth/me',
        'PATCH /api/auth/update-profile',
        'POST /api/auth/verify-student',
        'PATCH /api/auth/update-verification',
        'GET  /api/auth/check-nim/:nim'
      ],
      guest: [
        'POST /api/guest/chat',
        'GET  /api/guest/conversation/:sessionId'
      ],
      ai: [
        'POST /api/ai/chat',
        'GET  /api/ai/conversations',
        'GET  /api/ai/history/:chatId',
        'POST /api/ai/test-ai',
        'GET  /api/ai/test-gemini'
      ],
      system: [
        'GET  /',
        'GET  /health',
        'GET  /status',
        'GET  /test',
        'GET  /session-debug'
      ]
    }
  });
});

// Global error handler - Enhanced with better logging
app.use((err, req, res, next) => {
  console.error('🔴 [GLOBAL ERROR]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // CORS error
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'CORS Error: Origin not allowed',
      allowedOrigins: allowedOrigins,
      yourOrigin: req.headers.origin
    });
  }
  
  // Prisma database error
  if (err.code && err.code.startsWith('P')) {
    console.error('🔴 [DATABASE ERROR]', err);
    return res.status(500).json({
      success: false,
      message: 'Database error occurred',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      code: err.code
    });
  }
  
  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication token expired'
    });
  }

  // Default error response
  const errorResponse = {
    success: false,
    message: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.details = err;
  }

  res.status(err.status || 500).json(errorResponse);
});

// ========================================================
// GRACEFUL SHUTDOWN - ENHANCED
// ========================================================

const gracefulShutdown = async (signal) => {
  console.log(`\n🔴 Received ${signal}. Shutting down gracefully...`);
  
  try {
    // Close database connection
    await prisma.$disconnect();
    console.log('✅ Database disconnected.');
    
    // Close server
    if (server) {
      server.close(() => {
        console.log('✅ HTTP server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle different shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🔴 UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

// ========================================================
// SERVER START
// ========================================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log('🚀 SAPA TAZKIA BACKEND SERVER STARTED SUCCESSFULLY');
  console.log('='.repeat(70));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Auth: ${process.env.GOOGLE_CLIENT_ID ? '✅ Google OAuth Ready' : '❌ Local Auth Only'}`);
  console.log(`📧 Email Verification: ${process.env.EMAIL_USER ? '✅ Email Service Ready' : '❌ Email Disabled'}`); // ✅ BARU
  console.log(`🤖 AI: ${process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'AIzaSy.....' ? '✅ Gemini AI Ready' : '❌ AI Disabled'}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ No DB Config'}`);
  console.log(`🔄 CORS: ✅ PATCH Method Enabled`);
  console.log('');
  console.log('📋 AVAILABLE ENDPOINTS:');
  console.log('   GET  / .......................... API Root');
  console.log('   GET  /health ................... Health check');
  console.log('   GET  /status ................... System status');
  console.log('   GET  /session-debug ............ Session debug');
  console.log('   GET  /test .................... Test route');
  console.log('');
  console.log('🔐 AUTH ENDPOINTS:');
  console.log('   POST /api/auth/login .......... User login');
  console.log('   POST /api/auth/register ....... User registration');
  console.log('   POST /api/auth/register-email .. Email registration'); 
  console.log('   POST /api/auth/verify-email .... Email verification'); 
  console.log('   POST /api/auth/resend-verification . Resend code'); 
  console.log('   GET  /api/auth/check-verification/:email . Check status'); 
  console.log('   GET  /api/auth/google ......... Google OAuth');
  console.log('   GET  /api/auth/google/callback . Google Callback');
  console.log('   POST /api/auth/logout ......... User logout');
  console.log('   GET  /api/auth/me ............ Get user profile');
  console.log('   PATCH /api/auth/update-profile . Update profile');
  console.log('   POST /api/auth/verify-student .. Verify student data');
  console.log('   PATCH /api/auth/update-verification . Update verification');
  console.log('   GET  /api/auth/check-nim/:nim . Check NIM availability');
  console.log('');
  console.log('👤 GUEST ENDPOINTS:');
  console.log('   POST /api/guest/chat .......... Guest Chat');
  console.log('   GET  /api/guest/conversation/:sessionId ... Guest History');
  console.log('');
  console.log('🤖 AI ENDPOINTS:');
  console.log('   POST /api/ai/chat ............ Authenticated Chat');
  console.log('   GET  /api/ai/conversations .... Get conversations');
  console.log('   GET  /api/ai/history/:chatId .. Get chat history');
  console.log('   POST /api/ai/test-ai ......... Test AI');
  console.log('   GET  /api/ai/test-gemini ..... Test Gemini Connection');
  console.log('');
  console.log('🛡️  SECURITY FEATURES:');
  console.log('   ✅ CORS Protection');
  console.log('   ✅ Session Management');
  console.log('   ✅ Email Verification System'); 
  console.log('   ✅ Input Validation');
  console.log('   ✅ Error Handling');
  console.log('   ✅ Graceful Shutdown');
  console.log('='.repeat(70));
});

module.exports = app;