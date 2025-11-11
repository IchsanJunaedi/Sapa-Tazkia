const express = require('express');
const session = require('express-session');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// Import services dan passport
const authService = require('./services/authService');

// Import routes - ✅ HANYA IMPORT ROUTES YANG ADA
const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');
// ❌ HAPUS academicRoutes dan chatRoutes karena tidak ada

const app = express();
const prisma = new PrismaClient();

// ========================================================
// MIDDLEWARE SETUP
// ========================================================

// CORS configuration - ✅ PERBAIKI UNTUK MULTIPLE ORIGINS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://192.168.100.48:3000', // IP dari kode Anda
  'http://192.168.100.11:3000'  // <-- SAYA TAMBAHKAN IP INI dari error Anda sebelumnya
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Logika Anda sudah benar
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration - ✅ PERBAIKI SESSION CONFIG
app.use(session({
  name: 'sapa-tazkia.sid',
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-session-secret-12345-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  },
  store: process.env.NODE_ENV === 'production' ? 
    // Untuk production, gunakan session store yang persistent
    // new (require('connect-pg-simple')(session))() 
    // Untuk development, gunakan MemoryStore
    new session.MemoryStore() : new session.MemoryStore()
}));

// Passport middleware - ✅ PERBAIKI PASSPORT INIT
app.use(authService.passport.initialize());
app.use(authService.passport.session());

// ========================================================
// BASIC ROUTES & HEALTH CHECKS
// ========================================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Sapa Tazkia Backend API',
    version: '3.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      ai: '/api',
      health: '/health',
      session: '/session-debug'
    }
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      status: 'OK', 
      message: 'Server is running',
      database: 'Connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Server has issues',
      database: 'Disconnected',
      error: error.message
    });
  }
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
    }
  });
});

// Simple test route
app.get('/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'Test route working!',
    session: req.sessionID ? 'Active' : 'No session',
    timestamp: new Date().toISOString()
  });
});

// ========================================================
// API ROUTES - ✅ HANYA REGISTER ROUTES YANG ADA
// ========================================================

// Auth routes
app.use('/api/auth', authRoutes);

// AI Chat routes - ✅ INI SAJA YANG DIPAKAI
app.use('/api', aiRoutes);

// ❌ HAPUS academicRoutes dan chatRoutes karena tidak ada

// ========================================================
// ERROR HANDLING MIDDLEWARE
// ========================================================

// 404 Handler - harus di akhir sebelum global error handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET  /',
      'GET  /health',
      'GET  /test',
      'GET  /session-debug',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET  /api/auth/google',
      'GET  /api/auth/google/callback',
      'POST /api/test-ai',
      'GET  /api/test-gemini'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔴 [ERROR] Global error handler:', err);
  
  // CORS error
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'CORS Error: Origin not allowed',
      allowedOrigins: allowedOrigins // Mengirim kembali daftar yang diizinkan
    });
  }
  
  // Prisma database error
  if (err.code && err.code.startsWith('P')) {
    console.error('🔴 [DATABASE ERROR]', err);
    return res.status(500).json({
      success: false,
      message: 'Database error occurred',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ========================================================
// GRACEFUL SHUTDOWN
// ========================================================

process.on('SIGINT', async () => {
  console.log('\n🔴 Received SIGINT. Shutting down gracefully...');
  await prisma.$disconnect();
  console.log('✅ Database disconnected.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔴 Received SIGTERM. Shutting down gracefully...');
  await prisma.$disconnect();
  console.log('✅ Database disconnected.');
  process.exit(0);
});

// ========================================================
// SERVER START
// ========================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 SAPA TAZKIA BACKEND SERVER STARTED SUCCESSFULLY');
  console.log('='.repeat(60));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Auth: ${process.env.GOOGLE_CLIENT_ID ? 'Google OAuth Ready' : 'Local Auth Only'}`);
  console.log(`🤖 AI: ${process.env.GEMINI_API_KEY ? 'Gemini AI Ready' : 'AI Disabled'}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'Connected' : 'No DB Config'}`);
  console.log('');
  console.log('📋 AVAILABLE ENDPOINTS:');
  console.log('   GET  / .......................... API Root');
  console.log('   GET  /health ................... Health check');
  console.log('   GET  /session-debug ............ Session debug');
  console.log('   GET  /test .................... Test route');
  console.log('');
  console.log('🔐 AUTH ENDPOINTS:');
  console.log('   GET  /api/auth/test ........... Auth test');
  console.log('   POST /api/auth/login .......... User login');
  console.log('   POST /api/auth/register ....... User registration');
  console.log('   GET  /api/auth/google ......... Google OAuth');
  console.log('   GET  /api/auth/google/callback . Google Callback');
  console.log('   POST /api/auth/logout ......... User logout');
  console.log('   GET  /api/auth/me ............ Get user profile');
  console.log('');
  console.log('🤖 AI ENDPOINTS:');
  console.log('   POST /api/test-ai ............ AI Chat');
  console.log('   GET  /api/test-gemini ........ Test Gemini Connection');
  console.log('   POST /api/chat ............... Main Chat Endpoint');
  console.log('');
  console.log('='.repeat(60));
});

module.exports = app;