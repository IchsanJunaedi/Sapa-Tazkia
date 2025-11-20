const OpenAI = require('openai');

// --- Load Environment Variables ---
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * System Prompt Dasar (Persona Kia) - OPTIMIZED FOR SHORT ANSWERS
 */
const BASE_SYSTEM_INSTRUCTION = `
Anda adalah "Kia", asisten virtual resmi Universitas & STMIK Tazkia.
Karakter: Ramah, Cerdas, Membantu, dan Islami.

PANDUAN UMUM:
- Gunakan bahasa Indonesia yang santun dan Islami
- Gunakan "Afwan" untuk meminta maaf  
- Gunakan "Alhamdulillah" untuk informasi positif
- Balas salam dengan lengkap jika user mengucapkan salam

ATURAN UTAMA:
- Berikan jawaban yang AKURAT dan HELPFUL
- Prioritaskan informasi yang paling relevan untuk user
- Jika informasi tidak tersedia, arahkan ke sumber resmi
`;

/**
 * TEMPLATE PENAWARAN BERDASARKAN JENIS PERTANYAAN
 */
const OFFER_TEMPLATES = {
  // Template untuk pertanyaan definisi/konsep
  definition: [
    "Apakah Anda ingin mengetahui ketentuan penting mengenai {topic} lebih lanjut?",
    "Mau tahu prinsip-prinsip dasar {topic} dalam syariah?",
    "Ingin saya jelaskan praktik penerapan {topic} di perbankan syariah?"
  ],
  
  // Template untuk pertanyaan lokasi/fasilitas
  location: [
    "Apakah perlu informasi detail tentang fasilitas {topic}?",
    "Mau tahu akses transportasi menuju {topic}?",
    "Ingin informasi lengkap tentang jam operasional {topic}?"
  ],
  
  // Template untuk pertanyaan program studi
  program: [
    "Apakah ingin mengetahui prospek karir lulusan {topic}?",
    "Mau tahu detail kurikulum dan mata kuliah {topic}?",
    "Ingin informasi syarat pendaftaran {topic}?"
  ],
  
  // Template untuk pertanyaan prosedur
  procedure: [
    "Apakah perlu langkah-langkah detail {topic}?",
    "Mau tahu dokumen yang diperlukan untuk {topic}?",
    "Ingin informasi timeline proses {topic}?"
  ],
  
  // Template umum
  general: [
    "Apakah Anda ingin mengetahui lebih detail tentang {topic}?",
    "Mau saya jelaskan aspek lain dari {topic}?",
    "Ingin informasi lengkap mengenai {topic}?"
  ]
};

/**
 * FALLBACK RESPONSES - VARIASI FORMAL & CASUAL
 */
const FALLBACK_RESPONSES = {
  // ✅ FALLBACK FORMAL (default)
  formal: [
    "Afwan, informasi tersebut belum tersedia dalam database pengetahuan saya saat ini. Untuk informasi lengkap, silakan hubungi Admin Kampus di 0821-84-800-600 atau kunjungi website resmi www.tazkia.ac.id.",
    
    "Afwan, saat ini informasi yang Anda tanyakan belum tersedia dalam sistem. Mohon hubungi Admin Kampus di nomor 0821-84-800-600 untuk bantuan lebih lanjut.",
    
    "Alhamdulillah, saya ingin membantu namun informasi spesifik tersebut sedang tidak tersedia. Silakan langsung konsultasi dengan Admin Kampus di 0821-84-800-600 untuk jawaban yang akurat."
  ],
  
  // ✅ FALLBACK CASUAL (untuk user engagement)
  casual: [
    "Wah, sepertinya informasi ini belum ada di databasenya Kia nih 😊 Tapi jangan khawatir! Langsung aja chat Admin Kampus di 0821-84-800-600, mereka pasti bisa bantu!",
    
    "Hmm, Kia belum punya info detail tentang ini nih. Tapi coba langsung tanya ke Admin Kampus di 0821-84-800-600, mereka solusinya! 🚀",
    
    "Nampaknya Kia perlu update database nih untuk pertanyaan ini 😅 Sambil itu, yuk langsung konsultasi dengan Admin Kampus di 0821-84-800-600, dijamin dapat jawaban lengkap!"
  ],
  
  // ✅ FALLBACK PENDAFTAR (khusus calon mahasiswa)
  prospective: [
    "Spesial untuk calon mahasiswa Tazkia! 🎓 Untuk info lengkapnya, langsung aja chat Admin Pendaftaran di 0821-84-800-600. Mereka siap bantu semua pertanyaan kamu!",
    
    "Wah, pertanyaan yang bagus nih! Biar dapat info yang super lengkap, yuk langsung hubungi Admin Pendaftaran di 0821-84-800-600. Dijamin semuanya jelas! ✨",
    
    "Hai calon mahasiswa Tazkia! 🎉 Kia sarankan langsung konsultasi dengan Admin di 0821-84-800-600 untuk informasi terupdate. Mereka expert banget soal ini!"
  ]
};

/**
 * 1. Generate Embedding (Ubah teks jadi vektor)
 */
async function createEmbedding(text) {
  try {
    // Cek API Key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY missing in environment variables');
    }

    // Bersihkan teks untuk embedding yang lebih baik
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
 * 2. Generate AI Response - OPTIMIZED FOR SHORT ANSWERS + OFFERS + FALLBACK
 */
async function generateAIResponse(userMessage, conversationHistory = [], customContext = null, options = {}) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY tidak valid. Silakan cek file .env');
    }

    const {
      maxTokens = 600,
      temperature = 0.2,
      isShortAnswer = true,
      languageStyle = 'formal' // ✅ BARU: 'formal', 'casual', 'prospective'
    } = options;

    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    console.log(`🤖 [OPENAI] Generating ${isShortAnswer ? 'SHORT' : 'DETAILED'} response (${languageStyle} style)...`);

    // ✅ DETEKSI JENIS USER UNTUK FALLBACK YANG TEPAT
    const userType = detectUserType(userMessage, conversationHistory);
    const finalLanguageStyle = (languageStyle === 'formal' && userType === 'prospective') ? 'prospective' : languageStyle;

    // ✅ PROMPT YANG DIOPTIMALKAN DENGAN FALLBACK & PENAWARAN
    let systemPrompt = BASE_SYSTEM_INSTRUCTION;
    
    if (customContext) {
      systemPrompt += `

INFORMASI KAMPUS TAZKIA UNTUK ANDA:

${customContext}

**🔷 ATURAN KETAT UNTUK JAWABAN ANDA:**

**📝 STRUKTUR WAJIB (MAX 3-4 KALIMAT):**
1. **KALIMAT 1-2:** Jawaban inti yang singkat dan padat
2. **KALIMAT 3:** Contoh/contoh praktis singkat (jika diperlukan)
3. **KALIMAT TERAKHIR:** PENAWARAN untuk informasi lebih lanjut

**🎯 CONTOH STRUKTUR YANG HARUS DIIKUTI:**
- "Murabahah adalah jual beli dengan keuntungan yang disepakati. Bank membeli barang lalu menjual ke nasabah dengan markup. Apakah Anda ingin mengetahui ketentuan penting murabahah lebih lanjut?"
- "Lokasi kampus di Sentul City Bogor, mudah diakses dari tol. Apakah perlu informasi fasilitas kampus atau program studi yang tersedia?"

**💡 STRATEGI PENAWARAN WAJIB:**
- SELALU akhiri dengan penawaran untuk informasi detail
- Pilih jenis penawaran berdasarkan konteks pertanyaan
- Gunakan template: "Apakah Anda ingin mengetahui [aspek] lebih lanjut?"

**🚫 YANG TIDAK BOLEH DILAKUKAN:**
- JANGAN berikan semua detail sekaligus
- JANGAN buat list/poin-poin panjang 
- JANGAN tulis lebih dari 4 kalimat tanpa penawaran

**Tugas Anda:** BERIKAN JAWABAN SINGKAT + PENAWARAN LANJUTAN!
`;
    } else {
      // ✅ FALLBACK PROMPT DENGAN VARIASI BAHASA
      const fallbackTemplate = getFallbackTemplate(finalLanguageStyle, userType);
      
      systemPrompt += `

INFORMASI:
User bertanya: "${userMessage}"
Jenis user terdeteksi: ${userType}

**ATURAN JAWABAN FALLBACK:**
1. Gunakan template yang sesuai dengan jenis user
2. MAX 2-3 KALIMAT saja
3. JANGAN berikan penawaran lanjutan (kecuali untuk prospective)
4. Arahkan ke Admin Kampus di 0821-84-800-600

**TEMPLATE YANG HARUS DIGUNAKAN:**
${fallbackTemplate}

**CONTOH RESPONSE YANG DIHARAPKAN:**
"${fallbackTemplate}"
`;
    }

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : msg.role,
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    // Log untuk debugging
    console.log(`📝 [OPENAI] Messages count: ${messages.length}`);
    console.log(`👤 [OPENAI] User type: ${userType}, Language: ${finalLanguageStyle}`);
    console.log(`🔍 [OPENAI] User query: "${userMessage}"`);
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
      frequency_penalty: 0.3,
      presence_penalty: 0.2,
      stop: ["\n\n", "---", "===="]
    });

    const aiReply = completion.choices[0].message.content.trim();

    // Log monitoring detail
    console.log('✅ [OPENAI] Response generated:', {
      model: modelName,
      tokens: completion.usage?.total_tokens || 0,
      hasContext: !!customContext,
      replyLength: aiReply.length,
      isShort: isShortAnswer,
      userType: userType,
      languageStyle: finalLanguageStyle,
      wordCount: aiReply.split(' ').length,
      hasOffer: aiReply.includes('?') && (aiReply.includes('ingin') || aiReply.includes('mau') || aiReply.includes('apakah')),
      first100chars: aiReply.substring(0, 100) + '...'
    });

    return aiReply;

  } catch (error) {
    console.error('❌ [OPENAI] Error generating response:', error);
    
    // ✅ FALLBACK ERROR YANG LEBIH BAik
    const randomFormal = FALLBACK_RESPONSES.formal[Math.floor(Math.random() * FALLBACK_RESPONSES.formal.length)];
    return randomFormal;
  }
}

/**
 * ✅ FUNGSI BARU: Deteksi Jenis User
 */
function detectUserType(userMessage, conversationHistory) {
  const message = userMessage.toLowerCase();
  const fullConversation = conversationHistory.map(msg => msg.content).join(' ').toLowerCase();
  
  // Keyword untuk deteksi calon mahasiswa
  const prospectiveKeywords = [
    'pendaftaran', 'daftar', 'registrasi', 'mahasiswa baru', 'calon mahasiswa', 
    'syarat daftar', 'biaya kuliah', 'jurusan apa', 'pilih prodi', 'test masuk',
    'beasiswa', 'uang pangkal', 'registrasi ulang'
  ];
  
  // Keyword untuk user engaged
  const engagedKeywords = [
    'thanks', 'thank you', 'makasih', 'terima kasih', 'keren', 'bagus', 'helpful',
    'mantap', 'oke', 'good', 'nice', 'sip', 'oke banget'
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
 * ✅ FUNGSI BARU: Get Fallback Template
 */
function getFallbackTemplate(languageStyle, userType) {
  // Prioritaskan prospective style jika terdeteksi
  if (userType === 'prospective') {
    const templates = FALLBACK_RESPONSES.prospective;
    return templates[Math.floor(Math.random() * templates.length)];
  }
  
  // Gunakan style berdasarkan preference
  const templates = FALLBACK_RESPONSES[languageStyle] || FALLBACK_RESPONSES.formal;
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * ✅ FUNGSI BARU: Generate Offer Phrase
 */
function generateOfferPhrase(topic, questionType = 'general') {
  const templates = OFFER_TEMPLATES[questionType] || OFFER_TEMPLATES.general;
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template.replace('{topic}', topic);
}

/**
 * 3. Test OpenAI Connection - ENHANCED
 */
async function testOpenAIConnection() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return { 
        success: false, 
        error: 'OPENAI_API_KEY tidak ditemukan di environment variables' 
      };
    }

    console.log('🔧 [OPENAI] Testing connection...');

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { 
          role: 'user', 
          content: 'Jawab dengan singkat: Assalamualaikum, apa kabar?' 
        }
      ],
      max_tokens: 30,
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
    const prompt = `
Analisis konten akademik berikut dan berikan insight yang helpful:

${content}

Berikan analisis yang:
- Jelas dan terstruktur
- Berfokus pada poin-poin penting  
- Membantu dalam memahami materi
- Dalam bahasa Indonesia yang baik
`;

    return await generateAIResponse(prompt, [], null);

  } catch (error) {
    console.error('❌ [OPENAI] Error analyzing academic content:', error);
    throw new Error('Gagal menganalisis konten akademik: ' + error.message);
  }
}

/**
 * 5. Test Embedding Function - untuk debugging
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
 * 6. Test RAG Response - untuk debugging RAG khusus
 */
async function testRAGResponse(userMessage, customContext) {
  try {
    console.log('🧪 [OPENAI] Testing RAG response...');
    
    const response = await generateAIResponse(userMessage, [], customContext, {
      maxTokens: 600,
      temperature: 0.2,
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
      hasOffer: response.includes('?') && (response.includes('ingin') || response.includes('mau') || response.includes('apakah'))
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
 * 7. Test Short Answer - khusus testing jawaban singkat
 */
async function testShortAnswer(userMessage, customContext = null) {
  try {
    console.log('🧪 [OPENAI] Testing SHORT answer response...');
    
    const response = await generateAIResponse(userMessage, [], customContext, {
      maxTokens: 400,
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
      isShort: response.length <= 600,
      hasOffer: response.includes('?') && (response.includes('ingin') || response.includes('mau') || response.includes('apakah'))
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
 * 8. ✅ FUNGSI BARU: Test Fallback Responses
 */
async function testFallbackResponses() {
  try {
    console.log('🧪 [OPENAI] Testing fallback responses...');
    
    const testCases = [
      { message: "Apa syarat beasiswa?", type: "prospective" },
      { message: "Bagaimana cara daftar ulang?", type: "prospective" },
      { message: "Fasilitas apa saja?", type: "general" },
      { message: "Thanks atas bantuannya!", type: "engaged" }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      const response = await generateAIResponse(testCase.message, [], null, {
        maxTokens: 300,
        isShortAnswer: true,
        languageStyle: 'formal'
      });
      
      results.push({
        testCase: testCase,
        response: response,
        length: response.length,
        userType: detectUserType(testCase.message, [])
      });
    }
    
    return {
      success: true,
      results: results
    };
    
  } catch (error) {
    console.error('❌ [OPENAI] Fallback test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  generateAIResponse,
  createEmbedding,
  testOpenAIConnection,
  analyzeAcademicContent,
  testEmbedding,
  testRAGResponse,
  testShortAnswer,
  testFallbackResponses, 
  detectUserType, 
  generateOfferPhrase 
};