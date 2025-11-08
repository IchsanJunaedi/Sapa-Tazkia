const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
// --- Panggil dotenv PALING PERTAMA ---
require('dotenv').config();

const { generateGeminiResponse, testGeminiConnection } = require('./src/services/geminiService');
const { login, logout, verifySession, register } = require('./src/services/authService');
const { requireAuth, optionalAuth } = require('./src/middleware/authMiddleware');
const { getAcademicSummary, getGradesBySemester, getTranscript } = require('./src/services/academicService');
const { generateTranscriptPDF } = require('./src/services/pdfService');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware

// --- PERBAIKAN CORS LENGKAP ---
// Ini adalah konfigurasi yang benar untuk mengizinkan
// origin DAN header 'Authorization'
const corsOptions = {
  origin: 'http://localhost:3000', // Izinkan frontend Anda
  methods: 'GET,POST,DELETE,PUT,PATCH', // Izinkan metode ini
  allowedHeaders: 'Content-Type,Authorization', // Izinkan header ini
};
app.use(cors(corsOptions));
// --- AKHIR PERBAIKAN ---

app.use(express.json());

// Rate limiting map
const rateLimitMap = new Map();

function rateLimiter(req, res, next) {
  const userId = req.user?.id || req.body.userId || 'anonymous';
  const today = new Date().toDateString();
  const key = `${userId}-${today}`;

  const count = rateLimitMap.get(key) || 0;

  if (count >= 100) { // Increased for authenticated users
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Anda telah mencapai batas maksimal request per hari.'
    });
  }

  rateLimitMap.set(key, count + 1);
  next();
}

// Helper functions
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
      'Academic Data',
      'PDF Export',
      'RAG Ready'
    ]
  });
});

// ==================== AUTH ROUTES ====================

/**
 * POST /api/auth/register
 * Register mahasiswa baru
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    // req.body akan berisi { fullName, nim, email, password } dari frontend
    const result = await register(req.body);

    if (!result.success) {
      // Jika error (misal: user sudah ada), kirim 400
      return res.status(400).json(result);
    }

    // Kirim 201 (Created)
    res.status(201).json(result);

  } catch (error) {
    console.error('Register route error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan server'
    });
  }
});


/**
 * POST /api/auth/login
 * Login mahasiswa
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    // Frontend sekarang mengirim 'nim', ini sudah benar
    const { nim, password } = req.body;

    // Validation
    if (!nim || !password) {
      return res.status(400).json({
        success: false,
        message: 'NIM dan password harus diisi'
      });
    }

    // Get IP and User Agent
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Login
    // authService.login Anda sudah benar menerima 'nim'
    const result = await login(nim, password, ipAddress, userAgent);

    if (!result.success) {
      return res.status(401).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('Login route error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout mahasiswa
 */
app.post('/api/auth/logout', requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization?.substring(7);
    const result = await logout(token);
    res.json(result);
  } catch (error) {
    console.error('Logout route error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify token validity
 */
app.get('/api/auth/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        valid: false,
        message: 'Token tidak ditemukan'
      });
    }

    const token = authHeader.substring(7);
    const result = await verifySession(token);

    if (!result.valid) {
      return res.status(401).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('Verify route error:', error);
    res.status(500).json({
      valid: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user data
 */
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user // req.user diisi oleh middleware requireAuth
    });
  } catch (error) {
    console.error('Get me route error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

// ==================== ACADEMIC ROUTES ====================

/**
 * GET /api/academic/summary
 * Get academic summary (IPK, SKS, etc)
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
 * Get grades (all semesters or specific semester)
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
 * Get full transcript data
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
 * Download transcript as PDF
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

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);

    // Pipe PDF to response
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
 * Test Gemini connection
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
 * Test AI response
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
 * Main chat endpoint dengan AI + Academic Data Integration
 */
app.post('/api/chat', optionalAuth, rateLimiter, async (req, res) => {
  const startTime = Date.now();

  try {
    const { message, conversationId: reqConversationId } = req.body;
    
    // --- PERBAIKAN BUG GUEST USER ---
    // 'userId' akan undefined jika guest, atau berisi ID jika login
    const userId = req.user?.id; 
    // --- AKHIR PERBAIKAN ---
    
    let conversationId = reqConversationId ? parseInt(reqConversationId) : null;

    // Validasi input
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Pesan terlalu panjang (maksimal 500 karakter)' });
    }

    // Detect intent
    const intent = detectIntent(message);
    console.log(`📊 Intent detected: ${intent}`);

    // Check if requires authentication
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

    // --- PERBAIKAN: HANYA berinteraksi dengan DB jika user LOGIN (userId ada) ---
    if (userId) {
      if (conversationId) {
        conversation = await prisma.conversation.findUnique({
          where: { id: conversationId }
        });
      }

      // Buat conversation baru jika tidak ada
      if (!conversation) {
        const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        conversation = await prisma.conversation.create({
          data: {
            userId: userId, // Ini sekarang aman
            title: title
          }
        });
        conversationId = conversation.id; // Dapatkan ID baru
      }

      // Simpan pesan user (hanya jika login)
      await prisma.message.create({
        data: {
          conversationId: conversationId,
          role: 'user',
          content: message
        }
      });

      // Get conversation history (hanya jika login)
      history = await prisma.message.findMany({
        where: { conversationId: conversationId },
        orderBy: { createdAt: 'asc' },
        take: 10
      });
    }
    // --- AKHIR PERBAIKAN BLOK DATABASE ---


    // Generate AI response (Jalan untuk Guest ataupun User Login)
    console.log('🤖 Generating Gemini response...');
    let aiReply = await generateGeminiResponse(message, history);

    // If user authenticated and asking about personal academic data
    let academicData = null;
    if (req.user && intent === 'akademik_personal') {
      try {
        const summaryResult = await getAcademicSummary(req.user.id);
        if (summaryResult.success) {
          academicData = summaryResult.data;

          // Enhance AI response with actual data
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

    // --- PERBAIKAN: HANYA simpan pesan bot jika user LOGIN ---
    if (userId) {
      // Simpan pesan bot
      await prisma.message.create({
        data: {
          conversationId: conversationId,
          role: 'bot',
          content: aiReply,
          responseTime: responseTime
        }
      });
    }
    // --- AKHIR PERBAIKAN ---

    const hasPDF = (req.user && intent === 'akademik_personal') ||
      aiReply.toLowerCase().includes('pdf') ||
      aiReply.toLowerCase().includes('transkrip');

    res.json({
      reply: aiReply,
      conversationId: conversationId, // Kirim ID-nya (bisa null jika guest)
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

app.get('/api/chat/history/:conversationId', optionalAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await prisma.message.findMany({
      where: {
        conversationId: parseInt(conversationId)
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

app.get('/api/chat/conversations/:userId', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id || parseInt(req.params.userId);

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

    // Verify ownership
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: parseInt(conversationId),
        userId: req.user.id
      }
    });

    if (!conversation) {
      // Perbaikan: 404 Not Found
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

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════╗
  ║   🚀 Sapa Tazkia Backend Server v3.0       ║
  ║   📡 Port: ${PORT}                         ║
  ║   🌐 URL: http://localhost:${PORT}         ║
  ║   🤖 AI: Google Gemini 2.5 Flash           ║
  ║   🔐 Auth: JWT Enabled                     ║
  ║   📊 Database: Connected                   ║
  ║   ✅ Status: Ready                         ║
  ╚════════════════════════════════════════════╝
  `);
});