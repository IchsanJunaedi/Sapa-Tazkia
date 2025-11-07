const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { generateGeminiResponse, testGeminiConnection } = require('./src/services/geminiService'); // GANTI INI
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000' // Hanya izinkan frontend Anda
}));
app.use(express.json());

// Rate limiting map
const rateLimitMap = new Map();

function rateLimiter(req, res, next) {
  const userId = req.body.userId || 'anonymous';
  const today = new Date().toDateString();
  const key = `${userId}-${today}`;
  
  const count = rateLimitMap.get(key) || 0;
  
  if (count >= 50) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded',
      message: 'Anda telah mencapai batas maksimal 50 chat per hari. Silakan coba lagi besok.'
    });
  }
  
  rateLimitMap.set(key, count + 1);
  next();
}

// Detect intent (helper function)
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
  } else if (lowerMessage.includes('tim developer') || lowerMessage.includes('timdev') || lowerMessage.includes('timdevelop')) {
    return 'tim_developer';
  } else {
    return 'general';
  }
}

function requiresAuthentication(message) {
  const authKeywords = [
    'nilai', 'ipk', 'transkrip', 'akademik saya', 'data saya', 
    'jadwal saya', 'krs', 'beasiswa saya', 'tagihan', 'pembayaran saya'
  ];
  
  const lowerMessage = message.toLowerCase();
  return authKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sapa Tazkia Backend API',
    version: '2.0.0',
    status: 'running',
    ai: 'Google Gemini 2.5 Flash',
    features: ['AI Chat', 'RAG Ready', 'Authentication Ready']
  });
});

// Test Gemini Connection
app.get('/api/test-gemini', async (req, res) => {
  try {
    const result = await testGeminiConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test AI endpoint
app.post('/api/test-ai', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await generateGeminiResponse(message, []); // GANTI FUNGSI
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat endpoint dengan Gemini
app.post('/api/chat', rateLimiter, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { message, userId = 1, conversationId } = req.body;
    
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
    
    // Check authentication
    if (requiresAuthentication(message)) {
      const isAuthenticated = userId !== 1;
      
      if (!isAuthenticated) {
        return res.json({
          reply: 'Untuk mengakses informasi akademik pribadi Anda, silakan login terlebih dahulu dengan mengklik tombol "Login Mahasiswa" di sidebar. 🔐',
          requiresAuth: true,
          conversationId: conversationId,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    let conversation;
    
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: parseInt(conversationId) }
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
    }
    
    // Simpan pesan user
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message
      }
    });
    
    // Get conversation history
    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 10
    });
    
    // Generate AI response dengan GEMINI
    console.log('🤖 Generating Gemini response...');
    const aiReply = await generateGeminiResponse(message, history); // GANTI FUNGSI
    
    const responseTime = (Date.now() - startTime) / 1000;
    
    // Simpan pesan bot
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'bot',
        content: aiReply,
        responseTime: responseTime
      }
    });
    
    const hasPDF = aiReply.toLowerCase().includes('pdf') || 
                   aiReply.toLowerCase().includes('transkrip') ||
                   intent === 'akademik_personal';
    
    res.json({ 
      reply: aiReply,
      conversationId: conversation.id,
      hasPDF: hasPDF,
      intent: intent,
      responseTime: responseTime,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Response sent in ${responseTime.toFixed(2)}s`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      error: 'Terjadi kesalahan server',
      message: error.message
    });
  }
});

// Other endpoints (history, conversations, delete) - TETAP SAMA seperti sebelumnya
app.get('/api/chat/history/:conversationId', async (req, res) => {
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

app.get('/api/chat/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const conversations = await prisma.conversation.findMany({
      where: { 
        userId: parseInt(userId) 
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

app.delete('/api/chat/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
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

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════╗
  ║   🚀 Sapa Tazkia Backend Server v2.0      ║
  ║   📡 Port: ${PORT}                           ║
  ║   🌐 URL: http://localhost:${PORT}          ║
  ║   🤖 AI: Google Gemini 2.5 Flash          ║
  ║   📊 Database: Connected                   ║
  ║   ✅ Status: Ready                         ║
  ╚════════════════════════════════════════════╝
  `);
});