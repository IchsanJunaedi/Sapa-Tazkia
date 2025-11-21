const OpenAI = require('openai');

// --- Load Environment Variables ---
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * System Prompt Dasar - OPTIMIZED FOR TOKENS
 */
const BASE_SYSTEM_INSTRUCTION = `Anda adalah "Kia", asisten virtual Universitas Tazkia.
Karakter: Ramah, Cerdas, Membantu, Islami.

ATURAN:
- Gunakan bahasa Indonesia santun
- Jawab SINGKAT (max 3 kalimat)
- Fokus informasi paling relevan
- Akhiri dengan penawaran bantuan lanjutan`;

/**
 * TEMPLATE PENAWARAN - OPTIMIZED
 */
const OFFER_TEMPLATES = {
  definition: [
    "Apakah ingin mengetahui ketentuan penting {topic} lebih lanjut?",
    "Mau tahu prinsip dasar {topic} dalam syariah?",
    "Ingin penjelasan praktik {topic} di perbankan syariah?"
  ],
  
  location: [
    "Perlu informasi detail fasilitas {topic}?",
    "Mau tahu akses transportasi ke {topic}?",
    "Ingin info jam operasional {topic}?"
  ],
  
  program: [
    "Ingin tahu prospek karir lulusan {topic}?",
    "Mau detail kurikulum {topic}?",
    "Perlu informasi syarat pendaftaran {topic}?"
  ],
  
  procedure: [
    "Perlu langkah-langkah detail {topic}?",
    "Mau tahu dokumen yang diperlukan untuk {topic}?",
    "Ingin informasi timeline {topic}?"
  ],
  
  syariah: [
    "Ingin mengetahui dalil dan fatwa {topic}?",
    "Mau tahu penerapan {topic} dalam ekonomi syariah?",
    "Perlu penjelasan prinsip syariah {topic}?"
  ],
  
  general: [
    "Apakah ingin mengetahui lebih detail tentang {topic}?",
    "Mau saya jelaskan aspek lain {topic}?",
    "Perlu informasi lengkap {topic}?"
  ]
};

/**
 * FALLBACK RESPONSES - OPTIMIZED
 */
const FALLBACK_RESPONSES = {
  formal: [
    "Afwan, informasi belum tersedia. Hubungi Admin Kampus di 0821-84-800-600.",
    "Afwan, informasi sedang tidak tersedia. Silakan hubungi Admin Kampus 0821-84-800-600.",
    "Alhamdulillah, saya ingin membantu namun informasi tidak tersedia. Hubungi Admin 0821-84-800-600."
  ],
  
  casual: [
    "Wah, info ini belum ada di Kia nih 😊 Langsung chat Admin di 0821-84-800-600 ya!",
    "Hmm, Kia belum punya info detail. Coba tanya Admin di 0821-84-800-600! 🚀",
    "Kia perlu update database nih 😅 Yuk konsultasi Admin di 0821-84-800-600!"
  ],
  
  prospective: [
    "Spesial calon mahasiswa! 🎓 Chat Admin Pendaftaran 0821-84-800-600 untuk info lengkap!",
    "Wah, pertanyaan bagus! Yuk hubungi Admin 0821-84-800-600 untuk detailnya! ✨",
    "Hai calon mahasiswa! 🎉 Konsultasi Admin di 0821-84-800-600 untuk info terupdate!"
  ]
};

/**
 * 1. Generate Embedding (Ubah teks jadi vektor)
 */
async function createEmbedding(text) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY missing in environment variables');
    }

    const cleanText = text.replace(/\n/g, " ").trim();
    
    console.log(`🧬 [OPENAI] Creating embedding for text (${cleanText.length} chars)...`);
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
    });

    console.log(`✅ [OPENAI] Embedding created successfully (${response.data[0].embedding.length} dimensions)`);
    return response.data[0].embedding;

  } catch (error) {
    console.error('❌ [OPENAI] Error creating embedding:', error);
    throw new Error(`Gagal membuat embedding: ${error.message}`);
  }
}

/**
 * ✅ OPTIMASI: Enhanced Chat Completion untuk Intent Analysis
 */
async function chatCompletion(messages, options = {}) {
  const defaultOptions = {
    maxTokens: options.maxTokens || 150,
    temperature: options.temperature || 0.1,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    jsonMode: options.jsonMode || false
  };

  try {
    const requestPayload = {
      model: defaultOptions.model,
      messages: messages,
      max_tokens: defaultOptions.maxTokens,
      temperature: defaultOptions.temperature
    };

    if (defaultOptions.jsonMode) {
      requestPayload.response_format = { type: "json_object" };
    }

    const completion = await openai.chat.completions.create(requestPayload);
    
    if (completion.choices && completion.choices[0]) {
      return completion.choices[0].message.content.trim();
    } else {
      throw new Error('Invalid response from OpenAI');
    }
    
  } catch (error) {
    console.error('❌ [OPENAI] Chat Completion Error:', error);
    throw error;
  }
}

/**
 * 2. Generate AI Response - OPTIMIZED FOR TOKENS + CONTEXT AWARENESS
 */
async function generateAIResponse(userMessage, conversationHistory = [], customContext = null, options = {}) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY tidak valid. Silakan cek file .env');
    }

    const {
      maxTokens = 350, // ✅ DIKURANGI LAGI
      temperature = 0.1,
      isShortAnswer = true,
      languageStyle = 'formal',
      hasGreeting = false,
      isFollowUp = false,
      userType = 'general'
    } = options;

    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    console.log(`🤖 [OPENAI] Generating ${isShortAnswer ? 'SHORT' : 'DETAILED'} response (${languageStyle} style)...`);

    // ✅ DETEKSI JENIS USER & CONTEXT AWARENESS
    const detectedUserType = userType || detectUserType(userMessage, conversationHistory);
    const finalLanguageStyle = getOptimalLanguageStyle(languageStyle, detectedUserType, hasGreeting);

    // ✅ BUILD OPTIMIZED SYSTEM PROMPT
    let systemPrompt = buildOptimizedSystemPrompt(
      customContext, 
      userMessage, 
      finalLanguageStyle, 
      detectedUserType,
      hasGreeting,
      isFollowUp,
      conversationHistory
    );

    // Build messages array yang dioptimasi
    const messages = buildOptimizedMessages(
      systemPrompt, 
      conversationHistory, 
      userMessage, 
      isFollowUp
    );

    // Optimized logging
    console.log(`📝 [OPENAI] Messages count: ${messages.length}`);
    console.log(`👤 [OPENAI] User type: ${detectedUserType}, Language: ${finalLanguageStyle}`);
    console.log(`🎯 [OPENAI] Context: hasGreeting=${hasGreeting}, isFollowUp=${isFollowUp}`);
    if (customContext) {
      console.log(`📄 [OPENAI] RAG context length: ${customContext.length} characters`);
    }

    // Generate response
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
      top_p: 0.8,
      frequency_penalty: 0.2,
      presence_penalty: 0.1,
      stop: ["\n\n", "---", "===="]
    });

    const aiReply = completion.choices[0].message.content.trim();

    // Optimized monitoring
    console.log('✅ [OPENAI] Response generated:', {
      model: modelName,
      tokens: completion.usage?.total_tokens || 0,
      hasContext: !!customContext,
      replyLength: aiReply.length,
      isShort: isShortAnswer,
      userType: detectedUserType,
      languageStyle: finalLanguageStyle,
      wordCount: aiReply.split(' ').length,
      hasOffer: hasOfferPhrase(aiReply),
      hasGreeting: hasGreeting,
      isFollowUp: isFollowUp
    });

    return aiReply;

  } catch (error) {
    console.error('❌ [OPENAI] Error generating response:', error);
    
    return getContextAwareFallback(options);
  }
}

/**
 * ✅ OPTIMASI: Build Optimized System Prompt (TOKEN EFFICIENT)
 */
function buildOptimizedSystemPrompt(customContext, userMessage, languageStyle, userType, hasGreeting, isFollowUp, conversationHistory) {
  // Base prompt yang sangat efisien
  let systemPrompt = BASE_SYSTEM_INSTRUCTION;
  
  // Context hints yang super singkat
  if (hasGreeting) systemPrompt += `\n- User memulai dengan greeting, respon ramah`;
  if (isFollowUp) systemPrompt += `\n- Ini follow-up, pertimbangkan percakapan sebelumnya`;
  if (userType === 'engaged') systemPrompt += `\n- User engaged, gunakan gaya personal`;
  if (userType === 'prospective') systemPrompt += `\n- User calon mahasiswa, beri info encouraging`;

  if (customContext) {
    // ✅ OPTIMASI DRAMATIS: Prompt yang jauh lebih singkat
    systemPrompt += `\n\nKONTEKS TAZKIA:\n${customContext}\n\nCONTOH: "Murabahah jual beli syariah. Apakah ingin tahu detailnya?"`;
  } else {
    const fallback = getFallbackTemplate(languageStyle, userType);
    systemPrompt += `\n\nJIKA TIDAK TAHU: "${fallback}"`;
  }
  
  return systemPrompt;
}

/**
 * ✅ OPTIMASI: Build Optimized Messages (TOKEN EFFICIENT)
 */
function buildOptimizedMessages(systemPrompt, conversationHistory, userMessage, isFollowUp) {
  const messages = [{ role: 'system', content: systemPrompt }];
  
  // ✅ OPTIMASI: Hanya tambahkan 1-2 message history untuk follow-up
  if (isFollowUp && conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-2); // Hanya 2 message terakhir
    messages.push(...recentHistory.map(msg => ({
      role: msg.role === 'bot' ? 'assistant' : msg.role,
      content: msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content
    })));
  } else if (conversationHistory.length > 0) {
    // Untuk regular questions, tambahkan 1 message terakhir saja
    const lastMessage = conversationHistory.slice(-1);
    messages.push(...lastMessage.map(msg => ({
      role: msg.role === 'bot' ? 'assistant' : msg.role,
      content: msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content
    })));
  }
  
  messages.push({ role: 'user', content: userMessage });
  
  return messages;
}

/**
 * ✅ OPTIMASI: Get Optimal Language Style
 */
function getOptimalLanguageStyle(baseStyle, userType, hasGreeting) {
  if (userType === 'prospective') return 'prospective';
  if (userType === 'engaged') return 'casual';
  if (hasGreeting && baseStyle === 'formal') return 'casual';
  return baseStyle;
}

/**
 * ✅ OPTIMASI: Context-Aware Fallback
 */
function getContextAwareFallback(options) {
  const { languageStyle = 'formal', userType = 'general', hasGreeting = false } = options;
  
  let fallbackStyle = languageStyle;
  if (hasGreeting && languageStyle === 'formal') {
    fallbackStyle = 'casual';
  }
  
  const templates = FALLBACK_RESPONSES[userType] || FALLBACK_RESPONSES[fallbackStyle] || FALLBACK_RESPONSES.formal;
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * ✅ OPTIMASI: Check if response has offer phrase
 */
function hasOfferPhrase(response) {
  const offerIndicators = [
    'ingin', 'mau', 'apakah', 'butuh', 'perlu', 'bisa', 'boleh',
    'ingin tahu', 'mau tahu', 'apakah perlu', 'apakah ingin'
  ];
  
  return offerIndicators.some(indicator => 
    response.toLowerCase().includes(indicator) && response.includes('?')
  );
}

/**
 * ✅ OPTIMASI: Deteksi Jenis User dengan Enhanced Logic
 */
function detectUserType(userMessage, conversationHistory) {
  const message = userMessage.toLowerCase();
  const fullConversation = conversationHistory.map(msg => msg.content).join(' ').toLowerCase();
  
  // Keyword untuk deteksi calon mahasiswa
  const prospectiveKeywords = [
    'pendaftaran', 'daftar', 'registrasi', 'mahasiswa baru', 'calon mahasiswa', 
    'syarat daftar', 'biaya kuliah', 'jurusan apa', 'pilih prodi', 'test masuk',
    'beasiswa', 'uang pangkal', 'registrasi ulang', 'penerimaan', 'seleksi'
  ];
  
  // Keyword untuk user engaged
  const engagedKeywords = [
    'thanks', 'thank you', 'makasih', 'terima kasih', 'keren', 'bagus', 'helpful',
    'mantap', 'oke', 'good', 'nice', 'sip', 'oke banget', 'wow', 'awesome'
  ];
  
  const isProspective = prospectiveKeywords.some(keyword => 
    message.includes(keyword) || fullConversation.includes(keyword)
  );
  
  const isEngaged = engagedKeywords.some(keyword => 
    message.includes(keyword) || fullConversation.includes(keyword)
  );
  
  if (isProspective) return 'prospective';
  if (isEngaged) return 'engaged';
  return 'general';
}

/**
 * ✅ OPTIMASI: Get Fallback Template dengan Enhanced Logic
 */
function getFallbackTemplate(languageStyle, userType) {
  // Prioritaskan user type detection
  if (userType === 'prospective') {
    const templates = FALLBACK_RESPONSES.prospective;
    return templates[Math.floor(Math.random() * templates.length)];
  }
  
  if (userType === 'engaged') {
    const templates = FALLBACK_RESPONSES.casual;
    return templates[Math.floor(Math.random() * templates.length)];
  }
  
  // Gunakan style berdasarkan preference
  const templates = FALLBACK_RESPONSES[languageStyle] || FALLBACK_RESPONSES.formal;
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * ✅ OPTIMASI: Generate Offer Phrase dengan Context Awareness
 */
function generateOfferPhrase(topic, questionType = 'general', userType = 'general') {
  const templates = OFFER_TEMPLATES[questionType] || OFFER_TEMPLATES.general;
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  let finalTopic = topic;
  if (userType === 'prospective' && questionType === 'program') {
    finalTopic = 'program studi ini';
  }
  
  return template.replace('{topic}', finalTopic);
}

/**
 * 3. Test OpenAI Connection - OPTIMIZED
 */
async function testOpenAIConnection() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return { 
        success: false, 
        error: 'OPENAI_API_KEY tidak ditemukan' 
      };
    }

    console.log('🔧 [OPENAI] Testing connection...');

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { 
          role: 'user', 
          content: 'Jawab singkat: Assalamualaikum' 
        }
      ],
      max_tokens: 20,
      temperature: 0.1
    });

    const response = completion.choices[0].message.content;
    
    console.log('✅ [OPENAI] Connection test successful:', response);

    return { 
      success: true, 
      message: response,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      tokens: completion.usage?.total_tokens 
    };

  } catch (error) {
    console.error('❌ [OPENAI] Connection test failed:', error);
    return { 
      success: false, 
      error: error.message,
      code: error.code 
    };
  }
}

/**
 * 4. Analyze Academic Content - OPTIMIZED
 */
async function analyzeAcademicContent(content) {
  try {
    const prompt = `Analisis konten akademik berikut:\n\n${content}\n\nBerikan insight yang helpful dan terstruktur.`;
    return await generateAIResponse(prompt, [], null);
  } catch (error) {
    console.error('❌ [OPENAI] Error analyzing academic content:', error);
    throw new Error('Gagal menganalisis konten akademik: ' + error.message);
  }
}

/**
 * 5. Test Embedding Function - OPTIMIZED
 */
async function testEmbedding() {
  try {
    console.log('🧪 [OPENAI] Testing embedding function...');
    
    const testText = "Lokasi kampus Tazkia di Sentul City Bogor";
    const embedding = await createEmbedding(testText);
    
    return {
      success: true,
      dimensions: embedding.length,
      sample: embedding.slice(0, 3),
      message: 'Embedding test successful'
    };
    
  } catch (error) {
    console.error('❌ [OPENAI] Embedding test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 6. Test RAG Response - OPTIMIZED
 */
async function testRAGResponse(userMessage, customContext) {
  try {
    console.log('🧪 [OPENAI] Testing RAG response...');
    
    const response = await generateAIResponse(userMessage, [], customContext, {
      maxTokens: 300,
      temperature: 0.1,
      isShortAnswer: true
    });
    
    return {
      success: true,
      userMessage: userMessage,
      response: response,
      contextUsed: !!customContext,
      contextLength: customContext ? customContext.length : 0,
      replyLength: response.length,
      wordCount: response.split(' ').length,
      hasOffer: hasOfferPhrase(response)
    };
    
  } catch (error) {
    console.error('❌ [OPENAI] RAG test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 7. Test Short Answer - OPTIMIZED
 */
async function testShortAnswer(userMessage, customContext = null) {
  try {
    console.log('🧪 [OPENAI] Testing SHORT answer response...');
    
    const response = await generateAIResponse(userMessage, [], customContext, {
      maxTokens: 250,
      temperature: 0.1,
      isShortAnswer: true
    });
    
    return {
      success: true,
      userMessage: userMessage,
      response: response,
      contextUsed: !!customContext,
      replyLength: response.length,
      wordCount: response.split(' ').length,
      isShort: response.length <= 300,
      hasOffer: hasOfferPhrase(response)
    };
    
  } catch (error) {
    console.error('❌ [OPENAI] Short answer test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 8. Test Context-Aware Responses - OPTIMIZED
 */
async function testContextAwareResponses() {
  try {
    console.log('🧪 [OPENAI] Testing context-aware responses...');
    
    const testCases = [
      { 
        message: "Halo, mau tanya prodi", 
        options: { hasGreeting: true, userType: 'prospective' } 
      },
      { 
        message: "Thanks infonya!", 
        options: { userType: 'engaged', languageStyle: 'casual' } 
      }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      const response = await generateAIResponse(
        testCase.message, 
        [], 
        null, 
        testCase.options
      );
      
      results.push({
        testCase: testCase,
        response: response,
        length: response.length,
        wordCount: response.split(' ').length,
        hasOffer: hasOfferPhrase(response)
      });
    }
    
    return {
      success: true,
      results: results
    };
    
  } catch (error) {
    console.error('❌ [OPENAI] Context-aware test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateAIResponse,
  createEmbedding,
  chatCompletion, 
  testOpenAIConnection,
  analyzeAcademicContent,
  testEmbedding,
  testRAGResponse,
  testShortAnswer,
  testContextAwareResponses, 
  detectUserType, 
  generateOfferPhrase,
  hasOfferPhrase 
};