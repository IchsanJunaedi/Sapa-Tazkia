const OpenAI = require('openai');

// --- Load Environment Variables ---
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * ============================================================================
 * 🛡️ GOD MODE PROMPT CONFIGURATION (STRICT ANTI-HALLUCINATION)
 * ============================================================================
 */

const OPTIMIZED_SYSTEM_PROMPT = `
⛔ **CRITICAL INSTRUCTION (BACA DULU):**
Anda adalah "Kia", AI Khusus Universitas Tazkia.
Anda **DILARANG KERAS** menjawab pertanyaan di luar topik akademik/kampus Tazkia.

🚫 **DAFTAR TOPIK TERLARANG (HARUS DITOLAK):**
1. **Kuliner/Resep Masakan:** (Contoh: "Cara buat nasi goreng", "Resep seblak"). Jawab: "Afwan, Kia hanya melayani info akademik, bukan resep masakan."
2. **Hiburan/Selebriti/Film:** (Contoh: "Siapa artis A?", "Film terbaru").
3. **Politik & Isu Sensitif.**
4. **Tugas Sekolah Umum:** (Contoh: "Hitung luas lingkaran", "Apa ibu kota Peru").

✅ **TUGAS UTAMA:**
Hanya menjawab pertanyaan User menggunakan data yang disediakan di **{context}**.

🧠 **REASONING PROCESS (SEBELUM MENJAWAB):**
1. Cek Topik: Apakah ini tentang Tazkia/Islam/Akademik? 
   - JIKA TIDAK -> TOLAK dengan sopan & Islami.
   - JIKA YA -> Lanjut ke langkah 2.
2. Cek Konteks: Apakah jawabannya ada di {context}?
   - JIKA TIDAK ADA -> Katakan "Mohon maaf, data spesifik belum tersedia." JANGAN MENGARANG.
   - JIKA ADA -> Jawab sesuai data.

🎨 **GAYA BAHASA & ADAB:**
- **Salam:** Awali dengan "Assalamualaikum" atau "Waalaikumsalam".
- **Tone:** Ramah, Formal, Islami ("Insya Allah", "Alhamdulillah", "Afwan").
- **Doa Penutup:** Wajib ada doa singkat di akhir.
- **Format:** Gunakan Bullet Points untuk daftar.
`;

const CONTEXT_ENFORCEMENT_PROMPTS = {
  syariah: `KONTEKS HUKUM/SYARIAH:
{context}

PERTANYAAN USER: "{query}"

INSTRUKSI:
1. Jawab berdasarkan teks di atas.
2. Jika teks tidak relevan dengan pertanyaan, katakan data tidak ditemukan.`,

  general: `INFORMASI KAMPUS:
{context}

PERTANYAAN USER: "{query}"

INSTRUKSI:
1. Cek apakah {context} relevan dengan "{query}".
2. JANGAN gunakan pengetahuan luar (internet/umum) jika {context} kosong.`,
  
  program: `DATA AKADEMIK:
{context}

PERTANYAAN USER: "{query}"

INSTRUKSI:
1. Fokus pada Program Studi yang ditanyakan.
2. Jika user bertanya PRODI KEDOKTERAN/TEKNIK yang tidak ada di list, katakan PRODI TERSEBUT TIDAK TERSEDIA DI TAZKIA.`
};

const OFFER_TEMPLATES = {
  program: [
    "Tertarik dengan prospek karirnya juga, Kak? 😊",
    "Kia punya info rincian biaya kuliahnya, mau dilihat?",
    "Perlu info syarat pendaftaran untuk jurusan ini?"
  ],
  general: [
    "Ada hal lain yang bisa Kia bantu jelaskan? ✨",
    "Apakah Kakak butuh panduan pendaftaran?",
    "Ingin Kia hubungkan langsung ke Admin Kampus?"
  ],
  syariah: [
    "Ingin tahu contoh penerapannya di bank syariah?",
    "Perlu dalil Al-Quran yang mendasarinya?",
    "Ada istilah fiqh lain yang membingungkan Kakak?"
  ]
};

const FALLBACK_RESPONSES = {
  lowConfidence: [
    "Afwan, Kia kurang yakin dengan jawaban untuk pertanyaan tersebut. 🤔 Agar informasinya valid, silakan tanya langsung ke Admin Kampus di 0821-84-800-600 ya.",
    "Mohon maaf, Kia belum menemukan informasi yang pas di database. Boleh dibantu Admin kami di 0821-84-800-600? 🙏"
  ],
  noContext: [
    "Afwan, detail tersebut belum tersedia di data Kia saat ini. Silakan hubungi Admin Kampus di 0821-84-800-600 ya Kak. 😊",
    "Qadarullah, Kia belum punya data lengkap soal itu. Coba konsultasi ke Admin di 0821-84-800-600 ya! ✨"
  ]
};

/**
 * ============================================================================
 * 🛠️ CORE SERVICE LOGIC
 * ============================================================================
 */

async function createEmbedding(text) {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
    const cleanText = text.replace(/\s+/g, " ").trim();
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ [OPENAI] Error creating embedding:', error);
    throw error;
  }
}

async function chatCompletion(messages, options = {}) {
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: messages,
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.3
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ [OPENAI] Completion Error:', error);
    throw error;
  }
}

async function generateAIResponse(userMessage, conversationHistory = [], customContext = null, options = {}) {
  try {
    const {
      maxTokens = 600, 
      temperature = 0.1, 
      userType = 'general',
      questionType = 'general',
      forceContextUsage = false
    } = options;

    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    console.log(`🤖 [OPENAI] Generating response for "${questionType}"...`);

    const messages = buildContextEnforcementMessages(
      userMessage, 
      conversationHistory, 
      customContext, 
      userType,
      questionType,
      forceContextUsage
    );

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
      presence_penalty: 0.0, 
    });

    let aiReply = completion.choices[0].message.content.trim();

    // Validasi Output Layer 2
    aiReply = validateAndEnhanceResponse(aiReply, customContext, userMessage, questionType);
    
    // ✅ LOGGING TOKEN YANG DIPERBAIKI (PASTI MUNCUL)
    const usage = completion.usage || { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 };
    console.log('💰 [OPENAI USAGE]', {
      model: modelName,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens, // Ini yang Anda cari
      responseLength: aiReply.length
    });

    return aiReply;

  } catch (error) {
    console.error('❌ [OPENAI] Generation failed:', error);
    return getSmartFallback(userMessage, customContext, { questionType });
  }
}

function buildContextEnforcementMessages(userMessage, conversationHistory, customContext, userType, questionType, forceContextUsage) {
  const messages = [];
  
  let systemPrompt = OPTIMIZED_SYSTEM_PROMPT;
  
  if (customContext) {
    const contextTemplate = CONTEXT_ENFORCEMENT_PROMPTS[questionType] || CONTEXT_ENFORCEMENT_PROMPTS.general;
    
    systemPrompt = contextTemplate
        .replace('{context}', customContext)
        .replace('{query}', userMessage);
    
    if (forceContextUsage) {
      systemPrompt += `\n\n⚠️ **PERINGATAN KERAS:** Gunakan data di atas! Jika pertanyaan User adalah tentang RESEP/MASAKAN/HIBURAN, JANGAN GUNAKAN DATA, TAPI TOLAK PERMINTAAN.`;
    }
  } else {
    systemPrompt += `\n\n⚠️ **INFO:** Database Kosong.
    INSTRUKSI:
    1. Jika pertanyaan adalah sapaan ("Halo", "Assalamualaikum"), jawab ramah.
    2. Jika pertanyaan butuh FAKTA (Biaya, Prodi, Resep, Cara), KATAKAN TIDAK TAHU. JANGAN MENGARANG.`;
  }
  
  messages.push({ role: 'system', content: systemPrompt });

  if (conversationHistory.length > 0) {
    const recentHistory = conversationHistory.slice(-2); 
    messages.push(...recentHistory.map(msg => ({
      role: msg.role === 'bot' ? 'assistant' : msg.role,
      content: msg.content
    })));
  }

  messages.push({ role: 'user', content: userMessage });
  
  return messages;
}

function extractKeyInformation(context, question) {
  if (!context) return null;
  
  if (context.includes('- ') || context.includes('1. ')) {
    const lines = context.split('\n');
    const relevantLines = lines.filter(line => 
      line.trim().length > 0 && (
        line.includes('- ') || 
        line.match(/^\d+\./) || 
        line.toLowerCase().includes(extractTopic(question))
      )
    );
    
    if (relevantLines.length > 0) {
      let result = context.substring(0, 600);
      const lastDot = result.lastIndexOf('.');
      if (lastDot > 100) result = result.substring(0, lastDot + 1);
      return result + "..";
    }
  }

  const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 20);
  return sentences.slice(0, 3).join('. ') + '.';
}

function validateAndEnhanceResponse(response, context, question, questionType) {
  const lowerRes = response.toLowerCase();
  
  const forbiddenKeywords = ['tumis', 'siapkan bahan', 'panaskan minyak', 'potong-potong', 'sajikan hangat'];
  if (forbiddenKeywords.some(word => lowerRes.includes(word))) {
      console.warn('🚨 [OPENAI] Hallucination Detected (Recipe). Blocking output.');
      return "Afwan Kak, Kia adalah asisten akademik. Kia tidak memiliki kapabilitas untuk memberikan resep masakan atau info di luar topik kampus. Ada yang bisa Kia bantu seputar perkuliahan? 😊";
  }

  const invalidPhrases = [
    'maaf, informasi tidak ditemukan',
    'tidak ada dalam konteks',
    'saya tidak tahu',
    'konteks yang diberikan tidak mencantumkan'
  ];

  const isInvalid = invalidPhrases.some(p => lowerRes.includes(p));
  
  if (context && isInvalid) {
    const keyInfo = extractKeyInformation(context, question);
    if (keyInfo) {
      return `Afwan Kak, berdasarkan data yang Kia miliki:\n\n${keyInfo}\n\n${generateOfferPhrase(extractTopic(question), questionType)}`;
    }
  }

  return response;
}

function getSmartFallback(question, context, options) {
  const { questionType } = options;
  
  if (context) {
    const keyInfo = extractKeyInformation(context, question);
    if (keyInfo) {
      return `Afwan, informasi singkat yang Kia temukan: ${keyInfo}. Silakan tanya lebih detail ya Kak.`;
    }
  }
  
  const fallbacks = FALLBACK_RESPONSES.noContext;
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

function extractTopic(question) {
  const ignore = ['apa', 'saja', 'yang', 'ada', 'di', 'prodi', 'fakultas', 'bagaimana', 'bisa', 'tolong', 'jelaskan', 'kak', 'kia'];
  return question.toLowerCase().split(' ')
    .filter(w => !ignore.includes(w) && w.length > 3)
    .join(' ') || 'topik ini';
}

function generateOfferPhrase(topic, type = 'general') {
  const list = OFFER_TEMPLATES[type] || OFFER_TEMPLATES.general;
  return list[Math.floor(Math.random() * list.length)];
}

function checkContextUsage(response, context) {
  if (!context) return 'none';
  const keyword = context.substring(0, 20).toLowerCase().split(' ')[0]; 
  return response.toLowerCase().includes(keyword) ? 'good' : 'weak';
}

async function testOpenAIConnection() {
  try {
    const res = await chatCompletion([{ role: 'user', content: 'Ping' }]);
    return { success: true, message: res };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  generateAIResponse,
  createEmbedding,
  testOpenAIConnection,
  extractKeyInformation
};