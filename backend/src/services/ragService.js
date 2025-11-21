const { QdrantClient } = require('@qdrant/js-client-rest');
const openaiService = require('./openaiService');
const fs = require('fs');
const path = require('path');
const expansionConfig = require('../config/queryExpansionConfig');

/**
 * KONFIGURASI RAG SERVICE - OPTIMIZED FOR SHORT ANSWERS
 */
const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || 6333;
const COLLECTION_NAME = 'sapa_tazkia_knowledge';
const VECTOR_SIZE = 1536;

// ✅ OPTIMASI THRESHOLD UNTUK JAWABAN SINGKAT
const SIMILARITY_THRESHOLD = 0.45;
const FALLBACK_THRESHOLD = 0.30;
const TOP_K_DOCS = 10;

const client = new QdrantClient({ host: QDRANT_HOST, port: QDRANT_PORT });

class RagService {
  
  constructor() {
    // ✅ PERBAIKAN: Conversation Memory untuk Context Awareness
    this.conversationMemory = new Map();
    
    // ✅ PERBAIKAN: Dynamic Keyword Learning untuk Scalability
    this.learnedKeywords = new Set([
      'halo', 'hai', 'hi', 'hello', 'assalamualaikum', 'salam', 
      'pagi', 'siang', 'sore', 'malam', 'selamat', 'hey', 'hei',
      'test', 'tes', 'coba', 'p', 'cek', 'woy', 'hola', 'bro',
      'sis', 'bang', 'mas', 'mbak', 'dek'
    ]);
    
    this.ensureCollection();
  }

  // =============================================================================
  // ✅ PERBAIKAN 1 & 4: HYBRID GREETING DETECTION SYSTEM
  // =============================================================================

  /**
   * ✅ PERBAIKAN: Hybrid Detection - AI + Rules (Mengatasi Rule-based Rigid & Tidak Scalable)
   */
  async detectGreetingType(userMessage, conversationHistory = [], userId = 'default') {
    const cleanMessage = userMessage.toLowerCase().trim();
    
    // 1. Fast Rule-based Pre-check (untuk performance)
    const ruleBasedResult = this.ruleBasedGreetingCheck(cleanMessage);
    if (ruleBasedResult.confidence > 0.9) {
      return ruleBasedResult;
    }
    
    // 2. AI-Powered Analysis (untuk accuracy dan scalability)
    const aiResult = await this.aiGreetingAnalysis(userMessage, conversationHistory, userId);
    
    // 3. Hybrid Decision Making
    return this.hybridDecision(ruleBasedResult, aiResult);
  }

  /**
   * ✅ PERBAIKAN: Enhanced Rule-based Check dengan False Positive Reduction
   */
  ruleBasedGreetingCheck(message) {
    const words = message.split(/\s+/).filter(word => word.length > 1);
    
    // Pure greeting detection
    const pureGreetingWords = words.filter(word => this.learnedKeywords.has(word));
    const greetingRatio = pureGreetingWords.length / words.length;
    
    // Content detection dengan false positive reduction
    const hasContent = words.some(word => 
      !this.learnedKeywords.has(word) && 
      word.length > 2 &&
      !this.isFillerWord(word) &&
      this.hasSubstantiveContent(word, message)
    );
    
    let type, confidence;
    
    // ✅ PERBAIKAN: Enhanced logic untuk mengurangi false positive
    if (words.length <= 2 && pureGreetingWords.length === words.length) {
      type = 'PURE_GREETING';
      confidence = 0.95;
    } else if (greetingRatio > 0.7 && !hasContent) {
      type = 'PURE_GREETING';
      confidence = 0.85;
    } else if (greetingRatio > 0.3 && hasContent) {
      type = 'GREETING_WITH_QUESTION';
      confidence = 0.75;
    } else if (greetingRatio > 0.1) {
      type = 'REGULAR_WITH_GREETING';
      confidence = 0.6;
    } else {
      type = 'REGULAR_QUESTION';
      confidence = 0.9;
    }
    
    return { type, confidence, method: 'rule_based' };
  }

  /**
   * ✅ PERBAIKAN: AI-Powered Analysis untuk cases yang complex
   */
  async aiGreetingAnalysis(userMessage, conversationHistory, userId) {
    try {
      const context = this.getConversationContext(userId);
      
      const prompt = `
      ANALISIS INTENT PESAN:
      
      Pesan: "${userMessage}"
      Context sebelumnya: ${context.lastTopics.join(', ') || 'tidak ada'}
      Panjang percakapan: ${context.messageCount} pesan
      
      Tentukan jenis intent:
      1. PURE_GREETING - Hanya sapaan tanpa konten substantive
      2. GREETING_WITH_QUESTION - Sapaan + pertanyaan jelas
      3. REGULAR_WITH_GREETING - Pertanyaan biasa dengan kata sapaan
      4. REGULAR_QUESTION - Pertanyaan biasa tanpa sapaan
      5. FOLLOW_UP - Kelanjutan dari topik sebelumnya
      
      Respond dengan JSON: 
      {
        "type": "PURE_GREETING",
        "confidence": 0.95,
        "reason": "Hanya berisi kata sapaan tanpa pertanyaan",
        "extracted_question": null
      }
      `;
      
      const response = await openaiService.chatCompletion([
        { role: "system", content: "Anda adalah AI classifier untuk intent percakapan. Analisis dengan teliti." },
        { role: "user", content: prompt }
      ], { 
        maxTokens: 150, 
        temperature: 0.1
      });
      
      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { type: 'REGULAR_QUESTION', confidence: 0.7 };
      result.method = 'ai_powered';
      
      // ✅ PERBAIKAN: Learning - Update keywords dari AI analysis
      this.updateLearnedKeywords(userMessage, result.type);
      
      return result;
      
    } catch (error) {
      console.log('❌ AI analysis failed, using rule-based fallback:', error.message);
      return this.ruleBasedGreetingCheck(userMessage);
    }
  }

  /**
   * ✅ PERBAIKAN: Hybrid Decision Maker
   */
  hybridDecision(ruleResult, aiResult) {
    // Jika AI confidence tinggi, prioritaskan AI
    if (aiResult.confidence > 0.8 && aiResult.method === 'ai_powered') {
      return aiResult;
    }
    
    // Jika rule-based sangat confident, gunakan rules
    if (ruleResult.confidence > 0.9) {
      return ruleResult;
    }
    
    // Weighted average untuk cases di tengah
    const ruleWeight = 0.4;
    const aiWeight = 0.6;
    
    const finalConfidence = (ruleResult.confidence * ruleWeight) + (aiResult.confidence * aiWeight);
    
    // Pilih type berdasarkan confidence tertinggi
    let finalType = ruleResult.confidence > aiResult.confidence ? ruleResult.type : aiResult.type;
    
    return {
      type: finalType,
      confidence: finalConfidence,
      method: 'hybrid',
      components: { rule_based: ruleResult, ai_powered: aiResult }
    };
  }

  // =============================================================================
  // ✅ PERBAIKAN 2: CONTEXT AWARENESS SYSTEM
  // =============================================================================

  /**
   * ✅ PERBAIKAN: Conversation Memory Management
   */
  updateConversationMemory(userId, userMessage, response, intent) {
    if (!this.conversationMemory.has(userId)) {
      this.conversationMemory.set(userId, {
        messages: [],
        topics: [],
        lastInteraction: Date.now(),
        questionCount: 0,
        userType: 'general'
      });
    }
    
    const userMemory = this.conversationMemory.get(userId);
    
    // Add new message
    userMemory.messages.push({
      content: userMessage,
      intent: intent,
      timestamp: Date.now(),
      response: response
    });
    
    // Keep only last 20 messages
    if (userMemory.messages.length > 20) {
      userMemory.messages = userMemory.messages.slice(-20);
    }
    
    // Extract and update topics
    const newTopics = this.extractTopics(userMessage);
    userMemory.topics = [...new Set([...userMemory.topics, ...newTopics])].slice(-10);
    
    // Update counters
    if (intent.type !== 'PURE_GREETING') {
      userMemory.questionCount++;
    }
    
    userMemory.lastInteraction = Date.now();
    
    // Update user type based on engagement
    userMemory.userType = this.determineUserType(userMemory);
  }

  /**
   * ✅ PERBAIKAN: Get Conversation Context
   */
  getConversationContext(userId) {
    const defaultContext = {
      lastTopics: [],
      messageCount: 0,
      lastInteraction: null,
      questionCount: 0,
      userType: 'general'
    };
    
    if (!this.conversationMemory.has(userId)) {
      return defaultContext;
    }
    
    const memory = this.conversationMemory.get(userId);
    const recentMessages = memory.messages.slice(-5);
    
    return {
      lastTopics: memory.topics.slice(-3),
      messageCount: memory.messages.length,
      lastInteraction: memory.lastInteraction,
      questionCount: memory.questionCount,
      userType: memory.userType,
      recentMessages: recentMessages.map(m => ({
        content: m.content.substring(0, 50) + '...',
        intent: m.intent?.type
      }))
    };
  }

  /**
   * ✅ PERBAIKAN: Smart Topic Extraction
   */
  extractTopics(message) {
    const topics = [];
    const lowerMessage = message.toLowerCase();
    
    // Topic keywords
    const topicKeywords = {
      'prodi': ['prodi', 'program studi', 'jurusan', 'fakultas'],
      'lokasi': ['lokasi', 'alamat', 'dimana', 'alamat kampus'],
      'beasiswa': ['beasiswa', 'biaya', 'uang kuliah', 'biaya kuliah'],
      'pendaftaran': ['daftar', 'pendaftaran', 'syarat', 'registrasi'],
      'murabahah': ['murabahah', 'syariah', 'riba', 'ekonomi islam'],
      'kontak': ['kontak', 'telepon', 'hp', 'whatsapp', 'hubungi']
    };
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        topics.push(topic);
      }
    });
    
    return topics;
  }

  /**
   * ✅ PERBAIKAN: Determine User Type dengan Context
   */
  determineUserType(userMemory) {
    if (userMemory.messages.length < 2) return 'general';
    
    const recentMessages = userMemory.messages.slice(-3);
    const engagementSignals = recentMessages.filter(msg => 
      this.isEngagedUserMessage(msg.content) || 
      msg.intent?.type === 'FOLLOW_UP'
    );
    
    if (engagementSignals.length >= 2 || userMemory.questionCount >= 3) {
      return 'engaged';
    }
    
    return 'general';
  }

  // =============================================================================
  // ✅ PERBAIKAN 3: FALSE POSITIVE REDUCTION
  // =============================================================================

  /**
   * ✅ PERBAIKAN: Enhanced Greeting Detection dengan False Positive Reduction
   */
  async enhancedGreetingDetection(userMessage, userId = 'default') {
    const context = this.getConversationContext(userId);
    
    // Check jika ini follow-up dari greeting sebelumnya
    if (this.isFollowUpGreeting(userMessage, context)) {
      return {
        type: 'FOLLOW_UP',
        confidence: 0.8,
        method: 'context_aware'
      };
    }
    
    // Hybrid detection
    const intent = await this.detectGreetingType(userMessage, [], userId);
    
    // False positive reduction rules
    return this.applyFalsePositiveRules(intent, userMessage, context);
  }

  /**
   * ✅ PERBAIKAN: Apply False Positive Reduction Rules
   */
  applyFalsePositiveRules(intent, message, context) {
    let adjustedIntent = { ...intent };
    
    // Rule 1: Jika ada question words, likely bukan pure greeting
    const questionWords = ['apa', 'bagaimana', 'dimana', 'kapan', 'berapa', 'siapa', 'bisa', 'mau', 'ingin'];
    const hasQuestionWord = questionWords.some(word => message.toLowerCase().includes(word));
    
    if (intent.type === 'PURE_GREETING' && hasQuestionWord) {
      adjustedIntent.type = 'GREETING_WITH_QUESTION';
      adjustedIntent.confidence *= 0.7;
      adjustedIntent.falsePositiveFix = 'question_word_detected';
    }
    
    // Rule 2: Jika dalam context panjang, likely follow-up
    if (context.messageCount > 2 && intent.type === 'PURE_GREETING') {
      adjustedIntent.type = 'FOLLOW_UP_GREETING';
      adjustedIntent.confidence = 0.7;
      adjustedIntent.falsePositiveFix = 'conversation_context';
    }
    
    // Rule 3: Check untuk common false positive patterns
    const falsePositivePatterns = [
      { pattern: /halo mau tanya/i, correctType: 'GREETING_WITH_QUESTION' },
      { pattern: /hai (bang|mas|mbak|sis) mau nanya/i, correctType: 'GREETING_WITH_QUESTION' },
      { pattern: /assalamualaikum (bang|mas|mbak|sis)/i, correctType: 'GREETING_WITH_QUESTION' },
      { pattern: /test test/i, correctType: 'PURE_GREETING' },
      { pattern: /cek cek/i, correctType: 'PURE_GREETING' }
    ];
    
    falsePositivePatterns.forEach(fp => {
      if (fp.pattern.test(message) && intent.type !== fp.correctType) {
        adjustedIntent.type = fp.correctType;
        adjustedIntent.confidence = 0.9;
        adjustedIntent.falsePositiveFix = 'pattern_matching';
      }
    });
    
    return adjustedIntent;
  }

  /**
   * ✅ PERBAIKAN: Check Follow-up Greeting
   */
  isFollowUpGreeting(message, context) {
    if (context.messageCount === 0) return false;
    
    const timeSinceLast = Date.now() - context.lastInteraction;
    const isQuickReply = timeSinceLast < 300000; // 5 minutes
    
    const lastMessage = context.recentMessages[context.recentMessages.length - 1];
    const lastWasGreeting = lastMessage?.intent === 'PURE_GREETING';
    
    return isQuickReply && lastWasGreeting && this.isSimpleGreeting(message);
  }

  // =============================================================================
  // ✅ ENHANCED ANSWER QUESTION METHOD (MAIN METHOD)
  // =============================================================================

  /**
   * ✅ PERBAIKAN UTAMA: Enhanced Answer Question dengan semua improvements
   */
  async answerQuestion(userMessage, conversationHistory = [], options = {}, userId = 'default') {
    const startTime = performance.now();
    
    try {
      console.log(`\n💬 [RAG-ENHANCED] Processing: "${userMessage}"`);
      
      // 1. Enhanced Greeting Detection dengan context awareness
      const intent = await this.enhancedGreetingDetection(userMessage, userId);
      console.log(`🎯 [RAG] Intent: ${intent.type} (${intent.confidence.toFixed(2)}) [${intent.method}]`);
      
      // 2. Update conversation memory untuk context awareness
      this.updateConversationMemory(userId, userMessage, null, intent);
      
      // 3. Handle berdasarkan intent type
      switch (intent.type) {
        case 'PURE_GREETING':
          return await this.handlePureGreeting(userMessage, userId, startTime);
          
        case 'GREETING_WITH_QUESTION':
          return await this.handleGreetingWithQuestion(userMessage, userId, startTime);
          
        case 'FOLLOW_UP':
        case 'FOLLOW_UP_GREETING':
          return await this.handleFollowUpQuestion(userMessage, conversationHistory, userId, startTime);
          
        default:
          return await this.handleRegularQuestion(userMessage, conversationHistory, userId, startTime, intent);
      }
      
    } catch (error) {
      console.error('❌ [RAG-ENHANCED] Error:', error);
      return this.getErrorResponse();
    }
  }

  /**
   * ✅ Handle Pure Greeting dengan Context Awareness
   */
  async handlePureGreeting(userMessage, userId, startTime) {
    const context = this.getConversationContext(userId);
    const userType = context.userType;
    
    console.log('👋 [RAG] Pure greeting - using context-aware response');
    
    const response = this.getContextAwareGreeting(userMessage, userType, context);
    
    // Update memory dengan response
    this.updateConversationMemory(userId, userMessage, response, { type: 'PURE_GREETING' });
    
    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`🚀 [RAG] Pure greeting response completed in ${duration}s`);
    
    return response;
  }

  /**
   * ✅ Handle Greeting with Question
   */
  async handleGreetingWithQuestion(userMessage, userId, startTime) {
    console.log('🔍 [RAG] Greeting with question - extracting question...');
    
    // Extract pertanyaan dari greeting
    const extractedQuestion = await this.extractQuestionFromGreeting(userMessage);
    console.log(`📝 [RAG] Extracted question: "${extractedQuestion}"`);
    
    // Process seperti regular question tapi dengan gaya yang lebih friendly
    const context = this.getConversationContext(userId);
    const relevantDocs = await this.searchRelevantDocs(extractedQuestion);
    const contextString = this.compileContext(relevantDocs);
    
    const aiReply = await openaiService.generateAIResponse(
      extractedQuestion, 
      [], 
      contextString, 
      {
        maxTokens: 400,  
        temperature: 0.1, 
        isShortAnswer: true,
        languageStyle: 'casual',
        hasGreeting: true
      }
    );
    
    this.updateConversationMemory(userId, userMessage, aiReply, { type: 'GREETING_WITH_QUESTION' });
    
    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`🚀 [RAG] Greeting with question completed in ${duration}s`);
    
    return aiReply;
  }

  /**
   * ✅ Handle Follow-up Question
   */
  async handleFollowUpQuestion(userMessage, conversationHistory, userId, startTime) {
    console.log('🔄 [RAG] Follow-up question - using conversation context');
    
    const context = this.getConversationContext(userId);
    const relevantDocs = await this.searchRelevantDocs(userMessage);
    const contextString = this.compileContext(relevantDocs);
    
    const aiReply = await openaiService.generateAIResponse(
      userMessage, 
      conversationHistory, 
      contextString, 
      {
        maxTokens: 400,  
        temperature: 0.1, 
        isShortAnswer: true,
        languageStyle: context.userType === 'engaged' ? 'casual' : 'formal',
        isFollowUp: true
      }
    );
    
    this.updateConversationMemory(userId, userMessage, aiReply, { type: 'FOLLOW_UP' });
    
    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`🚀 [RAG] Follow-up question completed in ${duration}s`);
    
    return aiReply;
  }

  /**
   * ✅ Handle Regular Question
   */
  async handleRegularQuestion(userMessage, conversationHistory, userId, startTime, intent) {
    console.log('🤔 [RAG] Regular question - normal RAG process');
    
    const context = this.getConversationContext(userId);
    const relevantDocs = await this.searchRelevantDocs(userMessage);
    const contextString = this.compileContext(relevantDocs);
    
    const questionType = this.detectQuestionType(userMessage, relevantDocs);
    const userType = context.userType;
    
    console.log(`👤 [RAG] User type: ${userType}, Question type: ${questionType}`);
    
    let aiReply;
    
    if (contextString) {
      console.log('🤖 [RAG] Menggenerate response dengan konteks...');
      
      aiReply = await openaiService.generateAIResponse(
        userMessage, 
        conversationHistory, 
        contextString, 
        {
          maxTokens: 400,  
          temperature: 0.1, 
          isShortAnswer: true,
          languageStyle: userType === 'engaged' ? 'casual' : 'formal'
        }
      );
    } else {
      console.log('[RAG] Fallback: Tidak ada konteks relevan');
      
      aiReply = await openaiService.generateAIResponse(
        userMessage, 
        conversationHistory, 
        null,
        {
          maxTokens: 250,
          isShortAnswer: true,
          languageStyle: userType === 'engaged' ? 'casual' : 'formal'
        }
      );
    }
    
    this.updateConversationMemory(userId, userMessage, aiReply, intent);
    
    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    
    console.log(`🚀 [RAG] Regular question completed in ${duration}s`, {
      hasContext: !!contextString,
      docsFound: relevantDocs.length,
      userType: userType,
      questionType: questionType,
      replyLength: aiReply.length
    });

    return aiReply;
  }

  // =============================================================================
  // ✅ CONTEXT-AWARE GREETING RESPONSE SYSTEM
  // =============================================================================

  /**
   * ✅ Context-Aware Greeting Response
   */
  getContextAwareGreeting(message, userType, context) {
    const timeBased = this.getTimeBasedGreeting();
    
    if (context.messageCount === 0) {
      // First interaction
      const greetings = {
        general: [
          `${timeBased} 😊 Saya Kia, asisten virtual Tazkia. Ada yang bisa saya bantu?`,
          `${timeBased} 👋 Salam kenal! Saya Kia. Mau tanya tentang kampus Tazkia?`
        ],
        engaged: [
          `${timeBased} 🎉 Senang bertemu Anda! Saya Kia. Ada yang bisa dibantu?`,
          `${timeBased} 😄 Halo! Kia di sini. Mau explore info Tazkia hari ini?`
        ]
      };
      return this.getRandomResponse(greetings[userType]);
    }
    
    // Returning user
    const lastTopic = context.lastTopics[0];
    const timeSinceLast = Date.now() - context.lastInteraction;
    const isLongTime = timeSinceLast > 3600000; // 1 hour
    
    if (isLongTime) {
      const welcomeBack = {
        general: [
          `${timeBased} 👋 Lama tidak berjumpa! Ada yang bisa Kia bantu?`,
          `${timeBased} 😊 Halo lagi! Sudah lama ya. Mau tanya apa nih?`
        ],
        engaged: [
          `${timeBased} 🎉 Senang Anda kembali! Ada pertanyaan lagi?`,
          `${timeBased} 😄 Halo lagi! Kia kangen nih. Mau lanjut bahas ${lastTopic || 'Tazkia'}?`
        ]
      };
      return this.getRandomResponse(welcomeBack[userType]);
    } else {
      const quickReturn = {
        general: [
          `${timeBased} 👋 Ada yang bisa Kia bantu?`,
          `${timeBased} 😊 Mau tanya apa nih?`
        ],
        engaged: [
          `${timeBased} 🎉 Yes, balik lagi! Ada pertanyaan lain?`,
          `${timeBased} 😄 Halo lagi! Mau lanjut bahas ${lastTopic || 'Tazkia'}?`
        ]
      };
      return this.getRandomResponse(quickReturn[userType]);
    }
  }

  /**
   * ✅ Extract Question dari Greeting Message
   */
  async extractQuestionFromGreeting(message) {
    try {
      const prompt = `
      Extract the main question from this greeting message. Remove greeting words and return only the question part.
      
      Examples:
      - "Halo, mau tanya tentang prodi apa saja yang ada" → "prodi apa saja yang ada"
      - "Selamat pagi, saya ingin tahu lokasi kampus" → "lokasi kampus"
      - "Hi, cara daftar beasiswa bagaimana?" → "cara daftar beasiswa"
      
      Message: "${message}"
      
      Return only the extracted question without additional text.
      `;
      
      const response = await openaiService.chatCompletion([
        { role: "system", content: "You are a question extraction assistant." },
        { role: "user", content: prompt }
      ], { maxTokens: 100, temperature: 0.1 });
      
      return response.trim();
    } catch (error) {
      // Fallback: remove common greeting words
      return message.replace(/(halo|hai|hi|hello|assalamualaikum|salam|selamat\s+(pagi|siang|sore|malam))/gi, '').trim();
    }
  }

  // =============================================================================
  // ✅ HELPER METHODS
  // =============================================================================

  isFillerWord(word) {
    const fillers = ['dong', 'ya', 'deh', 'sih', 'lah', 'nih', 'tu'];
    return fillers.includes(word);
  }

  hasSubstantiveContent(word, fullMessage) {
    const substantiveIndicators = ['tanya', 'bertanya', 'mau', 'ingin', 'bisa', 'tolong', 'info'];
    return substantiveIndicators.some(indicator => 
      fullMessage.includes(indicator) && word.length > 3
    );
  }

  isEngagedUserMessage(message) {
    const engagedWords = ['makasih', 'terima kasih', 'thanks', 'keren', 'bagus', 'mantap', 'oke', 'sip'];
    return engagedWords.some(word => message.toLowerCase().includes(word));
  }

  isSimpleGreeting(message) {
    const simpleGreetings = ['halo', 'hai', 'hi', 'hello', 'p', 'test', 'tes'];
    return simpleGreetings.some(greet => message.toLowerCase().trim() === greet);
  }

  getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 19) return 'Selamat sore';
    return 'Selamat malam';
  }

  getRandomResponse(responses) {
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * ✅ PERBAIKAN: Dynamic Keyword Learning untuk Scalability
   */
  updateLearnedKeywords(message, intentType) {
    if (intentType === 'PURE_GREETING') {
      const words = message.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 1 && !this.learnedKeywords.has(word)) {
          this.learnedKeywords.add(word);
          console.log(`📚 [RAG] Learned new greeting keyword: "${word}"`);
        }
      });
    }
  }

  getErrorResponse() {
    const fallbacks = [
      "Afwan, sistem sedang mengalami gangguan teknis. Mohon hubungi Admin Kampus di 0821-84-800-600 untuk bantuan lebih lanjut.",
      "Alhamdulillah, saya ingin membantu namun sedang ada kendala teknis. Silakan hubungi Admin Kampus di 0821-84-800-600 ya!",
    ];
    return this.getRandomResponse(fallbacks);
  }

  // =============================================================================
  // ✅ EXISTING METHODS (Tetap dipertahankan)
  // =============================================================================

  /**
   * Universal query expansion menggunakan config external - OPTIMIZED
   */
  expandQueryWithTypos(query) {
    const normalized = query.toLowerCase().trim();
    
    const synonymMap = expansionConfig.synonymMap;
    const commonTypos = expansionConfig.commonTypos;
    const contextualExpansions = expansionConfig.contextualExpansions;
    const contextualKeywords = expansionConfig.contextualKeywords;

    const expandedQueries = new Set();
    
    // 1. Original query
    expandedQueries.add(normalized);
    
    // 2. ✅ OPTIMASI BARU: Ekspansi khusus untuk query bahasa Indonesia
    this.addIndonesianSpecificExpansions(normalized, expandedQueries);
    
    // 3. Add synonyms based on similarity
    Object.keys(synonymMap).forEach(key => {
      if (this.isSimilar(normalized, key, 0.4) || normalized.includes(key)) {
        synonymMap[key].forEach(synonym => {
          expandedQueries.add(synonym);
          // Replace key dengan synonym dalam query
          const replacedQuery = normalized.replace(new RegExp(key, 'gi'), synonym);
          expandedQueries.add(replacedQuery);
        });
      }
    });

    // 4. Add typo corrections
    Object.keys(commonTypos).forEach(correct => {
      commonTypos[correct].forEach(typo => {
        if (normalized.includes(typo)) {
          const correctedQuery = normalized.replace(new RegExp(typo, 'gi'), correct);
          expandedQueries.add(correctedQuery);
          expandedQueries.add(correct);
        }
      });
    });

    // 5. Add context-based expansions menggunakan config
    this.addContextualExpansions(normalized, expandedQueries, contextualExpansions, contextualKeywords);

    // 6. ✅ OPTIMASI: Tambah query sederhana untuk fallback
    const words = normalized.split(' ').filter(word => word.length > 3);
    words.forEach(word => {
      expandedQueries.add(word);
    });

    // 7. Limit to reasonable number
    const finalQueries = Array.from(expandedQueries).slice(0, 15);
    
    console.log(`🔍 [RAG] Expanded queries (${finalQueries.length}):`, finalQueries.slice(0, 8));
    
    return finalQueries;
  }

  /**
   * ✅ OPTIMASI BARU: Ekspansi khusus untuk query bahasa Indonesia
   */
  addIndonesianSpecificExpansions(query, expandedQueries) {
    // Untuk query tanya "ada dimana?" -> ekspansi lokasi
    if (query.includes('dimana') || query.includes('lokasi') || query.includes('alamat')) {
      expandedQueries.add('lokasi universitas tazkia');
      expandedQueries.add('alamat kampus tazkia');
      expandedQueries.add('jl ir h djuanda sentul city bogor');
      expandedQueries.add('sentul city bogor');
      expandedQueries.add('lokasi kampus tazkia');
    }
    
    // Untuk query tentang program studi
    if (query.includes('prodi') || query.includes('program studi') || query.includes('jurusan')) {
      expandedQueries.add('program studi tazkia');
      expandedQueries.add('jurusan universitas tazkia');
      expandedQueries.add('fakultas tazkia');
      expandedQueries.add('daftar prodi tazkia');
    }
    
    // Untuk query tentang fakultas
    if (query.includes('feb') || query.includes('febs') || query.includes('fakultas ekonomi')) {
      expandedQueries.add('fakultas ekonomi bisnis syariah');
      expandedQueries.add('febs tazkia');
      expandedQueries.add('program studi febs');
    }
    
    // Untuk query tentang humaniora
    if (query.includes('humaniora') || query.includes('pendidikan') || query.includes('hukum')) {
      expandedQueries.add('fakultas humaniora tazkia');
      expandedQueries.add('fakultas pendidikan hukum komunikasi');
    }
    
    // Untuk query tentang kontak
    if (query.includes('kontak') || query.includes('telepon') || query.includes('hubungi')) {
      expandedQueries.add('kontak universitas tazkia');
      expandedQueries.add('telepon kampus tazkia');
      expandedQueries.add('082184800600');
      expandedQueries.add('08995499900');
    }

    // ✅ OPTIMASI BARU: Ekspansi untuk ekonomi syariah & murabahah
    if (query.includes('murabahah') || query.includes('riba') || query.includes('syariah')) {
      expandedQueries.add('murabahah dalam ekonomi syariah');
      expandedQueries.add('fatwa dsn mui murabahah');
      expandedQueries.add('transaksi syariah murabahah');
      expandedQueries.add('prinsip murabahah islamic finance');
    }
  }

  /**
   * Tambah ekspansi berdasarkan konteks query - MENGGUNAKAN CONFIG 100%
   */
  addContextualExpansions(query, expandedQueries, contextualExpansions, contextualKeywords) {
    const lowerQuery = query.toLowerCase();
    
    // 1. Loop melalui contextual expansions dari config
    Object.keys(contextualExpansions).forEach(contextKey => {
      if (lowerQuery.includes(contextKey)) {
        contextualExpansions[contextKey].forEach(expansion => {
          expandedQueries.add(expansion);
        });
      }
    });

    // 2. Loop melalui contextual keywords untuk deteksi konteks lebih luas
    Object.keys(contextualKeywords).forEach(contextKey => {
      contextualKeywords[contextKey].forEach(keyword => {
        if (lowerQuery.includes(keyword)) {
          // Tambah context key dan expansions terkait
          expandedQueries.add(contextKey);
          if (contextualExpansions[contextKey]) {
            contextualExpansions[contextKey].forEach(expansion => {
              expandedQueries.add(expansion);
            });
          }
        }
      });
    });
  }

  /**
   * Fuzzy string similarity check
   */
  isSimilar(str1, str2, threshold = 0.6) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    const similarity = (longer.length - distance) / longer.length;
    
    return similarity >= threshold;
  }

  /**
   * Calculate Levenshtein distance for typo detection
   */
  levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = b[i - 1] === a[j - 1] 
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1, 
              matrix[i][j - 1] + 1,     
              matrix[i - 1][j] + 1      
            );
      }
    }
    return matrix[b.length][a.length];
  }

  async ensureCollection() {
    try {
      const result = await client.getCollections();
      const exists = result.collections.some(c => c.name === COLLECTION_NAME);
      
      if (!exists) {
        console.log(`⚙️ [RAG] Membuat koleksi Qdrant: ${COLLECTION_NAME}...`);
        await client.createCollection(COLLECTION_NAME, {
          vectors: { size: VECTOR_SIZE, distance: 'Cosine' }
        });
        console.log('✅ [RAG] Koleksi berhasil dibuat.');
      } else {
        console.log(`✅ [RAG] Koleksi ${COLLECTION_NAME} sudah ada.`);
      }
    } catch (error) {
      console.error('❌ [RAG] Qdrant Connection Error:', error.message);
      throw error;
    }
  }

  /**
   * ✅ OPTIMIZED SEARCH dengan Multiple Embeddings
   */
  async searchRelevantDocs(query) {
    try {
      console.log(`🔍 [RAG] Original query: "${query}"`);
      
      // Expand query dengan synonyms dan typo handling
      const expandedQueries = this.expandQueryWithTypos(query);
      
      let bestResults = [];
      let bestQuery = query;
      let bestScore = 0;

      // ✅ OPTIMASI: Buat embedding untuk SETIAP expanded query
      for (const expandedQuery of expandedQueries) {
        try {
          console.log(`   🔍 Mencari dengan: "${expandedQuery}"`);
          
          // Buat embedding untuk query ini
          const queryVector = await openaiService.createEmbedding(expandedQuery);
          
          const searchResult = await client.search(COLLECTION_NAME, {
            vector: queryVector,
            limit: TOP_K_DOCS,
            with_payload: true,
            score_threshold: SIMILARITY_THRESHOLD
          });

          console.log(`   📊 Hasil: ${searchResult.length} dokumen`);

          // Pilih results dengan score tertinggi
          if (searchResult.length > 0) {
            const currentBestScore = Math.max(...searchResult.map(r => r.score));
            if (searchResult.length > bestResults.length || currentBestScore > bestScore) {
              bestResults = searchResult;
              bestQuery = expandedQuery;
              bestScore = currentBestScore;
            }
          }
          
          // Jika sudah dapat cukup results, stop
          if (bestResults.length >= 3) break;
          
        } catch (error) {
          console.log(`   ❌ Gagal search: "${expandedQuery}"`, error.message);
          continue;
        }
      }

      console.log(`🎯 [RAG] Best results: ${bestResults.length} dokumen (query: "${bestQuery}")`);
      
      // ✅ OPTIMASI: Fallback dengan threshold lebih rendah
      if (bestResults.length === 0) {
        console.log(`🔎 [RAG] Fallback: Mencari dengan threshold lebih rendah (${FALLBACK_THRESHOLD})...`);
        
        for (const expandedQuery of expandedQueries.slice(0, 8)) {
          try {
            const queryVector = await openaiService.createEmbedding(expandedQuery);
            const fallbackResults = await client.search(COLLECTION_NAME, {
              vector: queryVector,
              limit: 5,
              with_payload: true,
              score_threshold: FALLBACK_THRESHOLD
            });
            
            if (fallbackResults.length > 0) {
              bestResults = fallbackResults;
              bestQuery = expandedQuery;
              console.log(`   ✅ Fallback berhasil: ${fallbackResults.length} dokumen dengan "${expandedQuery}"`);
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }

      // LOG HASIL DETAIL
      if (bestResults.length > 0) {
        console.log(`📄 [RAG] Dokumen ditemukan:`);
        bestResults.forEach((result, index) => {
          console.log(`   ${index + 1}. Score: ${result.score.toFixed(3)} | Type: ${result.payload.chunk_type} | File: ${result.payload.source_file}`);
          console.log(`      Title: ${result.payload.title}`);
          console.log(`      Preview: ${result.payload.text.substring(0, 80)}...`);
        });
      } else {
        console.log(`❌ [RAG] TIDAK ADA DOKUMEN YANG COCOK untuk semua expanded queries`);
        
        // DEBUG: Cek koleksi
        try {
          const collectionInfo = await this.getCollectionInfo();
          console.log(`🐛 [DEBUG] Koleksi: ${collectionInfo.pointsCount} points, exists: ${collectionInfo.exists}`);
        } catch (error) {
          console.log(`🐛 [DEBUG] Gagal cek koleksi: ${error.message}`);
        }
      }

      return bestResults.map(res => res.payload.text);

    } catch (error) {
      console.error('❌ [RAG] Retrieval Error:', error);
      return [];
    }
  }

  async ingestData() {
    try {
      await this.ensureCollection();
      
      const dataDir = path.join(__dirname, '../../data');
      console.log('📁 [RAG] Data directory path:', dataDir);
      
      if (!fs.existsSync(dataDir)) {
        console.log('❌ [RAG] Data directory tidak ditemukan:', dataDir);
        fs.mkdirSync(dataDir, { recursive: true });
        return { success: false, message: "Folder data dibuat, tapi belum ada file .md." };
      }

      const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.md'));

      if (files.length === 0) {
        console.log('❌ [RAG] Tidak ada file .md di folder data');
        return { success: false, message: "Tidak ada file .md di folder data." };
      }

      console.log(`📚 [RAG] Memproses ${files.length} dokumen:`, files);

      let totalChunks = 0;
      let globalIdCounter = 1;

      for (const file of files) {
        const filePath = path.join(dataDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        console.log(`\n📄 [RAG] Memproses: ${file}`);
        console.log(`   📝 Konten panjang: ${content.length} karakter`);
        
        const chunks = this.simpleChunking(content, file);
        console.log(`   🔪 Dibagi menjadi ${chunks.length} chunks`);

        const points = [];

        for (const [index, chunk] of chunks.entries()) {
          try {
            console.log(`   🧬 Embedding chunk ${index + 1}/${chunks.length}...`);
            const embedding = await openaiService.createEmbedding(chunk.content);
            
            points.push({
              id: globalIdCounter++,
              vector: embedding,
              payload: { 
                text: chunk.content,
                title: chunk.title,
                source_file: file,
                chunk_type: chunk.type,
                type: 'knowledge_base'
              }
            });
          } catch (error) {
            console.error(`   ❌ Gagal embedding chunk ${index + 1}:`, error.message);
          }
        }

        if (points.length > 0) {
          console.log(`   💾 Menyimpan ${points.length} points ke Qdrant...`);
          await client.upsert(COLLECTION_NAME, {
            wait: true,
            points: points
          });
          totalChunks += points.length;
          console.log(`   ✅ ${file} berhasil disimpan (${points.length} chunks)`);
        } else {
          console.log(`   ⚠️ ${file} tidak menghasilkan chunks yang valid`);
        }
      }

      console.log(`\n🎉 [RAG] SUKSES! Total ${totalChunks} chunks dari ${files.length} file.`);
      return { 
        success: true, 
        count: totalChunks, 
        filesProcessed: files 
      };

    } catch (error) {
      console.error('❌ [RAG] Ingestion Failed:', error);
      console.error('Error details:', error.stack);
      return { success: false, error: error.message };
    }
  }

  simpleChunking(content, filename) {
    const chunks = [];
    
    console.log(`   🔍 Menganalisis konten ${filename}...`);
    
    const sections = content.split(/(?=^#+\s+)/m).filter(section => section.trim().length > 0);
    
    console.log(`   📑 Ditemukan ${sections.length} sections utama`);
    
    for (const section of sections) {
      const cleanSection = section.trim();
      if (cleanSection.length < 30) continue;
      
      let title = 'Informasi Umum';
      const titleMatch = cleanSection.match(/^#+\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else {
        title = cleanSection.substring(0, 50).replace(/\n/g, ' ').trim() + '...';
      }
      
      let type = 'general';
      const lowerSection = cleanSection.toLowerCase();
      
      if (lowerSection.includes('alamat') || lowerSection.includes('lokasi') || lowerSection.includes('jl.')) {
        type = 'location';
      } else if (lowerSection.includes('fakultas') || lowerSection.includes('program studi')) {
        type = 'program';
      } else if (lowerSection.includes('kontak') || lowerSection.includes('hotline') || lowerSection.includes('website')) {
        type = 'contact';
      } else if (lowerSection.includes('beasiswa')) {
        type = 'scholarship';
      } else if (lowerSection.includes('fasilitas')) {
        type = 'facilities';
      } else if (lowerSection.includes('murabahah') || lowerSection.includes('syariah') || lowerSection.includes('riba')) {
        type = 'syariah';
      }
      
      chunks.push({
        type: type,
        title: title,
        content: cleanSection
      });
      
      console.log(`   ➕ Chunk: "${title.substring(0, 40)}..." (${type})`);
    }
    
    if (chunks.length === 0) {
      console.log(`   ⚠️ Tidak ada sections, menggunakan paragraph splitting`);
      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);
      
      for (const [index, paragraph] of paragraphs.entries()) {
        chunks.push({
          type: 'paragraph',
          title: `Bagian ${index + 1} - ${filename}`,
          content: paragraph.trim()
        });
      }
    }
    
    console.log(`   📊 Total chunks: ${chunks.length}`);
    return chunks;
  }

  /**
   * ✅ OPTIMASI BARU: Compile Context yang Lebih Efisien untuk Jawaban Singkat
   */
  compileContext(docs) {
    if (!docs || docs.length === 0) {
      console.log('📭 [RAG] Tidak ada dokumen untuk konteks');
      return null;
    }
    
    console.log(`📋 [RAG] Mengkompilasi ${docs.length} dokumen untuk jawaban singkat`);
    
    // ✅ OPTIMASI: Ambil hanya bagian paling relevan dari setiap dokumen
    const optimizedDocs = docs.map(doc => {
      // Ambil hanya 300-500 karakter pertama dari setiap dokumen
      // untuk menghindari konteks yang terlalu panjang
      if (doc.length > 500) {
        return doc.substring(0, 500) + '...';
      }
      return doc;
    });
    
    const context = "INFORMASI RELEVAN DARI DATABASE TAZKIA:\n\n" + 
                  optimizedDocs.join("\n\n--- INFORMASI TERKAIT ---\n\n");
    
    console.log(`📦 [RAG] Konteks dikompilasi: ${context.length} karakter`);
    
    return context;
  }

  /**
   * ✅ OPTIMASI BARU: Deteksi Question Type untuk Penawaran yang Tepat
   */
  detectQuestionType(userMessage, relevantDocs) {
    const message = userMessage.toLowerCase();
    const docsText = relevantDocs.join(' ').toLowerCase();
    
    // Deteksi berdasarkan keyword
    if (message.includes('apa itu') || message.includes('pengertian') || message.includes('definisi')) {
      return 'definition';
    } else if (message.includes('dimana') || message.includes('lokasi') || message.includes('alamat')) {
      return 'location';
    } else if (message.includes('prodi') || message.includes('program studi') || message.includes('jurusan')) {
      return 'program';
    } else if (message.includes('cara') || message.includes('proses') || message.includes('tahapan')) {
      return 'procedure';
    } else if (message.includes('murabahah') || message.includes('riba') || message.includes('syariah')) {
      return 'syariah';
    }
    
    // Deteksi berdasarkan konten dokumen
    if (docsText.includes('fakultas') || docsText.includes('program studi')) {
      return 'program';
    } else if (docsText.includes('jl.') || docsText.includes('sentul') || docsText.includes('bogor')) {
      return 'location';
    } else if (docsText.includes('murabahah') || docsText.includes('fatwa') || docsText.includes('dsn-mui')) {
      return 'syariah';
    }
    
    return 'general';
  }

  /**
   * ✅ METHOD BARU: Answer dengan Custom Options (OPTIMIZED)
   */
  async answerWithOptions(userMessage, conversationHistory = [], customOptions = {}) {
    const defaultOptions = {
      maxTokens: 400,
      temperature: 0.1,
      isShortAnswer: true,
      languageStyle: 'formal'
    };
    
    const options = { ...defaultOptions, ...customOptions };
    
    const relevantDocs = await this.searchRelevantDocs(userMessage);
    const contextString = this.compileContext(relevantDocs);
    
    return await openaiService.generateAIResponse(
      userMessage,
      conversationHistory,
      contextString,
      options
    );
  }

  async getCollectionInfo() {
    try {
      const info = await client.getCollection(COLLECTION_NAME);
      const count = await client.count(COLLECTION_NAME);
      
      return {
        exists: true,
        vectorsCount: info.vectors_count,
        pointsCount: count.count,
        status: info.status
      };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }

  /**
   * ✅ METHOD BARU: Test RAG dengan Short Answers (OPTIMIZED)
   */
  async testShortAnswerPerformance() {
    try {
      console.log('🧪 [RAG] Testing short answer performance...');
      
      const testQuestions = [
        "Apa itu murabahah?",
        "Dimana lokasi kampus Tazkia?",
        "Program studi apa saja yang ada?",
        "Bagaimana cara daftar beasiswa?",
        "Apa syarat pendaftaran mahasiswa baru?"
      ];
      
      const results = [];
      
      for (const question of testQuestions) {
        const startTime = performance.now();
        const answer = await this.answerQuestion(question, [], {
          maxTokens: 400,
          isShortAnswer: true
        });
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);
        
        results.push({
          question: question,
          answer: answer,
          duration: duration,
          length: answer.length,
          wordCount: answer.split(' ').length,
          hasOffer: answer.includes('?') && (answer.includes('ingin') || answer.includes('mau') || answer.includes('apakah')),
          isShort: answer.length <= 600
        });
      }
      
      // ✅ STATISTIK YANG LEBIH DETAIL
      const shortAnswers = results.filter(r => r.isShort);
      const withOffers = results.filter(r => r.hasOffer);
      
      return {
        success: true,
        results: results,
        summary: {
          totalQuestions: results.length,
          shortAnswers: shortAnswers.length,
          withOffers: withOffers.length,
          averageLength: Math.round(results.reduce((acc, r) => acc + r.length, 0) / results.length),
          averageWordCount: Math.round(results.reduce((acc, r) => acc + r.wordCount, 0) / results.length),
          averageDuration: (results.reduce((acc, r) => acc + parseFloat(r.duration), 0) / results.length).toFixed(2)
        }
      };
      
    } catch (error) {
      console.error('❌ [RAG] Performance test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new RagService();