const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const aiController = require('../controllers/aiController');
const ragService = require('../services/ragService');
const openaiService = require('../services/openaiService');
const fs = require('fs');
const path = require('path');

/**
 * ============================================================================
 * RATE LIMITER SETUP - ENHANCED WITH NEW RATE LIMIT SYSTEM
 * ============================================================================
 */

// ✅ PERBAIKAN: Import rate limit middleware yang baru
let rateLimitMiddleware;
let guestRateLimit;
let userRateLimit;
let premiumRateLimit;
let ipRateLimit;

try {
  const rateLimitModule = require('../middleware/rateLimitMiddleware');
  rateLimitMiddleware = rateLimitModule.rateLimitMiddleware;
  guestRateLimit = rateLimitModule.guestRateLimit;
  userRateLimit = rateLimitModule.userRateLimit;
  premiumRateLimit = rateLimitModule.premiumRateLimit;
  ipRateLimit = rateLimitModule.ipRateLimit;
  
  console.log('✅ [RATE LIMIT] Enhanced rate limiter loaded successfully');
} catch (error) {
  console.error('❌ [RATE LIMIT] Failed to load enhanced rate limiter:', error.message);
  
  // ✅ FALLBACK: Create safe fallback rate limiters
  const fallbackRateLimiter = (req, res, next) => {
    console.log('⚠️ [RATE LIMIT] Using fallback rate limiter');
    next();
  };
  
  rateLimitMiddleware = fallbackRateLimiter;
  guestRateLimit = fallbackRateLimiter;
  userRateLimit = fallbackRateLimiter;
  premiumRateLimit = fallbackRateLimiter;
  ipRateLimit = fallbackRateLimiter;
}

/**
 * ============================================================================
 * CUSTOM RATE LIMIT STRATEGY FOR AI ROUTES
 * ============================================================================
 */

// ✅ CUSTOM RATE LIMIT: Strategi khusus untuk routes AI
const aiSpecificRateLimit = (req, res, next) => {
  // Skip rate limiting jika dimatikan di environment
  if (process.env.RATE_LIMIT_ENABLED === 'false') {
    return next();
  }

  // Terapkan IP-based rate limiting terlebih dahulu
  ipRateLimit(req, res, (ipError) => {
    if (ipError) {
      return next(ipError);
    }

    // Terapkan user-specific rate limiting berdasarkan authentication
    if (req.user) {
      // User terautentikasi - gunakan user rate limits
      if (req.user.isPremium || req.user.role === 'premium') {
        premiumRateLimit(req, res, next);
      } else {
        userRateLimit(req, res, next);
      }
    } else {
      // Guest user - gunakan guest rate limits
      guestRateLimit(req, res, next);
    }
  });
};

/**
 * ============================================================================
 * MIDDLEWARE SETUP - ENHANCED WITH RATE LIMIT AWARENESS
 * ============================================================================
 */

// ✅ GUEST-FRIENDLY AUTH dengan rate limit awareness
const guestFriendlyAuth = authMiddleware.guestFriendlyAuth;

// ✅ RATE LIMIT AWARE OPTIONAL AUTH
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authMiddleware.requireAuth(req, res, (authError) => {
      if (authError) {
        console.log('👤 [AUTH] Auth failed, falling back to guest');
        req.user = null;
      }
      next();
    });
  }
  
  req.user = null;
  console.log('👤 [AUTH] Guest access detected');
  next();
};

/**
 * ============================================================================
 * UTILITY FUNCTIONS - ENHANCED
 * ============================================================================
 */

// Function untuk cek dan validasi data directory
const validateDataDirectory = () => {
  const dataDir = path.join(__dirname, '../../data');
  
  console.log('📁 [VALIDATE] Checking data directory:', dataDir);
  
  if (!fs.existsSync(dataDir)) {
    console.log('❌ [VALIDATE] Data directory does not exist');
    return {
      exists: false,
      path: dataDir,
      files: [],
      error: `Data directory tidak ditemukan: ${dataDir}`
    };
  }
  
  const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.md'));
  console.log('✅ [VALIDATE] Data directory exists, files found:', files);
  
  return {
    exists: true,
    path: dataDir,
    files: files,
    count: files.length
  };
};

// ✅ UTILITY: Safe async handler untuk menghindari try-catch berulang
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ✅ UTILITY: Rate limit info extractor untuk response
const addRateLimitHeaders = (req, res, rateLimitInfo) => {
  if (rateLimitInfo) {
    res.set({
      'X-RateLimit-Limit': rateLimitInfo.limit,
      'X-RateLimit-Remaining': rateLimitInfo.remaining,
      'X-RateLimit-Reset': rateLimitInfo.resetTime
    });
  }
};

/**
 * ============================================================================
 * 1. PUBLIC / HYBRID ROUTES (BISA GUEST, BISA LOGIN) - ENHANCED RATE LIMITING
 * ============================================================================
 */

// ✅ CHAT ROUTE UTAMA (RAG INTEGRATED) - ENHANCED RATE LIMITING
router.post('/chat', 
  guestFriendlyAuth, 
  aiSpecificRateLimit, 
  asyncHandler(async (req, res, next) => {
    try {
      // ✅ FIX: Langsung panggil controller tanpa manipulasi response
      await aiController.sendChat(req, res);  
      // Tambahkan rate limit info ke response jika ada    
    } catch (error) {
      next(error);
    }
  })
);

// ✅ PUBLIC KNOWLEDGE BASE STATUS - GUEST FRIENDLY (NO RATE LIMIT)
router.get('/knowledge-status', 
  guestFriendlyAuth, 
  asyncHandler(async (req, res) => {
    console.log('🔍 [DEBUG] Checking knowledge base status...');
    
    // 1. Cek koneksi Qdrant
    const collectionInfo = await ragService.getCollectionInfo();
    console.log('📊 [DEBUG] Qdrant Collection:', collectionInfo);
    
    // 2. Cek file data menggunakan utility function
    const dataCheck = validateDataDirectory();
    console.log('📁 [DEBUG] Data check result:', dataCheck);
    
    // 3. Test embedding kecil
    let embeddingTest = 'NOT_TESTED';
    try {
      console.log('🧬 [DEBUG] Testing embedding...');
      const testEmbedding = await openaiService.createEmbedding('test embedding for knowledge base');
      embeddingTest = testEmbedding.length === 1536 ? 'OK' : `FAIL (${testEmbedding.length} dim)`;
      console.log('✅ [DEBUG] Embedding test:', embeddingTest);
    } catch (error) {
      embeddingTest = `ERROR: ${error.message}`;
      console.error('❌ [DEBUG] Embedding test failed:', error.message);
    }
    
    const responseData = {
      success: true,
      knowledge_base: {
        qdrant: collectionInfo,
        files: dataCheck,
        openai: embeddingTest,
        has_data: collectionInfo.exists && collectionInfo.pointsCount > 0,
        total_documents: collectionInfo.exists ? collectionInfo.pointsCount : 0,
        ready_for_ingestion: dataCheck.exists && dataCheck.count > 0
      },
      access_type: req.user ? 'authenticated' : 'guest',
      user_type: req.user ? (req.user.isPremium ? 'premium' : 'user') : 'guest',
      timestamp: new Date().toISOString()
    };

    // Tambah warning jika data directory tidak ada
    if (!dataCheck.exists) {
      responseData.warning = 'Data directory tidak ditemukan. Pastikan folder data ada di root project.';
      responseData.suggestion = `Pastikan folder exists: ${dataCheck.path}`;
    }

    // Tambah warning jika tidak ada file
    if (dataCheck.exists && dataCheck.count === 0) {
      responseData.warning = 'Data directory ditemukan tapi tidak ada file .md. Pastikan file brosur ada.';
      responseData.suggestion = 'Tambahkan file .md (markdown) ke folder data/';
    }

    res.json(responseData);
  })
);

// ✅ MANUAL INGESTION TRIGGER - PUBLIC dengan RATE LIMIT RINGAN
router.post('/ingest-now', 
  guestFriendlyAuth, 
  ipRateLimit, // Hanya IP-based limiting untuk ingestion
  asyncHandler(async (req, res) => {
    console.log('🚀 [INGEST] Manual ingestion triggered...');
    
    // Log user info untuk debugging
    if (req.user) {
      console.log(`   👤 Authenticated user: ${req.user.email || req.user.id}`);
    } else {
      console.log('   👤 Guest user - allowing ingestion for testing');
    }
    
    // Validasi data directory SEBELUM proses ingestion
    const dataCheck = validateDataDirectory();
    if (!dataCheck.exists) {
      return res.status(400).json({
        success: false,
        error: 'Data directory tidak ditemukan',
        message: `Folder data tidak ditemukan di: ${dataCheck.path}`,
        suggestion: 'Pastikan struktur folder: backend/data/ dengan file .md di dalamnya'
      });
    }
    
    if (dataCheck.count === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tidak ada file markdown',
        message: 'Data directory ditemukan tapi tidak ada file .md',
        files_found: dataCheck.files,
        suggestion: 'Tambahkan file .md (seperti brosur_febs.md, brosur_humaniora.md) ke folder data/'
      });
    }
    
    console.log('✅ [INGEST] Data validation passed:', dataCheck.files);
    
    // Cek status sebelum ingestion
    const beforeStatus = await ragService.getCollectionInfo();
    console.log('📊 [INGEST] Status sebelum:', beforeStatus);
    
    // Jalankan ingestion
    console.log('🔄 [INGEST] Starting data ingestion process...');
    const result = await ragService.resetAndReingest();
    
    if (result && result.success) {
      // Cek status setelah ingestion
      const afterStatus = await ragService.getCollectionInfo();
      
      console.log(`✅ [INGEST] Success: ${result.count} chunks from ${result.filesProcessed?.length || 0} files`);
      console.log('📊 [INGEST] Status sesudah:', afterStatus);
      
      const responseData = { 
        success: true, 
        message: `Berhasil memproses ${result.count} data. Database telah dibersihkan dan diisi ulang.`,
        before: beforeStatus,
        after: afterStatus,
        files_processed: result.filesProcessed || [],
        data_validation: dataCheck,
        ...result 
      };

      // Tambah info tambahan
      if (afterStatus.pointsCount > 0) {
        responseData.ingestion_status = 'SUCCESS';
        responseData.suggestion = 'Data berhasil dimasukkan ke knowledge base. Sekarang Anda bisa test chat dengan RAG.';
      } else {
        responseData.ingestion_status = 'NO_DATA';
        responseData.warning = 'Proses ingestion berhasil tapi tidak ada data yang masuk ke Qdrant. Cek log untuk detail.';
      }

      res.json(responseData);
      
    } else {
      console.log('❌ [INGEST] Failed:', result?.error || 'Unknown error');
      
      const errorResponse = { 
        success: false, 
        error: result?.error || 'Ingestion failed without error message',
        message: result?.message || "Gagal memproses data pengetahuan",
        details: result,
        data_validation: dataCheck
      };

      // Berikan saran berdasarkan error
      if (result?.error && (result.error.includes('path') || result.error.includes('directory'))) {
        errorResponse.suggestion = `Pastikan folder data ada di: ${dataCheck.path}`;
      } else if (result?.error && (result.error.includes('openai') || result.error.includes('embedding'))) {
        errorResponse.suggestion = 'Cek koneksi OpenAI API key dan pastikan valid.';
      } else if (result?.error && result.error.includes('Qdrant')) {
        errorResponse.suggestion = 'Pastikan Qdrant service berjalan: docker-compose up -d qdrant';
      }

      res.status(500).json(errorResponse);
    }
  })
);

/**
 * ============================================================================
 * 2. PROTECTED ROUTES (WAJIB LOGIN) - ENHANCED RATE LIMITING
 * ============================================================================
 */

// ✅ KNOWLEDGE BASE INGESTION (PROTECTED) - NO RATE LIMIT (Admin action)
router.post('/ingest', 
  authMiddleware.requireAuth, 
  asyncHandler(async (req, res) => {
    console.log('🚀 [INGEST] Protected ingestion triggered by user:', req.user.id);
    
    // Validasi data directory sebelum proses
    const dataCheck = validateDataDirectory();
    if (!dataCheck.exists || dataCheck.count === 0) {
      return res.status(400).json({
        success: false,
        error: 'Data tidak valid',
        message: 'Data directory tidak ditemukan atau tidak ada file .md',
        details: dataCheck
      });
    }
    
    const beforeStatus = await ragService.getCollectionInfo();
    const result = await ragService.resetAndReingest();
    
    if (result && result.success) {
      const afterStatus = await ragService.getCollectionInfo();
      console.log(`✅ [INGEST] Success: ${result.count} chunks from ${result.filesProcessed?.length || 0} files`);
      
      res.json({ 
        success: true, 
        message: `Berhasil memproses ${result.count} data. Database dibersihkan.`,
        before: beforeStatus,
        after: afterStatus,
        data_validation: dataCheck,
        ...result 
      });
    } else {
      console.log('❌ [INGEST] Failed:', result?.error);
      res.status(500).json({ 
        success: false, 
        error: result?.error || 'Unknown error',
        message: result?.message || "Gagal memproses data pengetahuan",
        data_validation: dataCheck
      });
    }
  })
);

// ✅ MANAJEMEN PERCAKAPAN (PROTECTED) - NO RATE LIMIT (Read-only operations)
router.get('/conversations', authMiddleware.requireAuth, aiController.getConversations);
router.get('/history/:chatId', authMiddleware.requireAuth, aiController.getChatHistory);
router.delete('/conversations/:chatId', authMiddleware.requireAuth, aiController.deleteConversation);

// ✅ FITUR AKADEMIK (PROTECTED) - ENHANCED RATE LIMITING
router.post('/analyze-academic', 
  authMiddleware.requireAuth, 
  userRateLimit, 
  aiController.analyzeAcademicPerformance
);

router.post('/study-recommendations', 
  authMiddleware.requireAuth, 
  userRateLimit, 
  aiController.getStudyRecommendations
);

/**
 * ============================================================================
 * 3. TEST & UTILITY ROUTES (PUBLIC) - ENHANCED RATE LIMITING
 * ============================================================================
 */

// Test koneksi AI sederhana - GUEST FRIENDLY + RATE LIMITED
router.post('/test-ai', 
  guestFriendlyAuth, 
  aiSpecificRateLimit,
  asyncHandler(async (req, res) => {
    const { message } = req.body;
    const testMessage = message || 'Halo, tes koneksi AI';
    
    console.log('🔍 [TEST-AI] Testing AI with message:', testMessage);
    const response = await openaiService.generateAIResponse(testMessage, [], null);
    
    const responseData = {
      success: true,
      message: 'AI Test - Successful',
      test_message: testMessage,
      response: response,
      access_type: req.user ? 'authenticated' : 'guest',
      user_type: req.user ? (req.user.isPremium ? 'premium' : 'user') : 'guest',
      timestamp: new Date().toISOString()
    };

    // Tambahkan rate limit info jika ada
    if (res.get('X-RateLimit-Remaining')) {
      responseData.rate_limit = {
        remaining: parseInt(res.get('X-RateLimit-Remaining')),
        limit: parseInt(res.get('X-RateLimit-Limit')),
        reset: parseInt(res.get('X-RateLimit-Reset'))
      };
    }

    res.json(responseData);
  })
);

// Test koneksi OpenAI - GUEST FRIENDLY (NO RATE LIMIT - Diagnostic)
router.get('/test-openai', 
  guestFriendlyAuth, 
  asyncHandler(async (req, res) => {
    console.log('🔧 [TEST-OPENAI] Testing OpenAI connection...');
    
    const testResult = await openaiService.testOpenAIConnection();
    
    if (testResult.success) {
      res.json({
        success: true,
        message: 'OpenAI Connection Test - Successful',
        response: testResult.message,
        model: testResult.model,
        access_type: req.user ? 'authenticated' : 'guest',
        user_type: req.user ? (req.user.isPremium ? 'premium' : 'user') : 'guest',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: testResult.error,
        message: 'OpenAI Connection Test - Failed'
      });
    }
  })
);

// Test Embedding Function - GUEST FRIENDLY (NO RATE LIMIT - Diagnostic)
router.get('/test-embedding', 
  guestFriendlyAuth, 
  asyncHandler(async (req, res) => {
    console.log('🧬 [TEST-EMBEDDING] Testing embedding function...');
    
    const testText = "Lokasi kampus Tazkia di Sentul City Bogor";
    const embedding = await openaiService.createEmbedding(testText);
    
    res.json({
      success: true,
      message: 'Embedding Test - Successful',
      test_text: testText,
      dimensions: embedding.length,
      sample: embedding.slice(0, 5),
      access_type: req.user ? 'authenticated' : 'guest',
      user_type: req.user ? (req.user.isPremium ? 'premium' : 'user') : 'guest',
      timestamp: new Date().toISOString()
    });
  })
);

// Test RAG System - GUEST FRIENDLY + RATE LIMITED
router.post('/test-rag', 
  guestFriendlyAuth, 
  aiSpecificRateLimit,
  asyncHandler(async (req, res) => {
    const { message } = req.body;
    const testMessage = message || 'lokasi kampus tazkia';
    
    console.log('🧪 [TEST-RAG] Testing RAG system with message:', testMessage);
    
    // Test search langsung
    const searchResults = await ragService.searchRelevantDocs(testMessage);
    console.log('🔍 [TEST-RAG] Search results:', searchResults.length, 'documents found');
    
    // Test full RAG process
    const ragResponse = await ragService.answerQuestion(testMessage, []);
    
    const responseData = {
      success: true,
      message: 'RAG System Test - Completed',
      test_query: testMessage,
      search_results_count: searchResults.length,
      search_results_preview: searchResults.map((doc, i) => ({
        index: i + 1,
        preview: doc.text ? doc.text.substring(0, 100) + '...' : 'No text'
      })),
      rag_response: ragResponse,
      access_type: req.user ? 'authenticated' : 'guest',
      user_type: req.user ? (req.user.isPremium ? 'premium' : 'user') : 'guest',
      timestamp: new Date().toISOString()
    };

    // Tambahkan rate limit info jika ada
    if (res.get('X-RateLimit-Remaining')) {
      responseData.rate_limit = {
        remaining: parseInt(res.get('X-RateLimit-Remaining')),
        limit: parseInt(res.get('X-RateLimit-Limit')),
        reset: parseInt(res.get('X-RateLimit-Reset'))
      };
    }

    res.json(responseData);
  })
);

// Public Test (Cek apakah API hidup) - PUBLIC (NO RATE LIMIT)
router.get('/public-test', (req, res) => {
  res.json({
    success: true,
    message: 'Sapa Tazkia AI Service is Ready (RAG Enabled)',
    timestamp: new Date().toISOString(),
    rag_enabled: true,
    guest_access: true,
    rate_limits_enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    version: '3.0' // ✅ UPDATE VERSION - ENHANCED RATE LIMITING
  });
});

// Health Check dengan detail - GUEST FRIENDLY (NO RATE LIMIT - Diagnostic)
router.get('/health', 
  guestFriendlyAuth, 
  asyncHandler(async (req, res) => {
    const collectionInfo = await ragService.getCollectionInfo();
    const dataCheck = validateDataDirectory();
    
    // Test OpenAI connection
    let openaiStatus = 'UNKNOWN';
    let openaiDetails = {};
    try {
      const testResult = await openaiService.testOpenAIConnection();
      openaiStatus = testResult.success ? 'HEALTHY' : 'UNHEALTHY';
      openaiDetails = testResult;
    } catch (error) {
      openaiStatus = 'ERROR: ' + error.message;
    }

    // Test embedding
    let embeddingStatus = 'UNKNOWN';
    try {
      const testEmbedding = await openaiService.createEmbedding('health check');
      embeddingStatus = testEmbedding.length === 1536 ? 'HEALTHY' : 'UNHEALTHY';
    } catch (error) {
      embeddingStatus = 'ERROR: ' + error.message;
    }
    
    // Test Redis connection untuk rate limiting
    let redisStatus = 'UNKNOWN';
    try {
      const redisService = require('../services/redisService');
      redisStatus = await redisService.healthCheck() ? 'HEALTHY' : 'UNHEALTHY';
    } catch (error) {
      redisStatus = 'ERROR: ' + error.message;
    }
    
    res.json({ 
      status: 'OK', 
      service: 'AI Service', 
      rag_enabled: true,
      rate_limiting: {
        enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
        redis: redisStatus
      },
      openai_status: openaiStatus,
      embedding_status: embeddingStatus,
      data_directory: dataCheck,
      knowledge_base: {
        exists: collectionInfo.exists,
        documents_count: collectionInfo.exists ? collectionInfo.pointsCount : 0,
        status: collectionInfo.exists ? 'READY' : 'NO_DATA'
      },
      access_type: req.user ? 'authenticated' : 'guest',
      user_type: req.user ? (req.user.isPremium ? 'premium' : 'user') : 'guest',
      timestamp: new Date().toISOString()
    });
  })
);

// Reset Knowledge Base (Hati-hati!) - PROTECTED (NO RATE LIMIT - Admin action)
router.post('/reset-knowledge', 
  authMiddleware.requireAuth, 
  asyncHandler(async (req, res) => {
    console.log('🔄 [RESET] Resetting knowledge base...');
    
    // Hanya admin yang bisa reset
    if (!req.user.isAdmin) {
      // Skip untuk development, uncomment untuk production
      // return res.status(403).json({
      //   success: false,
      //   message: 'Hanya admin yang dapat mereset knowledge base'
      // });
    }
    
    const result = await ragService.resetAndReingest();
    
    res.json({
      success: true,
      message: 'Knowledge Base Reset Successful',
      result
    });
  })
);

// Rate Limit Status Check - PUBLIC
router.get('/rate-limit-status',
  guestFriendlyAuth,
  asyncHandler(async (req, res) => {
    try {
      const rateLimitService = require('../services/rateLimitService');
      const userId = req.user?.id || null;
      const ipAddress = req.ip;
      const userType = req.user ? (req.user.isPremium ? 'premium' : 'user') : 'guest';
      
      const status = await rateLimitService.checkRateLimit(userId, ipAddress, userType);
      const bucketStatus = await rateLimitService.checkTokenBucket(userId, ipAddress, userType);
      
      res.json({
        success: true,
        data: {
          user_type: userType,
          authenticated: !!req.user,
          window_limits: status,
          token_bucket: bucketStatus,
          adaptive_limits: await rateLimitService.getAdaptiveLimit(userType)
        }
      });
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rate limit status'
      });
    }
  })
);

/**
 * ============================================================================
 * ERROR HANDLING & DOCUMENTATION
 * ============================================================================
 */

// Error handling middleware khusus untuk routes ini
router.use((error, req, res, next) => {
  console.error('❌ [ROUTE ERROR] Unhandled error:', error);
  
  // Handle rate limit errors specifically
  if (error.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: error.message,
      retry_after: error.retryAfter,
      limit: error.limit,
      reset_time: error.resetTime
    });
  }
  
  res.status(500).json({
    success: false,
    error: error.message,
    message: 'Terjadi kesalahan internal server'
  });
});

// Dokumentasi Route Sederhana - PUBLIC
router.get('/', (req, res) => {
  res.json({
    message: '🤖 SAPA TAZKIA AI API v3.0 (Enhanced Rate Limiting)',
    description: 'AI Chatbot dengan RAG untuk Universitas Tazkia',
    endpoints: {
      public: {
        chat: 'POST /api/ai/chat (Guest/Auth - ENHANCED RATE LIMITED)',
        status: 'GET /api/ai/knowledge-status (Guest/Auth)',
        health: 'GET /api/ai/health (Guest/Auth)',
        test: 'GET /api/ai/public-test (Guest/Auth)',
        test_embedding: 'GET /api/ai/test-embedding (Guest/Auth)',
        test_rag: 'POST /api/ai/test-rag (Guest/Auth - RATE LIMITED)',
        rate_limit_status: 'GET /api/ai/rate-limit-status (Guest/Auth)'
      },
      protected: {
        ingest: 'POST /api/ai/ingest (Auth Only)',
        conversations: 'GET /api/ai/conversations (Auth Only)',
        history: 'GET /api/ai/history/:chatId (Auth Only)',
        analyze_academic: 'POST /api/ai/analyze-academic (Auth Only - RATE LIMITED)',
        study_recommendations: 'POST /api/ai/study-recommendations (Auth Only - RATE LIMITED)'
      },
      utility: {
        manual_ingest: 'POST /api/ai/ingest-now (Guest/Auth - Testing)',
        test_openai: 'GET /api/ai/test-openai (Guest/Auth)',
        test_ai: 'POST /api/ai/test-ai (Guest/Auth - RATE LIMITED)',
        reset_knowledge: 'POST /api/ai/reset-knowledge (Auth Only)'
      }
    },
    rate_limits: {
      guest: '10 requests / minute, 50 / hour, 200 / day',
      user: '30 requests / minute, 200 / hour, 1000 / day', 
      premium: '100 requests / minute, 1000 / hour, 5000 / day',
      ip_based: '20 requests / minute (additional security)',
      adaptive: 'Automatic reduction under high system load',
      status: process.env.RATE_LIMIT_ENABLED !== 'false' ? 'ACTIVE' : 'DISABLED'
    },
    guest_features: [
      'Chat dengan AI + RAG (Rate Limited)',
      'Akses knowledge base', 
      'Cek status sistem',
      'Test ingestion (untuk development)',
      'Test embedding & OpenAI',
      'Test RAG system (Rate Limited)',
      'Check rate limit status'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;