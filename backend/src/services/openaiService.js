const OpenAI = require('openai');

// --- Load Environment Variables ---
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * ✅ SYSTEM PROMPT UPDATED: Mendukung format List/Bullet Points
 */
const OPTIMIZED_SYSTEM_PROMPT = `Anda adalah "Kia" - Asisten Virtual Universitas Tazkia.

📚 **ATURAN UTAMA:**
1. **SUMBER:** Jawab HANYA berdasarkan KONTEKS yang diberikan.
2. **FORMAT LIST:** Jika menyebutkan Program Studi, Syarat, atau Langkah-langkah, GUNAKAN BULLET POINTS.
3. **KETIDAKTAHUAN:** Jika info tidak ada di konteks, arahkan ke Admin (0821-84-800-600).
4. **GAYA BAHASA:** Indonesia formal namun ramah, informatif, dan to-the-point.

💡 **STRUKTUR JAWABAN:**
- Pendahuluan singkat (1 kalimat).
- Isi utama (gunakan poin-poin jika berupa daftar).
- Penutup/Tawaran bantuan.`;

/**
 * ✅ CONTEXT PROMPTS
 */
const CONTEXT_ENFORCEMENT_PROMPTS = {
  syariah: `KONTEKS SYARIAH DITEMUKAN:
{context}
**INSTRUKSI:** Jelaskan fatwa/prinsip berdasarkan teks di atas.`,

  general: `INFORMASI DITEMUKAN:
{context}
**INSTRUKSI:** Jawab pertanyaan user menggunakan fakta di atas.`,
  
  program: `DATA PROGRAM STUDI DITEMUKAN:
{context}
**INSTRUKSI:** Sebutkan daftar Program Studi atau detail kurikulum secara lengkap menggunakan Bullet Points.`,
};

/**
 * TEMPLATE PENAWARAN
 */
const OFFER_TEMPLATES = {
  program: [
    "Ingin tahu prospek karir lulusannya?",
    "Mau rincian biaya kuliahnya?",
    "Perlu info syarat pendaftarannya?"
  ],
  general: [
    "Ada lagi yang bisa Kia bantu?",
    "Butuh info pendaftaran?",
    "Ingin tersambung ke admin?"
  ]
};

/**
 * FALLBACK RESPONSES
 */
const FALLBACK_RESPONSES = {
  withContext: [
    "Berdasarkan data kami: {keyInfo}",
    "Dari informasi yang tersedia: {keyInfo}"
  ],
  noContext: [
    "Mohon maaf, detail tersebut belum tersedia di database Kia. Silakan hubungi Admin di 0821-84-800-600.",
    "Kia belum menemukan info spesifiknya. Boleh dibantu Admin kami di 0821-84-800-600 ya kak."
  ]
};

/**
 * 1. Generate Embedding
 */
async function createEmbedding(text) {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');

    // Bersihkan teks tapi pertahankan spasi penting
    const cleanText = text.replace(/\s+/g, " ").trim();
    
    console.log(`🧬 [OPENAI] Creating embedding (${cleanText.length} chars)...`);
    
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

/**
 * 2. Chat Completion (Helper for raw calls)
 */
async function chatCompletion(messages, options = {}) {
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: messages,
      max_tokens: options.maxTokens || 500,
      temperature: options.temperature || 0.1
    });
    
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ [OPENAI] Completion Error:', error);
    throw error;
  }
}

/**
 * ✅ PERBAIKAN UTAMA: Generate AI Response
 */
async function generateAIResponse(userMessage, conversationHistory = [], customContext = null, options = {}) {
  try {
    const {
      maxTokens = 1000, 
      temperature = 0.2, 
      userType = 'general',
      questionType = 'general',
      forceContextUsage = false
    } = options;

    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    console.log(`🤖 [OPENAI] Generating response for "${questionType}"...`);

    // Build Messages
    const messages = buildContextEnforcementMessages(
      userMessage, 
      conversationHistory, 
      customContext, 
      userType,
      questionType,
      forceContextUsage
    );

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
      presence_penalty: 0.2,
    });

    let aiReply = completion.choices[0].message.content.trim();

    // Validasi Output
    aiReply = validateAndEnhanceResponse(aiReply, customContext, userMessage, questionType);
    
    // ✅ PERBAIKAN LOGGING: Menampilkan Token Usage
    console.log('✅ [OPENAI] Response generated:', {
      model: modelName,
      totalTokens: completion.usage?.total_tokens || 0,
      promptTokens: completion.usage?.prompt_tokens || 0, // Token input (User + Context)
      completionTokens: completion.usage?.completion_tokens || 0, // Token output (Jawaban AI)
      length: aiReply.length,
      contextUsed: checkContextUsage(aiReply, customContext)
    });

    return aiReply;

  } catch (error) {
    console.error('❌ [OPENAI] Generation failed:', error);
    return getSmartFallback(userMessage, customContext, { questionType });
  }
}

/**
 * Helper: Build Messages
 */
function buildContextEnforcementMessages(userMessage, conversationHistory, customContext, userType, questionType, forceContextUsage) {
  const messages = [];
  
  let systemPrompt = OPTIMIZED_SYSTEM_PROMPT;
  
  if (customContext) {
    const contextTemplate = CONTEXT_ENFORCEMENT_PROMPTS[questionType] || CONTEXT_ENFORCEMENT_PROMPTS.general;
    systemPrompt = contextTemplate.replace('{context}', customContext);
    
    if (forceContextUsage) {
      systemPrompt += `\n\n⚠️ **PENTING:** Gunakan data di atas! Jangan mengarang bebas.`;
    }
  } else {
    systemPrompt += `\n\n⚠️ **INFO:** Konteks tidak ditemukan. Gunakan pengetahuan umum terbatas atau arahkan ke Admin.`;
  }
  
  messages.push({ role: 'system', content: systemPrompt });

  // History (batasi 2 terakhir agar hemat token dan tetap fokus)
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

/**
 * ✅ PERBAIKAN: Extract Key Info yang menghormati format List/Markdown
 */
function extractKeyInformation(context, question) {
  if (!context) return null;
  
  // Jika konteks mengandung list (bullet points), ambil blok tersebut
  if (context.includes('- ') || context.includes('1. ')) {
    const lines = context.split('\n');
    const relevantLines = lines.filter(line => 
      line.trim().length > 0 && (
        line.includes('- ') || 
        line.match(/^\d+\./) || 
        line.toLowerCase().includes(extractTopic(question))
      )
    );
    
    // Jika menemukan struktur list, kembalikan chunk yang lebih besar
    if (relevantLines.length > 0) {
      // Ambil 600 karakter pertama dari konteks yang relevan untuk menjaga struktur
      return context.substring(0, 600) + "..."; 
    }
  }

  // Fallback ke logika kalimat jika bukan list
  const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 20);
  return sentences.slice(0, 3).join('. ') + '.';
}

/**
 * Validate Response
 */
function validateAndEnhanceResponse(response, context, question, questionType) {
  const lowerRes = response.toLowerCase();
  
  // Cek response "Malas" atau "Menyerah"
  const invalidPhrases = [
    'maaf, informasi tidak ditemukan',
    'tidak ada dalam konteks',
    'saya tidak tahu'
  ];

  const isInvalid = invalidPhrases.some(p => lowerRes.includes(p));
  
  // Jika punya konteks tapi AI bilang tidak tahu -> Paksa ekstrak manual
  if (context && isInvalid) {
    console.log('⚠️ [OPENAI] AI menolak menjawab padahal ada konteks. Melakukan override...');
    const keyInfo = extractKeyInformation(context, question);
    if (keyInfo) {
      return `Berdasarkan data yang ada, berikut informasinya:\n\n${keyInfo}\n\n${generateOfferPhrase(extractTopic(question), questionType)}`;
    }
  }

  return response;
}

/**
 * Smart Fallback
 */
function getSmartFallback(question, context, options) {
  const { questionType } = options;
  
  if (context) {
    const keyInfo = extractKeyInformation(context, question);
    if (keyInfo) {
      return `Informasi singkat yang ditemukan: ${keyInfo}. Silakan tanya lebih detail.`;
    }
  }
  
  return FALLBACK_RESPONSES.noContext[0];
}

/**
 * Utils
 */
function extractTopic(question) {
  const ignore = ['apa', 'saja', 'yang', 'ada', 'di', 'prodi', 'fakultas'];
  return question.toLowerCase().split(' ')
    .filter(w => !ignore.includes(w) && w.length > 3)
    .join(' ') || 'topik ini';
}

function generateOfferPhrase(topic, type = 'general') {
  const list = OFFER_TEMPLATES[type] || OFFER_TEMPLATES.general;
  return list[Math.floor(Math.random() * list.length)];
}

function hasOfferPhrase(text) {
  return text.includes('?') && (text.includes('Ingin') || text.includes('Mau'));
}

function checkContextUsage(response, context) {
  if (!context) return 'none';
  const keyword = context.split(' ')[0].substring(0, 5).toLowerCase();
  return response.toLowerCase().includes(keyword) ? 'good' : 'weak';
}

// --- Testing Functions (Simplified) ---

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