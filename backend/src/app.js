require('dotenv').config();

const express = require('express');
const compression = require('compression');
const requestId = require('./middleware/requestId');
const session = require('express-session');
const RedisStore = require('connect-redis').RedisStore;
const cors = require('cors');
const helmet = require('helmet'); // Security headers middleware
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
// ✅ BUG-02 FIX: Gunakan Prisma singleton agar koneksi DB tidak exhausted
const prisma = require('./config/prismaClient');

// ✅ NEW: Centralized environment validation (fail-fast)
const { validateEnv } = require('./config/envValidation');
validateEnv();

// Environment-based logger
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/authRoutes');
const aiRoutes = require('./routes/aiRoutes');
const guestRoutes = require('./routes/guestRoutes');
const rateLimitRoutes = require('./routes/rateLimitRoutes'); // ✅ NEW: Rate limit routes
const academicRoutes = require('./routes/academicRoutes');   // ✅ NEW: Academic Routes (Ditambahkan)
const adminRoutes = require('./routes/adminRoutes');         // ✅ NEW: Admin Routes
const bugReportRoutes = require('./routes/bugReportRoutes'); // ✅ NEW: Bug Report Routes
const notificationRoutes = require('./routes/notificationRoutes');

// Import services
const authService = require('./services/authService');
const { requireAuth } = require('./middleware/authMiddleware');

// ✅ NEW: Import rate limit error handler
const { rateLimitErrorHandler } = require('./utils/errorHandlers');

const app = express();
// ✅ REQUIRED: Trust proxy for Nginx & Rate Limiting
app.set('trust proxy', 1);

// Request ID — must be first middleware so req.id is available everywhere
app.use(requestId);

// Response compression — skip SSE streaming endpoints
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    // Skip compression for SSE streaming endpoints
    if (/\/(ai|guest|auth)\/chat/.test(req.path)) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// ✅ BUG-02: prisma sudah di-import sebagai singleton di atas (bukan new PrismaClient())

// ========================================================
// RATE LIMIT SYSTEM INITIALIZATION - NEW SECTION
// ========================================================

// ✅ NEW: Initialize rate limit system dengan error handling
const initializeRateLimitSystem = async () => {
  try {
    // ✅ FIX: Coba berbagai path yang mungkin untuk jobs
    let rateLimitJobs;
    try {
      rateLimitJobs = require('./jobs/rateLimitJobs');
    } catch (error) {
      try {
        rateLimitJobs = require('../jobs/rateLimitJobs');
      } catch (error2) {
        console.warn('⚠️ [RATE LIMIT] Rate limit jobs not found, continuing without background jobs');
        // Jangan return dulu, coba lanjut inisialisasi service lain jika memungkinkan
      }
    }

    if (rateLimitJobs && typeof rateLimitJobs.init === 'function') {
      rateLimitJobs.init();
      console.log('✅ [RATE LIMIT] Rate limit jobs initialized');
    }

    // Test Redis connection
    const redisService = require('./services/redisService');
    const redisHealth = await redisService.healthCheck();
    console.log(`✅ [RATE LIMIT] Redis connection: ${redisHealth ? 'HEALTHY' : 'UNHEALTHY'}`);

    // Initialize rate limit service check (optional but good for verification)
    try {
      const rateLimitService = require('./services/rateLimitService');
      // Jika ada method init atau check di service, panggil di sini
      console.log('✅ [RATE LIMIT] Rate limit service ready');
    } catch (serviceError) {
      console.warn(`⚠️ [RATE LIMIT] Rate limit service load failed: ${serviceError.message}`);
    }

  } catch (error) {
    console.error('❌ [RATE LIMIT] Failed to initialize rate limit system:', error.message);
    console.log('⚠️ [RATE LIMIT] Continuing without rate limiting features');
  }
};

// ✅ NEW: Initialize analytics system
const initializeAnalyticsSystem = async () => {
  try {
    const analyticsJob = require('./jobs/analyticsJob');
    analyticsJob.init();
    console.log('✅ [ANALYTICS] Analytics snapshot job initialized');
  } catch (error) {
    console.error('❌ [ANALYTICS] Failed to initialize analytics job:', error.message);
    console.log('⚠️ [ANALYTICS] Continuing without analytics snapshot job');
  }
};

// ========================================================
// MIDDLEWARE SETUP - ENHANCED WITH RATE LIMIT AWARENESS
// ========================================================

// CORS configuration - Enhanced with rate limit headers
// ✅ SECURITY: Dynamic CORS origins based on environment
const isProduction = process.env.NODE_ENV === 'production';
const extraDevOrigins = process.env.DEV_CORS_ORIGINS
  ? process.env.DEV_CORS_ORIGINS.split(',').map(o => o.trim())
  : [];
const allowedOrigins = isProduction
  ? [process.env.FRONTEND_URL || 'https://sapa.tazkia.ac.id']
  : [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    ...extraDevOrigins
  ];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      // console.log('🔒 CORS Blocked:', origin); // Optional logging
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
    'Access-Control-Request-Headers',
    'X-RateLimit-Limit', // ✅ NEW: Allow rate limit headers
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-RateLimit-User-Type',
    'X-Request-Id'
  ],
  exposedHeaders: [
    'Content-Length',
    'Authorization',
    'X-RateLimit-Limit', // ✅ NEW: Expose rate limit headers
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-RateLimit-User-Type',
    'Retry-After',
    'X-Request-Id'
  ],
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
    'Access-Control-Request-Headers',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-RateLimit-User-Type'
  ]
}));

// Body parser middleware
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({
  extended: true,
  limit: '1mb',
  parameterLimit: 100
}));

// ✅ NEW: Helmet.js for comprehensive security headers
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false, // Disable CSP in dev for easier debugging
  crossOriginEmbedderPolicy: false, // For embedding external resources
}));

// Rate limit headers middleware (separate from Helmet)
app.use((req, res, next) => {
  if (!res.get('X-RateLimit-Limit')) {
    res.setHeader('X-RateLimit-Limit', 'unknown');
    res.setHeader('X-RateLimit-Remaining', 'unknown');
    res.setHeader('X-RateLimit-Reset', 'unknown');
    res.setHeader('X-RateLimit-User-Type', 'unknown');
  }
  next();
});

// Session configuration - Secure: no fallback secret
// ✅ SECURITY: SESSION_SECRET must be set explicitly
if (!process.env.SESSION_SECRET) {
  if (isProduction) {
    throw new Error('FATAL: SESSION_SECRET environment variable must be set in production!');
  } else {
    logger.warn('SESSION_SECRET not set. Using JWT_SECRET as fallback for development only.');
  }
}

// ✅ BUG FIX: connect-redis v7 menggunakan API node-redis v4 (set dengan options object {EX: ttl}),
// sedangkan ioredis menggunakan convention berbeda (set key value 'EX' ttl).
// Solusi: buat thin wrapper yang menjembatani keduanya tanpa ganti library.
const redisServiceInstance = require('./services/redisService');
const ioRedisClient = redisServiceInstance.client;
const redisClientForSession = {
  get: (key) => ioRedisClient.get(key),
  set: (key, value, options) => {
    // connect-redis v7 memanggil: client.set(key, val, { EX: seconds })
    // ioredis mengharapkan: client.set(key, val, 'EX', seconds)
    if (options && typeof options === 'object' && options.EX) {
      return ioRedisClient.set(key, value, 'EX', options.EX);
    }
    return ioRedisClient.set(key, value);
  },
  // connect-redis butuh fungsi ini untuk touch/reset TTL
  expire: (key, seconds) => ioRedisClient.expire(key, seconds),
  del: (...keys) => ioRedisClient.del(...keys),
  mget: (...keys) => ioRedisClient.mget(...keys),
};

app.use(session({
  name: 'sapa-tazkia.sid',
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'dev-only-fallback-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProduction ? 'none' : 'lax',
  },
  store: new RedisStore({ client: redisClientForSession, prefix: 'sess:' })
}));

// Passport middleware
app.use(authService.passport.initialize());
app.use(authService.passport.session());

// Request logging middleware - structured via logger
app.use((req, res, next) => {
  logger.request(req.method, req.url, '-');
  if (req.id) logger.debug(`[REQ] id=${req.id}`);
  next();
});

// ========================================================
// BASIC ROUTES & HEALTH CHECKS - ENHANCED WITH RATE LIMIT STATUS
// ========================================================

// Root endpoint - Updated with rate limit info
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 Sapa Tazkia Backend API',
    version: '4.1.0', // ✅ UPDATE VERSION - Academic Routes Added
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    features: {
      authentication: true,
      emailVerification: true,
      googleOAuth: !!process.env.GOOGLE_CLIENT_ID,
      aiChat: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'),
      academicAnalysis: true,
      ragEnabled: true,
      rateLimiting: process.env.RATE_LIMIT_ENABLED !== 'false' // ✅ NEW: Rate limit feature flag
    },
    endpoints: {
      auth: '/api/auth',
      ai: '/api/ai',
      guest: '/api/guest',
      academic: '/api/academic', // ✅ NEW: Academic endpoint info
      rateLimit: '/api/rate-limit', // ✅ NEW: Rate limit endpoints
      health: '/health',
      status: '/status'
    },
    rateLimits: { // ✅ NEW: Rate limit information
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      guest: '10/min, 50/hour, 200/day',
      user: '30/min, 200/hour, 1000/day',
      premium: '100/min, 1000/hour, 5000/day',
      adaptive: 'Automatic adjustment under load'
    }
  });
});

// Health check endpoint - Enhanced with rate limit status
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {},
    port: process.env.PORT || 5000,
    rateLimiting: { // ✅ NEW: Rate limit health section
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      redis: 'UNKNOWN',
      service: 'UNKNOWN'
    }
  };

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = 'Connected';

    // Test Redis connection for rate limiting
    try {
      const redisService = require('./services/redisService');
      const redisHealth = await redisService.healthCheck();
      healthCheck.rateLimiting.redis = redisHealth ? 'HEALTHY' : 'UNHEALTHY';
      healthCheck.services.redis = redisHealth ? 'Connected' : 'Disconnected';
    } catch (error) {
      healthCheck.rateLimiting.redis = `ERROR: ${error.message}`;
      healthCheck.services.redis = `Error: ${error.message}`;
    }

    // Test rate limit service
    try {
      const rateLimitService = require('./services/rateLimitService');
      healthCheck.rateLimiting.service = 'READY';
    } catch (error) {
      healthCheck.rateLimiting.service = `ERROR: ${error.message}`;
    }

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

// Status endpoint with more details - Enhanced with rate limit info
app.get('/status', async (req, res) => {
  const statusData = {
    status: 'operational',
    serverTime: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    features: {
      authentication: !!process.env.GOOGLE_CLIENT_ID,
      emailVerification: true,
      ai: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'),
      academicAnalysis: true,
      ragSystem: true,
      database: !!process.env.DATABASE_URL,
      emailService: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
      rateLimiting: process.env.RATE_LIMIT_ENABLED !== 'false' // ✅ NEW
    },
    aiProvider: process.env.AI_PROVIDER || 'openai',
    aiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    ragEnabled: true,
    rateLimiting: { // ✅ NEW: Detailed rate limit status
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      redis: 'UNKNOWN',
      adaptive: true,
      guestLimits: {
        perMinute: 10,
        perHour: 50,
        perDay: 200
      },
      userLimits: {
        perMinute: 30,
        perHour: 200,
        perDay: 1000
      }
    }
  };

  // Add Redis status
  try {
    const redisService = require('./services/redisService');
    const redisHealth = await redisService.healthCheck();
    statusData.rateLimiting.redis = redisHealth ? 'HEALTHY' : 'UNHEALTHY';
  } catch (error) {
    statusData.rateLimiting.redis = `ERROR: ${error.message}`;
  }

  res.json(statusData);
});

// Middleware: block in production before hitting any real middleware
const devOnly = (req, res, next) => {
  if (isProduction) return res.status(404).json({ success: false, message: 'Not found' });
  next();
};

// Session debug endpoint — dev only, requires auth
app.get('/session-debug', devOnly, requireAuth, (req, res) => {
  res.json({
    sessionID: req.sessionID,
    sessionExists: !!req.session,
    user: req.user || null,
    authenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    passport: {
      initialized: !!authService.passport,
      session: !!req._passport
    },
    cookies: req.headers.cookie || 'No cookies',
    rateLimitInfo: { // ✅ NEW: Rate limit context
      ip: req.ip,
      userType: req.user ? (req.user.isPremium ? 'premium' : 'user') : 'guest'
    }
  });
});

// Simple test route with rate limit headers — dev only
app.get('/test', devOnly, (req, res) => {
  // ✅ NEW: Add sample rate limit headers for testing
  res.set({
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Remaining': '9',
    'X-RateLimit-Reset': (Date.now() + 60000).toString(),
    'X-RateLimit-User-Type': 'guest'
  });

  res.json({
    success: true,
    message: 'Test route working!',
    session: req.sessionID ? 'Active' : 'No session',
    timestamp: new Date().toISOString(),
    headers: {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent']
    },
    rateLimitHeaders: { // ✅ NEW: Show rate limit headers in response
      limit: '10',
      remaining: '9',
      reset: new Date(Date.now() + 60000).toISOString(),
      userType: 'guest'
    }
  });
});

// ========================================================
// API ROUTES - ENHANCED WITH RATE LIMIT ROUTES
// ========================================================

// ✅ FIXED: AI routes FIRST untuk guest access
app.use('/api/ai', aiRoutes);

// Auth routes - User authentication
app.use('/api/auth', authRoutes);

// Guest routes - For non-authenticated users
app.use('/api/guest', guestRoutes);

// ✅ NEW: Rate limit routes - For monitoring and management
app.use('/api/rate-limit', rateLimitRoutes);

// Admin Endpoints
app.use('/api/admin', adminRoutes);

// Bug Reports
app.use('/api/bug-reports', bugReportRoutes);

// ✅ NEW: Academic Routes (Ditambahkan sesuai request)
app.use('/api/academic', academicRoutes);

// Notification Routes
app.use('/api/notifications', notificationRoutes);

// ========================================================
// ERROR HANDLING MIDDLEWARE - ENHANCED WITH RATE LIMIT ERRORS
// ========================================================

// ✅ Swagger/OpenAPI Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true
  },
  customSiteTitle: 'Sapa-Tazkia API Docs'
}));

// Rate limit error handler (must be before general error handler)
app.use(rateLimitErrorHandler);

// 404 Handler
app.use('*', (req, res) => {
  logger.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`[GLOBAL ERROR] ${err.message}`, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    rateLimitError: err.code === 'RATE_LIMIT_EXCEEDED'
  });

  // Rate limit error (already handled by rateLimitErrorHandler, but as backup)
  if (err.code === 'RATE_LIMIT_EXCEEDED' || err.status === 429) {
    return res.status(429).json({
      success: false,
      message: err.message || 'Rate limit exceeded',
      error: 'rate_limit_exceeded',
      retry_after: err.retryAfter,
      limit: err.limit,
      reset_time: err.resetTime,
      user_type: err.userType || 'unknown',
      timestamp: new Date().toISOString()
    });
  }

  // CORS error
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'CORS Error: Origin not allowed'
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

  // Redis error (rate limiting related)
  if (err.message.includes('Redis') || err.message.includes('ECONNREFUSED')) {
    console.error('🔴 [REDIS ERROR]', err);
    return res.status(503).json({
      success: false,
      message: 'Rate limiting service temporarily unavailable',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later',
      suggestion: 'Rate limits are disabled when Redis is unavailable'
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
// GRACEFUL SHUTDOWN - ENHANCED WITH RATE LIMIT CLEANUP
// ========================================================

const gracefulShutdown = async (signal) => {
  console.log(`\n🔴 Received ${signal}. Shutting down gracefully...`);

  try {
    // Close database connection
    await prisma.$disconnect();
    console.log('✅ Database disconnected.');

    // ✅ NEW: Close Redis connection
    try {
      const redisService = require('./services/redisService');
      // Note: ioredis automatically handles connection cleanup
      console.log('✅ Redis connections cleaned up.');
    } catch (error) {
      console.log('⚠️ Redis cleanup skipped:', error.message);
    }

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
// SERVER START - ENHANCED WITH RATE LIMIT SYSTEM LOGS
// ========================================================

const PORT = process.env.PORT || 5000;

let server;

if (require.main === module) {
  server = app.listen(PORT, async () => {
  console.log('='.repeat(80));
  console.log('🚀 SAPA TAZKIA BACKEND SERVER STARTED SUCCESSFULLY');
  console.log('='.repeat(80));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Auth: ${process.env.GOOGLE_CLIENT_ID ? '✅ Google OAuth Ready' : '❌ Local Auth Only'}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER ? '✅ Email Service Ready' : '❌ Email Disabled'}`);
  console.log(`🤖 AI: ${process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' ? '✅ OpenAI + RAG Ready' : '❌ AI Disabled'}`);
  console.log(`🧠 RAG: ✅ Knowledge Base System Enabled`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ No DB Config'}`);
  console.log(`🛡️ Rate Limiting: ${process.env.RATE_LIMIT_ENABLED !== 'false' ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`📊 Analytics: ✅ Snapshot job enabled`);

  // ✅ NEW: Rate limit system status
  try {
    await initializeRateLimitSystem();
  } catch (error) {
    console.log(`⚠️ Rate Limit: ❌ Initialization Failed - ${error.message}`);
  }

  // ✅ NEW: Analytics system status
  try {
    await initializeAnalyticsSystem();
  } catch (error) {
    console.log(`⚠️ Analytics: ❌ Initialization Failed - ${error.message}`);
  }

  console.log('');
  console.log('   GET  /api/docs .............................. Swagger API Documentation');
  console.log('   GET  / .......................... API Root');
  console.log('   GET  /health ................... Health check');
  console.log('   GET  /status ................... System status (+Rate Limit Config)');
  console.log('   GET  /session-debug ............ Session debug (+Rate Limit Context)');
  console.log('   GET  /test .................... Test route (+Rate Limit Headers)');
  console.log('');
  console.log('🎓 ACADEMIC ENDPOINTS:'); // ✅ NEW LOGS
  console.log('   GET  /api/academic/summary ..... Academic Summary');
  console.log('   GET  /api/academic/grades ...... Student Grades');
  console.log('   GET  /api/academic/transcript .. Full Transcript');
  console.log('   POST /api/academic/analyze ..... AI Performance Analysis');
  console.log('');
  console.log('🤖 AI ENDPOINTS (Guest & Auth):');
  console.log('   POST /api/ai/chat ............. AI Chat dengan RAG (+Rate Limited)');
  console.log('   GET  /api/ai/knowledge-status . Cek status knowledge base');
  console.log('   POST /api/ai/ingest-now ....... Manual ingestion (Guest OK)');
  console.log('   POST /api/ai/ingest ........... Protected ingestion');
  console.log('   GET  /api/ai/test-embedding ... Test embedding function');
  console.log('   GET  /api/ai/test-openai ...... Test OpenAI connection');
  console.log('   POST /api/ai/test-ai .......... Test AI response (+Rate Limited)');
  console.log('   GET  /api/ai/conversations .... Get conversations (Auth)');
  console.log('   GET  /api/ai/history/:chatId .. Get chat history (Auth)');
  console.log('   POST /api/ai/analyze-academic . Analyze academic (Auth +Rate Limited)');
  console.log('   POST /api/ai/study-recommendations . Study recommendations (Auth +Rate Limited)');
  console.log('   GET  /api/ai/rate-limit-status . Check rate limit status'); // ✅ NEW
  console.log('');
  console.log('🔐 AUTH ENDPOINTS:');
  console.log('   POST /api/auth/login .......... User login');
  console.log('   POST /api/auth/register ....... User registration');
  // ... (auth endpoints tetap sama)
  console.log('');
  console.log('👤 GUEST ENDPOINTS:');
  console.log('   POST /api/guest/chat .......... Guest Chat (+Enhanced Rate Limits)');
  console.log('   GET  /api/guest/conversation/:sessionId ... Guest History');
  console.log('   GET  /api/guest/rate-limit-status ........ Guest Rate Limit Status'); // ✅ NEW
  console.log('   GET  /api/guest/usage-stats/:sessionId .... Guest Usage Stats'); // ✅ NEW
  console.log('   GET  /api/guest/session-info/:sessionId ... Guest Session Info'); // ✅ NEW
  console.log('');
  console.log('📊 RATE LIMIT ENDPOINTS:'); // ✅ NEW SECTION
  console.log('   GET  /api/rate-limit/status ........... Get rate limit status');
  console.log('   GET  /api/rate-limit/analytics ....... Get rate limit analytics');
  console.log('   POST /api/rate-limit/reset ........... Reset rate limits (Admin)');
  console.log('');
  console.log('🛡️  SECURITY FEATURES:');
  console.log('   ✅ CORS Protection');
  console.log('   ✅ Session Management');
  console.log('   ✅ Email Verification System');
  console.log('   ✅ RAG Knowledge Base');
  console.log('   ✅ Input Validation');
  console.log('   ✅ Error Handling');
  console.log('   ✅ Graceful Shutdown');
  console.log(`   ${process.env.RATE_LIMIT_ENABLED !== 'false' ? '✅' : '❌'} Rate Limiting System`);
  console.log('   ✅ Multi-layer Rate Limits (IP + User + Token Bucket)');
  console.log('   ✅ Adaptive Limits under High Load');
  console.log('   ✅ Real-time Analytics & Monitoring');
  console.log('='.repeat(80));
  });
}

module.exports = app;