const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Sapa Tazkia Backend with Database!' });
});

// Chat endpoint dengan database
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId = 1 } = req.body; // userId default 1 untuk testing
    
    // Cari atau buat conversation
    let conversation = await prisma.conversation.findFirst({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: userId,
          title: 'Chat Session'
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
    
    // Generate response bot (masih simple)
    const botReply = `Saya menerima pesan Anda: "${message}". Fitur AI akan segera ditambahkan!`;
    
    // Simpan pesan bot
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'bot',
        content: botReply
      }
    });
    
    res.json({ 
      reply: botReply,
      conversationId: conversation.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});

// Endpoint untuk lihat riwayat chat
app.get('/api/chat/history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const messages = await prisma.message.findMany({
      where: { conversationId: parseInt(conversationId) },
      orderBy: { createdAt: 'asc' }
    });
    
    res.json({ messages });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
});
// Start server
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   🚀 Sapa Tazkia Backend Server      ║
  ║   📡 Port: ${PORT}                      ║
  ║   🌐 URL: http://localhost:${PORT}     ║
  ║   📊 Database: Connected              ║
  ╚═══════════════════════════════════════╝
  `);
});