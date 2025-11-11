const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
// --- Panggil dotenv PALING PERTAMA ---
require('dotenv').config();

// --- BARU: Impor untuk Passport ---
const session = require('express-session');
const passport = require('passport');

// --- Impor Service (Auth Service dihapus) ---
const { generateGeminiResponse, testGeminiConnection } = require('./src/services/geminiService');
// const { login, logout, verifySession, register } = require('./src/services/authService'); // <-- DIHAPUS
const { requireAuth, optionalAuth } = require('./src/middleware/authMiddleware');
const { getAcademicSummary, getGradesBySemester, getTranscript } = require('./src/services/academicService');
const { generateTranscriptPDF } = require('./src/services/pdfService');

// --- BARU: Impor Rute Auth ---
const authRoutes = require('./src/routes/authRoutes');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware

// --- Konfigurasi CORS (PERBAIKAN LENGKAP) ---
// 1. Buat daftar alamat (origin) yang diizinkan
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000', // Ambil dari .env ATAU default
  'http://192.168.100.48:3000' // Tambahkan alamat IP frontend Anda
];

const corsOptions = {
  origin: function (origin, callback) {
    // Izinkan jika origin ada di daftar 'allowedOrigins'
    // Izinkan juga jika origin 'undefined' (misal: request dari Postman, atau server-to-server)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Alamat ini tidak diizinkan oleh CORS'));
    }
  },
  methods: 'GET,POST,DELETE,PUT,PATCH',
  allowedHeaders: 'Content-Type,Authorization',
  credentials: true // <-- WAJIB ADA untuk Passport/session
};

app.use(cors(corsOptions));

app.use(express.json());

// --- BARU: Middleware untuk Session & Passport ---
// Wajib ada SEBELUM rute auth
app.use(
  session({
    // Tambahkan SESSION_SECRET=... di file .env Anda!
    secret: process.env.SESSION_SECRET || 'ganti-ini-dengan-rahasia-super-panjang',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production' // 'true' jika pakai HTTPS
    },
  })
);

// Inisialisasi Passport
app.use(passport.initialize());
app.use(passport.session());
// --- AKHIR BLOK BARU ---


// Rate limiting map (Tetap sama)
const rateLimitMap = new Map();

function rateLimiter(req, res, next) {
  // ... (Logika rateLimiter Anda tetap sama)
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
  // ... (Logika detectIntent Anda tetap sama)
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
  // ... (Logika requiresAuthentication Anda tetap sama)
  const authKeywords = [
    'nilai saya', 'ipk saya', 'transkrip saya', 'akademik saya', 'data saya',
    'jadwal saya', 'krs saya', 'beasiswa saya', 'tagihan saya', 'pembayaran saya'
  ];
  const lowerMessage = message.toLowerCase();
  return authKeywords.some(keyword => lowerMessage.includes(keyword));
}

// ==================== HEALTH CHECK ====================
app.get('/', (req, res) => {
  // ... (Rute Health Check Anda tetap sama)
  res.json({
    message: 'Sapa Tazkia Backend API',
    version: '3.0.0',
    status: 'running',
    ai: 'Google Gemini 2.5 Flash',
    features: [
      'AI Chat',
      'JWT Authentication',
      'Google OAuth 2.0', // Ditambahkan
      'Academic Data',
      'PDF Export',
      'RAG Ready'
    ]
  });
});

// ==================== AUTH ROUTES ====================
// DIPERBARUI: Semua rute /api/auth sekarang ditangani oleh file authRoutes.js
app.use('/api/auth', authRoutes);

// --- SEMUA RUTE AUTH YANG LAMA (REGISTER, LOGIN, LOGOUT, VERIFY, ME) DIHAPUS DARI SINI ---
// ...
// ... (Blok kode dari /api/auth/register sampai /api/auth/me telah dihapus)
// ...


// ==================== ACADEMIC ROUTES ====================
// (Rute-rute ini tetap sama dan sudah benar)

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
// (Rute-rute ini tetap sama dan sudah benar)

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
  // ... (Logika /api/chat Anda tetap sama)
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
// PERBAIKAN: Mengganti optionalAuth menjadi requireAuth untuk keamanan
app.get('/api/chat/history/:conversationId', requireAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await prisma.message.findMany({
      where: {
        conversationId: parseInt(conversationId),
        // PERBAIKAN KEAMANAN: Pastikan conversation ini milik user yang login
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

// PERBAIKAN: Hapus :userId dari URL, kita akan gunakan req.user.id
// PERBAIKAN: Mengganti optionalAuth menjadi requireAuth
app.get('/api/chat/conversations', requireAuth, async (req, res) => {
  try {
    // PERBAIKAN: Selalu gunakan ID dari user yang terotentikasi, jangan dari parameter
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
  // ... (Logika /api/chat/conversation/:conversationId Anda tetap sama)
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
  // ... (Logika startup Anda tetap sama)
  console.log(`
  ╔════════════════════════════════════════════╗
  ║   🚀 Sapa Tazkia Backend Server v3.0     ║
  ║   📡 Port: ${PORT}                         ║
  ║   🌐 URL: http://localhost:${PORT}             ║
  ║   🤖 AI: Google Gemini 2.5 Flash           ║
  ║   🔐 Auth: JWT & Google OAuth Enabled      ║
  ║   📊 Database: Connected                   ║
  ║   ✅ Status: Ready                         ║
  ╚════════════════════════════════════════════╝
  `);
});