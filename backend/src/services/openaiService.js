const OpenAI = require('openai');

// --- Load Environment Variables ---
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * ✅ PERBAIKAN 5: ANTI-HALLUCINATION SYSTEM PROMPT
 */
const STRICT_SYSTEM_INSTRUCTION = `Anda adalah "Kia", asisten virtual Universitas Tazkia.
Karakter: Ramah, Cerdas, Membantu, Islami.

🚫 ATURAN KETAT UNTUK MENCEGAH HALUSINASI:
1. HANYA gunakan informasi dari KONTEKS TAZKIA yang disediakan
2. JANGAN MEMBUAT INFORMASI BARU yang tidak ada dalam konteks
3. Jika informasi TIDAK DITEMUKAN dalam konteks, katakan: "Maaf, informasi tidak ditemukan dalam database Tazkia"
4. JANGAN berasumsi, mengimprovisasi, atau menebak informasi
5. Fokus pada FAKTA yang ada dalam konteks saja

📝 ATURAN RESPON:
- Gunakan bahasa Indonesia santun dan Islami
- Jawab SINGKAT (max 3-4 kalimat)
- Fokus pada informasi paling relevan
- Akhiri dengan penawaran bantuan lanjutan jika relevan

⚠️ JIKA TIDAK ADA KONTEKS:
- Akui bahwa informasi tidak tersedia
- Arahkan ke Admin Kampus di 0821-84-800-600
- Jangan mencoba menjawab tanpa konteks`;

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
 * ✅ PERBAIKAN 7: CONTEXT-AWARE FALLBACK RESPONSES
 */
const FALLBACK_RESPONSES = {
  syariah: [
    "Maaf, informasi syariah yang diminta tidak ditemukan dalam database Tazkia. Silakan konsultasi langsung dengan Admin Syariah di 0821-84-800-600.",
    "Informasi fiqh dan ekonomi syariah tersebut belum tersedia. Hubungi Dosen Syariah untuk konsultasi lebih lanjut di 0821-84-800-600."
  ],
  
  location: [
    "Lokasi yang ditanyakan tidak ditemukan dalam database. Kunjungi website www.tazkia.ac.id untuk peta kampus lengkap atau hubungi Admin di 0821-84-800-600.",
    "Informasi alamat ini belum tersedia. Tim Admin siap membantu memberikan petunjuk lokasi di 0821-84-800-600."
  ],
  
  program: [
    "Informasi program studi tersebut belum tersedia. Silakan hubungi Admin Akademik di 0821-84-800-600 untuk informasi lengkap.",
    "Detail program studi tidak ditemukan. Tim penerimaan mahasiswa baru siap membantu di 0821-84-800-600."
  ],
  
  formal: [
    "Maaf, informasi tidak ditemukan dalam database Tazkia. Silakan hubungi Admin di 0821-84-800-600 untuk bantuan lebih lanjut.",
    "Pertanyaan bagus! Namun informasinya belum tersedia dalam sistem. Tim Admin siap membantu di 0821-84-800-600."
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
    temperature: options.temperature || 0.01, // 🔽 PERBAIKAN 6
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
 * 2. Generate AI Response - OPTIMIZED FOR TOKENS + CONTEXT AWARENESS + ANTI-HALLUCINATION
 */
async function generateAIResponse(userMessage, conversationHistory = [], customContext = null, options = {}) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY tidak valid. Silakan cek file .env');
    }

    const {
      maxTokens = 350,
      temperature = 0.01, // ✅ PERBAIKAN 6: TEMPERATURE LEBIH RENDAH
      isShortAnswer = true,
      languageStyle = 'formal',
      hasGreeting = false,
      isFollowUp = false,
      userType = 'general',
      questionType = 'general' // ✅ BARU: Untuk context-aware fallback
    } = options;

    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    console.log(`🤖 [OPENAI] Generating ${isShortAnswer ? 'SHORT' : 'DETAILED'} response (${languageStyle} style, temp: ${temperature})...`);

    // ✅ DETEKSI JENIS USER & CONTEXT AWARENESS
    const detectedUserType = userType || detectUserType(userMessage, conversationHistory);
    const finalLanguageStyle = getOptimalLanguageStyle(languageStyle, detectedUserType, hasGreeting);

    // ✅ BUILD OPTIMIZED SYSTEM PROMPT DENGAN ANTI-HALLUCINATION
    let systemPrompt = buildOptimizedSystemPrompt(
      customContext, 
      userMessage, 
      finalLanguageStyle, 
      detectedUserType,
      hasGreeting,
      isFollowUp,
      conversationHistory,
      questionType // ✅ BARU: Pass question type
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
    console.log(`👤 [OPENAI] User type: ${detectedUserType}, Language: ${finalLanguageStyle}, Question type: ${questionType}`);
    console.log(`🎯 [OPENAI] Context: hasGreeting=${hasGreeting}, isFollowUp=${isFollowUp}, hasContext=${!!customContext}`);
    if (customContext) {
      console.log(`📄 [OPENAI] RAG context length: ${customContext.length} characters`);
    }

    // Generate response
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature, // ✅ PERBAIKAN 6: Temperature sangat rendah
      top_p: 0.9,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
      stop: ["\n\n", "---", "===="]
    });

    const aiReply = completion.choices[0].message.content.trim();

    // ✅ VALIDASI RESPONSE UNTUK ANTI-HALLUCINATION
    const validatedReply = validateResponseForHallucination(aiReply, customContext, userMessage);
    
    // Optimized monitoring
    console.log('✅ [OPENAI] Response generated:', {
      model: modelName,
      tokens: completion.usage?.total_tokens || 0,
      hasContext: !!customContext,
      replyLength: validatedReply.length,
      isShort: isShortAnswer,
      userType: detectedUserType,
      languageStyle: finalLanguageStyle,
      questionType: questionType,
      wordCount: validatedReply.split(' ').length,
      hasOffer: hasOfferPhrase(validatedReply),
      hasGreeting: hasGreeting,
      isFollowUp: isFollowUp,
      wasValidated: validatedReply !== aiReply
    });

    return validatedReply;

  } catch (error) {
    console.error('❌ [OPENAI] Error generating response:', error);
    
    // ✅ PERBAIKAN 7: GUNAKAN CONTEXT-AWARE FALLBACK
    return getContextAwareFallback(options);
  }
}

/**
 * ✅ PERBAIKAN 5: BUILD OPTIMIZED SYSTEM PROMPT DENGAN ANTI-HALLUCINATION
 */
function buildOptimizedSystemPrompt(customContext, userMessage, languageStyle, userType, hasGreeting, isFollowUp, conversationHistory, questionType = 'general') {
  // Gunakan strict system instruction sebagai base
  let systemPrompt = STRICT_SYSTEM_INSTRUCTION;
  
  // Context hints yang super singkat
  if (hasGreeting) systemPrompt += `\n- User memulai dengan greeting, respon ramah tapi tetap ikuti aturan ketat`;
  if (isFollowUp) systemPrompt += `\n- Ini follow-up, pertimbangkan percakapan sebelumnya TAPI tetap ikuti aturan ketat`;
  if (userType === 'engaged') systemPrompt += `\n- User engaged, gunakan gaya personal TAPI tetap ikuti aturan ketat`;
  if (userType === 'prospective') systemPrompt += `\n- User calon mahasiswa, beri info encouraging TAPI tetap ikuti aturan ketat`;

  if (customContext) {
    // ✅ OPTIMASI: Prompt yang fokus pada anti-hallucination
    systemPrompt += `\n\n📚 KONTEKS TAZKIA YANG HARUS DIGUNAKAN:\n${customContext}\n\n`;
    systemPrompt += `💡 CONTOH RESPON YANG BENAR:\n`;
    systemPrompt += `- "Berdasarkan informasi, murabahah adalah jual beli dengan keuntungan. Apakah ingin tahu detailnya?"\n`;
    systemPrompt += `- "Lokasi kampus di Jl. Ir H Djuanda Sentul City Bogor. Perlu informasi fasilitas kampus?"\n\n`;
    systemPrompt += `❌ CONTOH RESPON YANG SALAH (HALUSINASI):\n`;
    systemPrompt += `- "Menurut pengetahuan saya..." (JANGAN gunakan frasa ini)\n`;
    systemPrompt += `- "Saya rasa..." (JANGAN berasumsi)\n`;
    systemPrompt += `- "Biasanya..." (JANGAN generalisasi)`;
  } else {
    // ✅ JIKA TIDAK ADA KONTEKS, GUNAKAN FALLBACK YANG TEPAT
    const fallback = getContextAwareFallback({ 
      languageStyle, 
      userType, 
      questionType 
    });
    systemPrompt += `\n\n⚠️ TIDAK ADA KONTEKS: Gunakan fallback response: "${fallback}"`;
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
 * ✅ PERBAIKAN 6: VALIDASI RESPONSE UNTUK ANTI-HALLUCINATION
 */
function validateResponseForHallucination(response, context, userMessage) {
  if (!context) {
    // Jika tidak ada konteks, pastikan response adalah fallback yang sesuai
    const fallbackIndicators = ['tidak ditemukan', 'belum tersedia', 'hubungi admin', '0821-84-800-600'];
    const isFallback = fallbackIndicators.some(indicator => 
      response.toLowerCase().includes(indicator)
    );
    
    if (!isFallback) {
      console.log(`⚠️ [OPENAI] Response mungkin halusinasi (no context): "${response.substring(0, 100)}..."`);
      // Ganti dengan fallback yang aman
      return getContextAwareFallback({ questionType: 'general' });
    }
  }
  
  // Deteksi frasa yang menunjukkan halusinasi
  const hallucinationPhrases = [
    'menurut pengetahuan saya',
    'saya rasa',
    'biasanya',
    'umumnya',
    'pada dasarnya',
    'secara umum',
    'menurut pemahaman saya',
    'saya pikir',
    'mungkin',
    'kemungkinan'
  ];
  
  const lowerResponse = response.toLowerCase();
  const hasHallucinationPhrase = hallucinationPhrases.some(phrase => 
    lowerResponse.includes(phrase)
  );
  
  if (hasHallucinationPhrase) {
    console.log(`⚠️ [OPENAI] Detected potential hallucination phrase in response`);
    // Bisa ditambahkan logika untuk memperbaiki response di sini
  }
  
  return response;
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
 * ✅ PERBAIKAN 7: CONTEXT-AWARE FALLBACK
 */
function getContextAwareFallback(options) {
  const { 
    languageStyle = 'formal', 
    userType = 'general', 
    hasGreeting = false,
    questionType = 'general'
  } = options;
  
  // Prioritaskan question type untuk fallback yang lebih spesifik
  if (questionType && FALLBACK_RESPONSES[questionType]) {
    const templates = FALLBACK_RESPONSES[questionType];
    return templates[Math.floor(Math.random() * templates.length)];
  }
  
  // Fallback ke user type
  if (userType === 'prospective' && FALLBACK_RESPONSES.prospective) {
    const templates = FALLBACK_RESPONSES.prospective;
    return templates[Math.floor(Math.random() * templates.length)];
  }
  
  // Fallback ke language style
  let fallbackStyle = languageStyle;
  if (hasGreeting && languageStyle === 'formal') {
    fallbackStyle = 'casual';
  }
  
  const templates = FALLBACK_RESPONSES[fallbackStyle] || FALLBACK_RESPONSES.formal;
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
      temperature: 0.01 // ✅ PERBAIKAN 6
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
      temperature: 0.01, // ✅ PERBAIKAN 6
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
      temperature: 0.01, // ✅ PERBAIKAN 6
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
        options: { hasGreeting: true, userType: 'prospective', questionType: 'program' } 
      },
      { 
        message: "Thanks infonya!", 
        options: { userType: 'engaged', languageStyle: 'casual' } 
      },
      { 
        message: "Apa itu murabahah?", 
        options: { questionType: 'syariah' } 
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
        hasOffer: hasOfferPhrase(response),
        isFallback: response.includes('0821-84-800-600') || response.includes('tidak ditemukan')
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

/**
 * 9. Test Anti-Hallucination - NEW
 */
async function testAntiHallucination() {
  try {
    console.log('🧪 [OPENAI] Testing anti-hallucination...');
    
    const testCases = [
      {
        message: "Apa itu program studi yang tidak ada di Tazkia?",
        context: null, // No context - should trigger fallback
        description: "No context test"
      },
      {
        message: "Berapa biaya S2 di Tazkia?",
        context: "Informasi tentang program S1 Tazkia",
        description: "Partial context test"
      }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      const response = await generateAIResponse(
        testCase.message, 
        [], 
        testCase.context, 
        { questionType: 'program' }
      );
      
      const isSafe = response.includes('tidak ditemukan') || 
                    response.includes('belum tersedia') || 
                    response.includes('0821-84-800-600');
      
      results.push({
        testCase: testCase.description,
        response: response,
        isSafe: isSafe,
        length: response.length
      });
    }
    
    return {
      success: true,
      results: results,
      allSafe: results.every(r => r.isSafe)
    };
    
  } catch (error) {
    console.error('❌ [OPENAI] Anti-hallucination test failed:', error);
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
  testAntiHallucination,  
  detectUserType, 
  generateOfferPhrase,
  hasOfferPhrase 
};