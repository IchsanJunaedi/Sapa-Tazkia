const ragService = require('../services/ragService'); 
const { generateAIResponse, testOpenAIConnection } = require('../services/openaiService');
const academicService = require('../services/academicService');
const rateLimitService = require('../services/rateLimitService'); 
const prisma = require('../../config/prisma');

/**
 * ============================================================================
 * 1. FITUR UTAMA: CHATBOT INTELLIGENT (USER LOGIN MODE)
 * ============================================================================
 */

const sendChat = async (req, res) => {
  let currentConversationId = null;
  let shouldCreateNewConversation = false;

  try {
    const { message, conversationId, isNewChat } = req.body;
    const userId = req.user?.id || null; 

    if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    console.log('💬 [AI CONTROLLER] User Chat Request:', { userId, conversationId, isNewChat });

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong" });
    }

    const cleanMessage = message.trim();

    // 2. Load History
    let conversationHistory = [];
    if (conversationId && !isNewChat) {
      try {
        const existingMessages = await prisma.message.findMany({
          where: { conversationId: parseInt(conversationId), conversation: { userId: userId } },
          select: { role: true, content: true },
          orderBy: { createdAt: 'asc' },
          take: 8 
        });
        conversationHistory = existingMessages.map(msg => ({
          role: msg.role === 'bot' ? 'assistant' : 'user',
          content: msg.content
        }));
      } catch (error) { console.warn('History load failed:', error.message); }
    }

    // 3. ✅ RAG PROCESS
    console.log('🚀 [AI CONTROLLER] Calling RAG Service...');
    
    let ragResult;     
    let finalAnswer;   
    let realTokenUsage = 0;

    try {
      // Call RAG
      ragResult = await ragService.answerQuestion(cleanMessage, conversationHistory);
      finalAnswer = ragResult.answer; 
      
      // ✅ Ambil Token Asli OpenAI
      realTokenUsage = ragResult.usage ? ragResult.usage.total_tokens : 0;

      // Fallback estimasi jika usage kosong
      if (!realTokenUsage) {
         const inputChars = cleanMessage.length + JSON.stringify(conversationHistory).length;
         const outputChars = finalAnswer ? finalAnswer.length : 0;
         realTokenUsage = Math.ceil((inputChars + outputChars) / 4) + 1400; 
      }

      console.log('✅ [AI CONTROLLER] RAG Success. Tokens:', realTokenUsage);

    } catch (ragError) {
      console.error('❌ [AI CONTROLLER] RAG Failed:', ragError.message);
      
      // FALLBACK
      console.log('🔄 Using OpenAI fallback...');
      try {
        const fallbackRes = await generateAIResponse(cleanMessage, conversationHistory, 'general');
        
        // Handle jika fallback return object/string
        finalAnswer = typeof fallbackRes === 'object' ? fallbackRes.content : fallbackRes;
        const usageData = typeof fallbackRes === 'object' ? fallbackRes.usage : null;
        
        realTokenUsage = usageData ? usageData.total_tokens : Math.ceil((cleanMessage.length + finalAnswer.length)/4);

      } catch (fallbackError) {
        throw new Error('All AI services unavailable');
      }
    }

    // =================================================================
    // 4. ✅ TOKEN TRACKING & DEDUCTION
    // =================================================================
    if (realTokenUsage > 0) {
        const trackerIdentifier = userId; // Pakai User ID untuk user login
        // Gunakan IP sebagai secondary key atau log info saja jika mau
        await rateLimitService.trackTokenUsage(trackerIdentifier, req.ip, realTokenUsage);
        console.log(`📉 [AI LIMIT] Deducted ${realTokenUsage} tokens for User ${userId}`);
    }
    // =================================================================

    // 5. DB SAVE
    currentConversationId = conversationId ? parseInt(conversationId) : null;
    shouldCreateNewConversation = isNewChat || !conversationId;

    try {
        const conversationTitle = cleanMessage.substring(0, 50) + (cleanMessage.length > 50 ? '...' : '');

        if (shouldCreateNewConversation) {
          const newConversation = await prisma.conversation.create({
            data: {
              userId: userId,
              title: conversationTitle,
              messages: {
                create: [
                  { role: 'user', content: cleanMessage },
                  { role: 'bot', content: finalAnswer }
                ]
              }
            }
          });
          currentConversationId = newConversation.id;
        } else {
          const existingConv = await prisma.conversation.findFirst({
            where: { id: currentConversationId, userId: userId }
          });

          if (existingConv) {
            await prisma.message.createMany({
              data: [
                { conversationId: currentConversationId, role: 'user', content: cleanMessage },
                { conversationId: currentConversationId, role: 'bot', content: finalAnswer }
              ]
            });
            
            // Update timestamp
            await prisma.conversation.update({
                where: { id: currentConversationId },
                data: { updatedAt: new Date() }
            });
          }
        }
    } catch (dbError) {
        console.error('❌ DB Save Error:', dbError.message);
    }

    // 6. RESPONSE
    res.json({
      success: true,
      reply: finalAnswer, 
      conversationId: currentConversationId,
      timestamp: new Date().toISOString(),
      isNewConversation: shouldCreateNewConversation,
      // ✅ Usage Data
      usage: {
        tokensUsed: realTokenUsage,
        policy: 'user' 
      }
    });

  } catch (error) {
    console.error('❌ [AI CONTROLLER] Chat Error:', error);
    const errorMessage = error.message.includes('unavailable') 
      ? "Layanan sedang sibuk." : "Terjadi kesalahan sistem.";
      
    res.status(500).json({ success: false, message: errorMessage });
  }
};

// ... (Sisa fungsi helper export biarkan tetap sama) ...
// Copy paste fungsi triggerIngestion, getConversations, dll dari file lama Anda ke sini
// Agar tidak terlalu panjang di chat, saya asumsikan Anda bisa copy paste sisanya.

const triggerIngestion = async (req, res) => { /* ... */ };
const getConversations = async (req, res) => { /* ... */ };
const getChatHistory = async (req, res) => { /* ... */ };
const deleteConversation = async (req, res) => { /* ... */ };
const analyzeAcademicPerformance = async (req, res) => { /* ... */ };
const getStudyRecommendations = async (req, res) => { /* ... */ };
const testAI = async (req, res) => { /* ... */ };
const testOpenAIConnectionHandler = async (req, res) => { /* ... */ };

module.exports = {
  sendChat,
  triggerIngestion,
  getConversations,
  getChatHistory,
  deleteConversation,
  analyzeAcademicPerformance,
  getStudyRecommendations,
  testAI,
  testOpenAIConnection: testOpenAIConnectionHandler
};