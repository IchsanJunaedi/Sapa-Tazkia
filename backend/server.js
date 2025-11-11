const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const passport = require('passport'); // Import Passport
require('dotenv').config(); // Panggil dotenv PALING PERTAMA

// --- PENTING: Memuat Konfigurasi Passport, Serializer, dan Strategi ---
// Passport dan strateginya (GoogleStrategy) harus dijalankan sekali di awal.
require('./src/services/authService');

// --- Impor Service & Middleware ---
const { generateGeminiResponse, testGeminiConnection } = require('./src/services/geminiService');
const { requireAuth, optionalAuth } = require('./src/middleware/authMiddleware'); // Pastikan authMiddleware Anda bekerja dengan JWT
const { getAcademicSummary, getGradesBySemester, getTranscript } = require('./src/services/academicService');
const { generateTranscriptPDF } = require('./src/services/pdfService');

// --- Impor Rute Auth ---
const authRoutes = require('./src/routes/authRoutes');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware

// --- Konfigurasi CORS (PERBAIKAN LENGKAP) ---
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://192.168.100.48:3000' 
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Alamat ini tidak diizinkan oleh CORS'));
    }
  },
  methods: 'GET,POST,DELETE,PUT,PATCH',
  allowedHeaders: 'Content-Type,Authorization',
  credentials: true // Dipertahankan untuk header 'Authorization'
};

app.use(cors(corsOptions));

app.use(express.json());

// Inisialisasi Passport (Tanpa session, karena kita pakai JWT)
app.use(passport.initialize());
// app.use(passport.session()); <-- Dihapus karena kita pakai JWT/Token

// Rate limiting map (Tetap sama)
const rateLimitMap = new Map();

function rateLimiter(req, res, next) {
  const userId = req.user?.id || req.body.userId || 'anonymous';
  const today = new Date().toDateString();
  const key = `${userId}-${today}`;
  const count = rateLimitMap.get(key) || 0;
  if (count >= 100) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Anda telah mencapai batas maksimal request per hari.'
    });
  }
  rateLimitMap.set(key, count + 1);
  next();
}

// Helper functions (Tetap sama)
function detectIntent(message) {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('pendaftaran') || lowerMessage.includes('daftar')) {
    return 'pendaftaran';
  } else if (lowerMessage.includes('program studi') || lowerMessage.includes('prodi') || lowerMessage.includes('jurusan')) {
    return 'program_studi';
  } else if (lowerMessage.includes('biaya') || lowerMessage.includes('uang kuliah') || lowerMessage.includes('spp')) {
    return 'biaya';
  } else if (lowerMessage.includes('lokasi') || lowerMessage.includes('alamat') || lowerMessage.includes('dimana')) {
    return 'lokasi';
  } else if (lowerMessage.includes('fasilitas') || lowerMessage.includes('lab') || lowerMessage.includes('perpustakaan')) {
    return 'fasilitas';
  } else if (lowerMessage.includes('beasiswa')) {
    return 'beasiswa';
  } else if (lowerMessage.includes('nilai') || lowerMessage.includes('ipk') || lowerMessage.includes('transkrip')) {
    return 'akademik_personal';
  } else {
    return 'general';
  }
}

function requiresAuthentication(message) {
  const authKeywords = [
    'nilai saya', 'ipk saya', 'transkrip saya', 'akademik saya', 'data saya',
    'jadwal saya', 'krs saya', 'beasiswa saya', 'tagihan saya', 'pembayaran saya'
  ];
  const lowerMessage = message.toLowerCase();
  return authKeywords.some(keyword => lowerMessage.includes(keyword));
}

// ==================== HEALTH CHECK ====================
app.get('/', (req, res) => {
  res.json({
    message: 'Sapa Tazkia Backend API',
    version: '3.0.0',
    status: 'running',
    ai: 'Google Gemini 2.5 Flash',
    features: [
      'AI Chat',
      'JWT Authentication',
      'Google OAuth 2.0',
      'Academic Data',
      'PDF Export',
      'RAG Ready'
    ]
  });
});

// ==================== AUTH ROUTES ====================
app.use('/api/auth', authRoutes);

// ==================== ACADEMIC ROUTES ====================

/**
 * GET /api/academic/summary
 */
app.get('/api/academic/summary', requireAuth, async (req, res) => {
  try {
    const result = await getAcademicSummary(req.user.id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Get academic summary route error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

/**
 * GET /api/academic/grades
 */
app.get('/api/academic/grades', requireAuth, async (req, res) => {
  try {
    const { semester } = req.query;
    const result = await getGradesBySemester(req.user.id, semester);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Get grades route error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

/**
 * GET /api/academic/transcript
 */
app.get('/api/academic/transcript', requireAuth, async (req, res) => {
  try {
    const result = await getTranscript(req.user.id);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error('Get transcript route error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

/**
 * GET /api/academic/transcript/pdf
 */
app.get('/api/academic/transcript/pdf', requireAuth, async (req, res) => {
  try {
    const result = await generateTranscriptPDF(req.user.id);
    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message
      });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    result.doc.pipe(res);
    result.doc.end();
  } catch (error) {
    console.error('Generate PDF route error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

// ==================== AI CHAT ROUTES ====================

/**
 * GET /api/test-gemini
 */
app.get('/api/test-gemini', async (req, res) => {
  try {
    const result = await testGeminiConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'Sapa Tazkia Backend'
    });
});

/**
 * POST /api/test-ai
 */
app.post('/api/test-ai', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await generateGeminiResponse(message, []);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/chat
 */
app.post('/api/chat', optionalAuth, rateLimiter, async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, conversationId: reqConversationId } = req.body;
    const userId = req.user?.id;
    let conversationId = reqConversationId ? parseInt(reqConversationId) : null;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }
    if (message.length > 500) {
      return res.status(400).json({ error: 'Pesan terlalu panjang (maksimal 500 karakter)' });
    }

    const intent = detectIntent(message);
    console.log(`📊 Intent detected: ${intent}`);

    if (requiresAuthentication(message) && !req.user) {
      return res.json({
        reply: 'Untuk mengakses informasi akademik pribadi Anda, silakan login terlebih dahulu dengan mengklik tombol "Login Mahasiswa" di sidebar. 🔐',
        requiresAuth: true,
        conversationId: conversationId,
        timestamp: new Date().toISOString()
      });
    }

    let conversation = null;
    let history = [];

    if (userId) {
      if (conversationId) {
        conversation = await prisma.conversation.findUnique({
          where: { id: conversationId }
        });
      }
      if (!conversation) {
        const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        conversation = await prisma.conversation.create({
          data: {
            userId: userId,
            title: title
          }
        });
        conversationId = conversation.id;
      }
      await prisma.message.create({
        data: {
          conversationId: conversationId,
          role: 'user',
          content: message
        }
      });
      history = await prisma.message.findMany({
        where: { conversationId: conversationId },
        orderBy: { createdAt: 'asc' },
        take: 10
      });
    }

    console.log('🤖 Generating Gemini response...');
    let aiReply = await generateGeminiResponse(message, history);
    let academicData = null;

    if (req.user && intent === 'akademik_personal') {
      try {
        const summaryResult = await getAcademicSummary(req.user.id);
        if (summaryResult.success) {
          academicData = summaryResult.data;
          aiReply = `Berdasarkan data akademik Anda:\n\n` +
            `📊 **IPK**: ${academicData.ipk.toFixed(2)}\n` +
            `📚 **Total SKS**: ${academicData.totalSks}\n` +
            `📈 **IPS Semester Terakhir**: ${academicData.ipsLastSemester.toFixed(2)}\n` +
            `🎓 **Semester Aktif**: ${academicData.semesterActive}\n\n` +
            `${aiReply}\n\n` +
            `Apakah Anda ingin saya tampilkan nilai per semester dalam bentuk PDF?`;
        }
      } catch (error) {
        console.error('Error fetching academic data:', error);
      }
    }

    const responseTime = (Date.now() - startTime) / 1000;

    if (userId) {
      await prisma.message.create({
        data: {
          conversationId: conversationId,
          role: 'bot',
          content: aiReply,
          responseTime: responseTime
        }
      });
    }

    const hasPDF = (req.user && intent === 'akademik_personal') ||
      aiReply.toLowerCase().includes('pdf') ||
      aiReply.toLowerCase().includes('transkrip');

    res.json({
      reply: aiReply,
      conversationId: conversationId,
      hasPDF: hasPDF,
      intent: intent,
      responseTime: responseTime,
      academicData: academicData,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Response sent in ${responseTime.toFixed(2)}s`);

  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({
      error: 'Terjadi kesalahan server',
      message: error.message
    });
  }
});

// ==================== CHAT HISTORY ROUTES ====================
app.get('/api/chat/history/:conversationId', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await prisma.message.findMany({
      where: {
        conversationId: parseInt(conversationId),
        // KEAMANAN: Pastikan conversation ini milik user yang login
        conversation: {
          userId: req.user.id
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true
      }
    });
    res.json({ messages });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Terjadi kesalahan server'
    });
  }
});

app.get('/api/chat/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: {
          select: { messages: true }
        }
      },
      take: 20
    });
    res.json({ conversations });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Terjadi kesalahan server'
    });
  }
});

app.delete('/api/chat/conversation/:conversationId', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: parseInt(conversationId),
        userId: req.user.id
      }
    });
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation tidak ditemukan'
      });
    }
    await prisma.message.deleteMany({
      where: { conversationId: parseInt(conversationId) }
    });
    await prisma.conversation.delete({
      where: { id: parseInt(conversationId) }
    });
    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: 'Terjadi kesalahan server'
    });
  }
});

// ==================== SERVER START ====================

// Graceful shutdown (Tetap sama)
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════╗
  ║   🚀 Sapa Tazkia Backend Server v3.0     ║
  ║   📡 Port: ${PORT}                      ║
  ║   🌐 URL: http://localhost:${PORT}          ║
  ║   🤖 AI: Google Gemini 2.5 Flash           ║
  ║   🔐 Auth: JWT & Google OAuth Enabled      ║
  ║   📊 Database: Connected                   ║
  ║   ✅ Status: Ready                         ║
  ╚════════════════════════════════════════════╝
  `);
});