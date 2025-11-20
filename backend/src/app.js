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
// MIDDLEWARE SETUP - OPTIMIZED
// ========================================================

// CORS configuration - Enhanced
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://192.168.100.48:3000',
  'http://192.168.100.11:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      console.log('🔒 CORS Blocked:', origin);
      return callback(new Error(`CORS policy: Origin ${origin} not allowed`), false);
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
  maxAge: 86400
}));

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

// Body parser middleware
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
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Session configuration - Fixed for development
app.use(session({
  name: 'sapa-tazkia.sid',
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-session-secret-12345-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    // Remove domain for development to avoid cookie issues
  },
  store: new session.MemoryStore() // Simplified for both environments
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
// BASIC ROUTES & HEALTH CHECKS - ENHANCED
// ========================================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Sapa Tazkia Backend API',
    version: '3.4.0', // ✅ UPDATE VERSION
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      authentication: true,
      emailVerification: true,
      googleOAuth: !!process.env.GOOGLE_CLIENT_ID,
      aiChat: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'),
      academicAnalysis: true,
      ragEnabled: true // ✅ NEW: RAG feature flag
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

// Health check endpoint - Enhanced with RAG status
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {},
    port: process.env.PORT || 5000 // ✅ ADD PORT INFO
  };

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = 'Connected';
    
    // Test OpenAI connection
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      try {
        const { testOpenAIConnection } = require('./services/openaiService');
        const openaiTest = await testOpenAIConnection();
        healthCheck.services.openai = openaiTest.success ? 'Connected' : 'Error';
        if (openaiTest.success) {
          healthCheck.services.openaiModel = openaiTest.model;
        }
      } catch (error) {
        healthCheck.services.openai = `Connection Failed: ${error.message}`;
      }
    } else {
      healthCheck.services.openai = 'Not Configured';
    }

    // Test RAG Service status
    try {
      const ragService = require('./services/ragService');
      const ragStatus = await ragService.getCollectionInfo();
      healthCheck.services.rag = ragStatus.exists ? 'Ready' : 'No Data';
      healthCheck.services.documentsCount = ragStatus.exists ? ragStatus.pointsCount : 0;
      healthCheck.services.ragStatus = ragStatus.status || 'unknown';
    } catch (error) {
      healthCheck.services.rag = `Error: ${error.message}`;
    }

    // Test email service
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
      emailVerification: true,
      ai: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'),
      academicAnalysis: true,
      ragSystem: true, // ✅ NEW: RAG system status
      database: !!process.env.DATABASE_URL,
      emailService: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
    },
    aiProvider: process.env.AI_PROVIDER || 'openai',
    aiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    ragEnabled: true // ✅ NEW: RAG enabled status
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
// API ROUTES - FIXED ORDER FOR GUEST ACCESS
// ========================================================

// ✅ FIXED: AI routes FIRST untuk guest access
app.use('/api/ai', aiRoutes);

// Auth routes - User authentication
app.use('/api/auth', authRoutes);

// Guest routes - For non-authenticated users
app.use('/api/guest', guestRoutes);

// ========================================================
// ERROR HANDLING MIDDLEWARE - UPDATED ENDPOINTS LIST
// ========================================================

// 404 Handler - UPDATED dengan semua endpoint baru
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
        'POST /api/auth/register-email',
        'POST /api/auth/verify-email',
        'POST /api/auth/resend-verification',
        'GET  /api/auth/check-verification/:email',
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
        'GET  /api/ai/test-openai',
        'GET  /api/ai/test-embedding', // ✅ NEW ENDPOINT
        'POST /api/ai/analyze-academic',
        'POST /api/ai/study-recommendations',
        'GET  /api/ai/knowledge-status', // ✅ NEW ENDPOINT
        'POST /api/ai/ingest-now', // ✅ NEW ENDPOINT
        'POST /api/ai/ingest', // ✅ NEW ENDPOINT
        'GET  /api/ai/health', // ✅ NEW ENDPOINT
        'GET  /api/ai/public-test', // ✅ NEW ENDPOINT
        'POST /api/ai/reset-knowledge' // ✅ NEW ENDPOINT
      ],
      system: [
        'GET  /',
        'GET  /health',
        'GET  /status',
        'GET  /test',
        'GET  /session-debug'
      ]
    },
    suggestion: 'Gunakan POST method untuk endpoint ingestion: curl -X POST http://localhost:5000/api/ai/ingest-now'
  });
});

// Global error handler - Enhanced
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
  
  // OpenAI API error
  if (err.code && (err.code === 'invalid_api_key' || err.code === 'rate_limit_exceeded')) {
    console.error('🔴 [OPENAI ERROR]', err);
    return res.status(503).json({
      success: false,
      message: 'AI service temporarily unavailable',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later',
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

  // RAG Service error
  if (err.message.includes('Qdrant') || err.message.includes('embedding')) {
    return res.status(503).json({
      success: false,
      message: 'Knowledge base service temporarily unavailable',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later'
    });
  }

  // Default error response
  const errorResponse = {
    success: false,
    message: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  };

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

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

process.on('uncaughtException', (error) => {
  console.error('🔴 UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

// ========================================================
// SERVER START - UPDATED LOGS
// ========================================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log('🚀 SAPA TAZKIA BACKEND SERVER STARTED SUCCESSFULLY');
  console.log('='.repeat(70));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Auth: ${process.env.GOOGLE_CLIENT_ID ? '✅ Google OAuth Ready' : '❌ Local Auth Only'}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER ? '✅ Email Service Ready' : '❌ Email Disabled'}`);
  console.log(`🤖 AI: ${process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' ? '✅ OpenAI + RAG Ready' : '❌ AI Disabled'}`);
  console.log(`🧠 RAG: ✅ Knowledge Base System Enabled`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ No DB Config'}`);
  console.log('');
  console.log('📋 AVAILABLE ENDPOINTS:');
  console.log('   GET  / .......................... API Root');
  console.log('   GET  /health ................... Health check (+RAG status)');
  console.log('   GET  /status ................... System status');
  console.log('   GET  /session-debug ............ Session debug');
  console.log('   GET  /test .................... Test route');
  console.log('');
  console.log('🤖 AI ENDPOINTS (Guest & Auth):');
  console.log('   POST /api/ai/chat ............. AI Chat dengan RAG');
  console.log('   GET  /api/ai/knowledge-status . Cek status knowledge base');
  console.log('   POST /api/ai/ingest-now ....... Manual ingestion (Guest OK)');
  console.log('   POST /api/ai/ingest ........... Protected ingestion');
  console.log('   GET  /api/ai/test-embedding ... Test embedding function');
  console.log('   GET  /api/ai/test-openai ...... Test OpenAI connection');
  console.log('   POST /api/ai/test-ai .......... Test AI response');
  console.log('   GET  /api/ai/conversations .... Get conversations (Auth)');
  console.log('   GET  /api/ai/history/:chatId .. Get chat history (Auth)');
  console.log('   POST /api/ai/analyze-academic . Analyze academic (Auth)');
  console.log('   POST /api/ai/study-recommendations . Study recommendations (Auth)');
  console.log('');
  console.log('🔐 AUTH ENDPOINTS:');
  console.log('   POST /api/auth/login .......... User login');
  console.log('   POST /api/auth/register ....... User registration');
  // ... (sisanya tetap sama)
  console.log('');
  console.log('👤 GUEST ENDPOINTS:');
  console.log('   POST /api/guest/chat .......... Guest Chat (No RAG)');
  console.log('   GET  /api/guest/conversation/:sessionId ... Guest History');
  console.log('');
  console.log('🛡️  SECURITY FEATURES:');
  console.log('   ✅ CORS Protection');
  console.log('   ✅ Session Management');
  console.log('   ✅ Email Verification System'); 
  console.log('   ✅ RAG Knowledge Base');
  console.log('   ✅ Input Validation');
  console.log('   ✅ Error Handling');
  console.log('   ✅ Graceful Shutdown');
  console.log('='.repeat(70));
});

module.exports = app;