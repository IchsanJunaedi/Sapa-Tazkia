const OpenAI = require('openai');

// --- Load Environment Variables ---
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * ========================================================================
 * 🧠 INTELLIGENT PERSONA CONFIGURATION (KIA V2.0)
 * ========================================================================
 * * Filosofi Baru: "Direct Answer First"
 * Kia tidak lagi menjawab seperti SOP (1, 2, 3), tapi seperti CS Manusia.
 * Ia memberikan inti jawaban di paragraf pertama, baru detail jika perlu.
 */

const SYSTEM_PROMPT = `
🎯 **PERAN ANDA:**
Anda adalah "Kia", Asisten Akademik Virtual Universitas Tazkia yang cerdas, hangat, dan profesional.
Tugas Anda adalah melayani Mahasiswa/Calon Mahasiswa dengan informasi yang **Akurat, Ringkas, dan Solutif**.

⛔ **BATASAN KERAS (STRICT RULES):**
1. **Scope:** HANYA jawab pertanyaan seputar Akademik, Kampus Tazkia, dan Islam/Ekonomi Syariah.
2. **Out of Scope:** TOLAK pertanyaan tentang Resep Masakan, Selebriti, Politik, atau Tugas Sekolah Umum (Matematika/Fisika dasar).
3. **Anti-Hallucination:** Jawab HANYA berdasarkan data di **[CONTEXT]**. Jika data tidak ada, katakan jujur "Data belum tersedia", jangan mengarang.

✍️ **GAYA MENJAWAB (STYLE GUIDE):**
1. **DIRECT ANSWER (PENTING):** Jangan basa-basi ("Berikut adalah jawabannya..."). Langsung jawab intinya di kalimat pertama.
   - *Salah:* "Mekanisme murabahah adalah sebagai berikut: 1. Bank membeli..."
   - *Benar:* "Dalam akad Murabahah, Bank menjual barang ke nasabah dengan harga beli ditambah margin keuntungan yang disepakati secara transparan."
2. **STRUKTUR:**
   - **Paragraf 1:** Kesimpulan/Jawaban Inti (2-3 kalimat).
   - **Paragraf 2 (Opsional):** Poin-poin detail/syarat HANYA JIKA diminta atau sangat teknis.
3. **TONE:** Hangat, Islami, namun tetap Profesional. Gunakan "Kak" untuk menyapa user.

☪️ **ADAB:**
- Mulai dengan "Assalamualaikum" jika user memulai percakapan (sesi awal).
- Tutup dengan tawaran bantuan lain atau doa singkat ("Semoga membantu ya, Kak!").
`;

const CONTEXT_INSTRUCTION = `
[DATA PENGETAHUAN - SUMBER KEBENARAN]
{context}

[PERTANYAAN USER]
{query}

[INSTRUKSI KHUSUS]
- Analisa data di atas.
- Jawab pertanyaan user dengan gaya "Direct Answer" sesuai Style Guide.
- Jika data berupa JSON/Poin, rangkai menjadi kalimat yang mengalir (narasi), jangan cuma copy-paste list.
`;

/**
 * ========================================================================
 * 🛠️ SERVICE METHODS
 * ========================================================================
 */

/**
 * Mendeteksi pertanyaan identitas untuk bypass RAG
 */
function isIdentityQuestion(text) {
  if (!text) return false;
  const q = text.toLowerCase();
  const patterns = [
    "kamu siapa", "siapa kamu", "kia siapa", "kenalan",
    "siapa namamu", "robot apa ini", "admin siapa"
  ];
  return patterns.some(p => q.includes(p));
}

/**
 * Filter topik terlarang dengan cepat
 */
function isBannedTopicQuestion(text) {
  if (!text) return false;
  const q = text.toLowerCase();
  // Keyword yang sangat spesifik untuk trigger rejection
  const banned = [
    "resep", "cara masak", "bumbu", "tumis", "goreng", 
    "film terbaru", "gosip", "presiden", "partai",
    "hitung luas", "akar pangkat", "ibu kota negara"
  ];
  return banned.some(b => q.includes(b));
}

async function createEmbedding(text) {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
    // Normalisasi spasi agar hemat token & akurat
    const cleanText = text.replace(/\s+/g, " ").trim();
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ [OPENAI] Error creating embedding:', error.message);
    throw error;
  }
}

/**
 * Fungsi Utama Generator Jawaban
 */
async function generateAIResponse(userMessage, conversationHistory = [], customContext = null, options = {}) {
  try {
    const {
      maxTokens = 400, // Jawaban ringkas tidak butuh token banyak
      temperature = 0.3, // Sedikit kreatif untuk merangkai kata, tapi tetap faktual
    } = options;

    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // 1. Cek Identitas (Fast Response)
    if (isIdentityQuestion(userMessage)) {
      return { 
        content: "Assalamualaikum! 👋 Saya Kia, asisten virtual Universitas Tazkia. Kia siap bantu Kakak seputar informasi kampus, prodi, dan akademik. Ada yang bisa dibantu? 😊", 
        usage: { total_tokens: 0 } 
      };
    }

    // 2. Cek Topik Terlarang (Fast Rejection)
    if (isBannedTopicQuestion(userMessage)) {
      return {
        content: "Afwan Kak, Kia fokus membantu informasi seputar Universitas Tazkia dan Akademik saja. Untuk topik di luar itu, Kia belum bisa bantu ya. 🙏 Ada pertanyaan soal kampus?",
        usage: { total_tokens: 0 }
      };
    }

    // 3. Susun Messages untuk OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Masukkan History (Context Window) - Batasi 2 turn terakhir agar fokus
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-2);
      messages.push(...recentHistory.map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : msg.role,
        content: msg.content
      })));
    }

    // Masukkan Context RAG & Query Saat ini
    let finalUserPrompt = userMessage;
    if (customContext) {
        // Inject context ke dalam prompt user atau system message khusus
        finalUserPrompt = CONTEXT_INSTRUCTION
            .replace('{context}', customContext)
            .replace('{query}', userMessage);
    } else {
        // Fallback jika context kosong (misal RAG gagal)
        finalUserPrompt = `[DATA KOSONG] Tidak ada info database.\n[PERTANYAAN] ${userMessage}\n\nINSTRUKSI: Jawab sopan bahwa data spesifik belum ditemukan. Sarankan hubungi Admin.`;
    }

    messages.push({ role: 'user', content: finalUserPrompt });

    // 4. Call OpenAI
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
      presence_penalty: 0.1, // Mencegah pengulangan kata
      frequency_penalty: 0.1,
    });

    let aiReply = completion.choices[0].message.content.trim();

    // 5. Validasi Akhir (Safety Net untuk Halusinasi Resep/Code)
    if (aiReply.includes("panaskan minyak") || aiReply.includes("potong dadu")) {
        aiReply = "Afwan, sepertinya ada kesalahan teknis. Kia hanya bisa menjawab seputar akademik Tazkia. Silakan tanya hal lain ya Kak! 🙏";
    }

    // Logging Usage (Penting untuk monitoring biaya)
    const usage = completion.usage || { total_tokens: 0 };
    console.log(`🤖 [AI GEN] Tokens: ${usage.total_tokens} | Model: ${modelName}`);

    return { content: aiReply, usage };

  } catch (error) {
    console.error('❌ [OPENAI] Generation failed:', error);
    return {
      content: "Mohon maaf Kak, sistem Kia sedang sibuk. Boleh diulang pertanyaannya? Atau hubungi Admin kami di 0821-84-800-600. 🙏",
      usage: { total_tokens: 0 }
    };
  }
}

async function testOpenAIConnection() {
  try {
    const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: 'user', content: 'Say connected' }],
        max_tokens: 10
    });
    return { success: true, message: res.choices[0].message.content };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  generateAIResponse,
  createEmbedding,
  testOpenAIConnection
};