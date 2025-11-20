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
 * MIDDLEWARE SETUP - FIXED WITH GUEST-FRIENDLY AUTH
 * ============================================================================
 */

// ✅ GUEST-FRIENDLY AUTH: Menggunakan middleware baru yang sudah diperbaiki
const guestFriendlyAuth = authMiddleware.guestFriendlyAuth;

// ✅ BACKWARD COMPATIBILITY: Optional auth untuk routes yang butuh lebih strict
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authMiddleware.requireAuth(req, res, next);
  }
  
  req.user = null;
  console.log('👤 [AUTH] Guest access detected');
  next();
};

/**
 * ============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================
 */

// Function untuk cek dan validasi data directory
const validateDataDirectory = () => {
  const dataDir = path.join(__dirname, '../../data'); // ✅ PATH YANG BENAR: backend/data/
  
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

/**
 * ============================================================================
 * 1. PUBLIC / HYBRID ROUTES (BISA GUEST, BISA LOGIN) - FIXED AUTH
 * ============================================================================
 */

// ✅ CHAT ROUTE UTAMA (RAG INTEGRATED) - GUEST FRIENDLY
router.post('/chat', guestFriendlyAuth, aiController.sendChat);

// ✅ PUBLIC KNOWLEDGE BASE STATUS - GUEST FRIENDLY
router.get('/knowledge-status', guestFriendlyAuth, async (req, res) => {
  try {
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
    
  } catch (error) {
    console.error('❌ [DEBUG] Status check failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: "Gagal memeriksa status knowledge base" 
    });
  }
});

// ✅ MANUAL INGESTION TRIGGER - PUBLIC (GUEST FRIENDLY) - FIXED
router.post('/ingest-now', guestFriendlyAuth, async (req, res) => {
  try {
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
    const result = await ragService.ingestData();
    
    // ✅ FIX: Perbaikan pengecekan result yang undefined
    if (result && result.success) {
      // Cek status setelah ingestion
      const afterStatus = await ragService.getCollectionInfo();
      
      console.log(`✅ [INGEST] Success: ${result.count} chunks from ${result.filesProcessed?.length || 0} files`);
      console.log('📊 [INGEST] Status sesudah:', afterStatus);
      
      const responseData = { 
        success: true, 
        message: `Berhasil memproses ${result.count} data dari ${result.filesProcessed?.length || 0} file`,
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
      
      // ✅ FIX: Definisikan errorResponse dengan benar
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
    
  } catch (error) {
    console.error('❌ [INGEST] Error:', error);
    
    // ✅ FIX: Definisikan errorResponse di catch block
    const errorResponse = {
      success: false,
      error: error.message,
      message: "Terjadi error saat proses ingestion"
    };
    
    // Berikan saran berdasarkan jenis error
    if (error.message.includes('Qdrant') || error.message.includes('connection')) {
      errorResponse.suggestion = 'Pastikan Qdrant container berjalan: docker-compose up -d qdrant';
    } else if (error.message.includes('ENOENT') || error.message.includes('no such file')) {
      errorResponse.suggestion = 'Pastikan folder data exists: backend/data/ dengan file .md di dalamnya';
    } else if (error.message.includes('directory') || error.message.includes('path')) {
      errorResponse.suggestion = 'Pastikan struktur folder benar. Data harus di: backend/data/';
    } else if (error.message.includes('OpenAI') || error.message.includes('API key')) {
      errorResponse.suggestion = 'Cek OpenAI API key di environment variables';
    }

    res.status(500).json(errorResponse);
  }
});

/**
 * ============================================================================
 * 2. PROTECTED ROUTES (WAJIB LOGIN) - UNCHANGED
 * ============================================================================
 */

// ✅ KNOWLEDGE BASE INGESTION (PROTECTED)
router.post('/ingest', authMiddleware.requireAuth, async (req, res) => {
  try {
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
    const result = await ragService.ingestData();
    
    if (result && result.success) {
      const afterStatus = await ragService.getCollectionInfo();
      console.log(`✅ [INGEST] Success: ${result.count} chunks from ${result.filesProcessed?.length || 0} files`);
      
      res.json({ 
        success: true, 
        message: `Berhasil memproses ${result.count} data dari ${result.filesProcessed?.length || 0} file`,
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
    
  } catch (error) {
    console.error('❌ [INGEST] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: "Gagal memproses data pengetahuan" 
    });
  }
});

// ✅ MANAJEMEN PERCAKAPAN (PROTECTED)
router.get('/conversations', authMiddleware.requireAuth, aiController.getConversations);
router.get('/history/:chatId', authMiddleware.requireAuth, aiController.getChatHistory);
router.delete('/conversations/:chatId', authMiddleware.requireAuth, aiController.deleteConversation);

// ✅ FITUR AKADEMIK (PROTECTED)
router.post('/analyze-academic', authMiddleware.requireAuth, aiController.analyzeAcademicPerformance);
router.post('/study-recommendations', authMiddleware.requireAuth, aiController.getStudyRecommendations);

/**
 * ============================================================================
 * 3. TEST & UTILITY ROUTES (PUBLIC) - GUEST FRIENDLY
 * ============================================================================
 */

// Test koneksi AI sederhana - GUEST FRIENDLY
router.post('/test-ai', guestFriendlyAuth, async (req, res) => {
  try {
    const { message } = req.body;
    const testMessage = message || 'Halo, tes koneksi AI';
    
    console.log('🔍 [TEST-AI] Testing AI with message:', testMessage);
    const response = await openaiService.generateAIResponse(testMessage, [], null);
    
    res.json({
      success: true,
      message: 'AI Test - Successful',
      test_message: testMessage,
      response: response,
      access_type: req.user ? 'authenticated' : 'guest',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [TEST-AI] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'AI Test - Failed'
    });
  }
});

// Test koneksi OpenAI - GUEST FRIENDLY
router.get('/test-openai', guestFriendlyAuth, async (req, res) => {
  try {
    console.log('🔧 [TEST-OPENAI] Testing OpenAI connection...');
    
    const testResult = await openaiService.testOpenAIConnection();
    
    if (testResult.success) {
      res.json({
        success: true,
        message: 'OpenAI Connection Test - Successful',
        response: testResult.message,
        model: testResult.model,
        access_type: req.user ? 'authenticated' : 'guest',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: testResult.error,
        message: 'OpenAI Connection Test - Failed'
      });
    }
  } catch (error) {
    console.error('❌ [TEST-OPENAI] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'OpenAI Connection Test - Failed'
    });
  }
});

// Test Embedding Function - GUEST FRIENDLY
router.get('/test-embedding', guestFriendlyAuth, async (req, res) => {
  try {
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
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [TEST-EMBEDDING] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Embedding Test - Failed'
    });
  }
});

// Test RAG System - NEW ENDPOINT - GUEST FRIENDLY
router.post('/test-rag', guestFriendlyAuth, async (req, res) => {
  try {
    const { message } = req.body;
    const testMessage = message || 'lokasi kampus tazkia';
    
    console.log('🧪 [TEST-RAG] Testing RAG system with message:', testMessage);
    
    // Test search langsung
    const searchResults = await ragService.searchRelevantDocs(testMessage);
    console.log('🔍 [TEST-RAG] Search results:', searchResults.length, 'documents found');
    
    // Test full RAG process
    const ragResponse = await ragService.answerQuestion(testMessage, []);
    
    res.json({
      success: true,
      message: 'RAG System Test - Completed',
      test_query: testMessage,
      search_results_count: searchResults.length,
      search_results_preview: searchResults.map((doc, i) => ({
        index: i + 1,
        preview: doc.substring(0, 100) + '...'
      })),
      rag_response: ragResponse,
      access_type: req.user ? 'authenticated' : 'guest',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [TEST-RAG] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'RAG System Test - Failed'
    });
  }
});

// Public Test (Cek apakah API hidup) - PUBLIC
router.get('/public-test', (req, res) => {
  res.json({
    success: true,
    message: 'Sapa Tazkia AI Service is Ready (RAG Enabled)',
    timestamp: new Date().toISOString(),
    rag_enabled: true,
    guest_access: true,
    version: '2.5' // ✅ UPDATE VERSION - FIXED ERROR HANDLING
  });
});

// Health Check dengan detail - GUEST FRIENDLY
router.get('/health', guestFriendlyAuth, async (req, res) => {
  try {
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
    
    res.json({ 
      status: 'OK', 
      service: 'AI Service', 
      rag_enabled: true,
      openai_status: openaiStatus,
      embedding_status: embeddingStatus,
      data_directory: dataCheck,
      knowledge_base: {
        exists: collectionInfo.exists,
        documents_count: collectionInfo.exists ? collectionInfo.pointsCount : 0,
        status: collectionInfo.exists ? 'READY' : 'NO_DATA'
      },
      access_type: req.user ? 'authenticated' : 'guest',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [HEALTH] Error:', error);
    res.status(500).json({
      status: 'ERROR',
      service: 'AI Service',
      error: error.message
    });
  }
});

// Reset Knowledge Base (Hati-hati!) - PROTECTED
router.post('/reset-knowledge', authMiddleware.requireAuth, async (req, res) => {
  try {
    console.log('🔄 [RESET] Resetting knowledge base...');
    
    // Hanya admin yang bisa reset
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Hanya admin yang dapat mereset knowledge base'
      });
    }
    
    // Logic reset akan ditambahkan nanti
    res.json({
      success: true,
      message: 'Reset endpoint - under development'
    });
    
  } catch (error) {
    console.error('❌ [RESET] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Dokumentasi Route Sederhana - PUBLIC
router.get('/', (req, res) => {
  res.json({
    message: '🤖 SAPA TAZKIA AI API v2.5 (Guest-Friendly RAG System)',
    description: 'AI Chatbot dengan RAG untuk Universitas Tazkia - FIXED ERROR HANDLING',
    endpoints: {
      public: {
        chat: 'POST /api/ai/chat (Guest/Auth)',
        status: 'GET /api/ai/knowledge-status (Guest/Auth)',
        health: 'GET /api/ai/health (Guest/Auth)',
        test: 'GET /api/ai/public-test (Guest/Auth)',
        test_embedding: 'GET /api/ai/test-embedding (Guest/Auth)',
        test_rag: 'POST /api/ai/test-rag (Guest/Auth)'
      },
      protected: {
        ingest: 'POST /api/ai/ingest (Auth Only)',
        conversations: 'GET /api/ai/conversations (Auth Only)',
        history: 'GET /api/ai/history/:chatId (Auth Only)'
      },
      utility: {
        manual_ingest: 'POST /api/ai/ingest-now (Guest/Auth - Testing)',
        test_openai: 'GET /api/ai/test-openai (Guest/Auth)',
        test_ai: 'POST /api/ai/test-ai (Guest/Auth)'
      }
    },
    guest_features: [
      'Chat dengan AI + RAG',
      'Akses knowledge base', 
      'Cek status sistem',
      'Test ingestion (untuk development)',
      'Test embedding & OpenAI',
      'Test RAG system'
    ],
    next_steps: [
      '1. POST /api/ai/ingest-now - Untuk mengisi knowledge base',
      '2. GET /api/ai/knowledge-status - Untuk cek status data',
      '3. POST /api/ai/chat - Untuk test chat dengan RAG'
    ],
    fixes_in_v2_5: [
      '✅ Fixed error handling in /ingest-now route',
      '✅ Fixed undefined variable errorResponse',
      '✅ Added data directory validation',
      '✅ Improved error messages and suggestions'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;