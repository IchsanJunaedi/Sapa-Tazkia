const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { generateAIResponse, requiresAuthentication, detectIntent } = require('./src/services/aiService');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting map (simple in-memory, untuk production gunakan Redis)
const rateLimitMap = new Map();

// Rate limiting middleware (50 requests per day per user)
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

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sapa Tazkia Backend API',
    version: '2.0.0',
    status: 'running',
    ai: 'OpenAI GPT-4o-mini',
    features: ['AI Chat', 'RAG Ready', 'Authentication Ready']
  });
});

// Chat endpoint dengan AI Integration
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
    
    // Check if requires authentication
    if (requiresAuthentication(message)) {
      // TODO: Implement real authentication check
      // For now, simulate
      const isAuthenticated = userId !== 1; // 1 = guest user
      
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
    
    // Gunakan conversation yang ada atau buat baru
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: parseInt(conversationId) }
      });
    }
    
    if (!conversation) {
      // Buat conversation baru dengan title smart
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
    
    // Get conversation history untuk context
    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 10 // Ambil 10 pesan terakhir
    });
    
    // Generate AI response
    console.log('🤖 Generating AI response...');
    const aiReply = await generateAIResponse(message, history);
    
    // Calculate response time
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
    
    // Check if response contains academic data
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

// Get chat history by conversation ID
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

// Get all conversations by user
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

// Delete conversation
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

// Test AI endpoint (untuk development)
app.post('/api/test-ai', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await generateAIResponse(message);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  ║   🤖 AI: OpenAI GPT-4o-mini               ║
  ║   📊 Database: Connected                   ║
  ║   ✅ Status: Ready                         ║
  ╚════════════════════════════════════════════╝
  `);
});