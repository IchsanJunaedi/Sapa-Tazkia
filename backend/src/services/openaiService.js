const OpenAI = require('openai');
require('dotenv').config();

// ✅ FIX 1: Cek API Key agar tidak error gaib jika .env bermasalah
if (!process.env.OPENAI_API_KEY) {
  console.error("🚨 [FATAL] OPENAI_API_KEY tidak ditemukan di .env!");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 Detik (Lebih tahan untuk long context)
  maxRetries: 2,
});

const MODEL_NAME = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * ========================================================================
 * 🧠 1. SYSTEM PROMPT (PERSONA + SMART FORMATTER)
 * ========================================================================
 */
const SYSTEM_PROMPT_PERSONA = `
🎯 **PERAN ANDA:**
Anda adalah "Kia", Asisten Akademik Virtual Universitas Tazkia yang cerdas, hangat, dan profesional.
Tugas Anda adalah melayani Mahasiswa/Calon Mahasiswa dengan informasi yang **Akurat, Ringkas, dan Solutif**.

⛔ **BATASAN KERAS (STRICT RULES):**
1. **Scope:** HANYA jawab pertanyaan seputar Akademik, Kampus Tazkia, dan Islam/Ekonomi Syariah.
2. **Context-Driven:** Jawab HANYA berdasarkan [CONTEXT]. Jika data tidak ada, katakan jujur "Mohon maaf, data spesifik belum tersedia", jangan mengarang (halusinasi).

📏 **ATURAN PANJANG JAWABAN (TOKEN EFFICIENCY):**
- Jawaban maksimal **4 poin list** ATAU **2 paragraf pendek**.
- Jika pertanyaan membutuhkan daftar (lokasi, biaya, prodi), gunakan format list bernomor yang ringkas — satu baris per item.
- **DILARANG** menambah kalimat basa-basi panjang di tengah jawaban.
- Penutup cukup satu kalimat singkat (misal: *"Ada pertanyaan lain, Kak?"*).
- **Target:** Jawaban lengkap dan akurat dalam 150–300 token output.

🎨 **ATURAN FORMATTING (VISUAL GUIDE):**
Agar jawaban mudah dibaca, ikuti aturan ini:
1. **BOLD (PENEKANAN):** Wajib gunakan **Bold** (\`**Teks**\`) untuk entitas penting:
   - **Nama Lokasi** (e.g., **Sentul**, **Dramaga**)
   - **Nama Prodi** (e.g., **Akuntansi Syariah**, **Teknik Informatika**)
   - **Nominal Biaya** (e.g., **Rp 5.000.000**)
   - **Tanggal/Deadline**.
2. **LIST / BULLET POINTS:** Gunakan format list (\`- Item\`) HANYA JIKA menjelaskan:
   - Daftar Prodi/Jurusan.
   - Daftar Alamat/Lokasi Kampus.
   - Rincian Biaya/Syarat.
   - Langkah-langkah.
3. **NARASI:** Gunakan paragraf biasa untuk:
   - Definisi konsep (misal: "Apa itu Murabahah?").
   - Sapaan awal dan penutup. 
4. **LINK / URL:** Wajib gunakan format Markdown:
   - Format: \`[Nama Website/Halaman](URL)\` (Contoh: \`[Website Tazkia](https://tazkia.ac.id)\`).
   - **PENTING:** Berikan Jeda (Spasi atau Newline) antar link agar tidak menempel.

✍️ **GAYA MENJAWAB:**
1. **Direct Answer:** Jawab inti pertanyaan di kalimat pertama.
2. **Struktur:** Jawaban Inti → Detail/List (jika perlu) → Penutup singkat 1 kalimat.

☪️ **ADAB:**
- Mulai dengan "Assalamualaikum" jika user memulai percakapan dengan salam.
- Tone: Hangat, Islami, Profesional.
`;


// ✅ UPGRADE: Template lebih ringkas — hemat input token, enforce jawaban padat
const CONTEXT_INSTRUCTION_TEMPLATE = `
[CONTEXT]
{context}

[PERTANYAAN]: {query}

Instruksi: Gunakan HANYA data dari [CONTEXT] di atas. Jawab akurat, terstruktur, dan ringkas (maks 4 poin atau 2 paragraf). Ikuti persona Kia.
`;

/**
 * ========================================================================
 * 🛠️ SERVICE METHODS
 * ========================================================================
 */

/**
 * 1. EMBEDDING GENERATOR
 */
async function createEmbedding(text) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  return withRetry(async () => {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
    });
    return response.data[0].embedding;
  });
}

/**
 * 2. MOCK STREAM GENERATOR (FOR STATIC REPLIES)
 */
async function* createMockStream(content) {
  // Yield content chunk
  yield {
    choices: [{ delta: { content: content } }],
    usage: null
  };

  // Yield final usage chunk
  yield {
    choices: [],
    usage: { total_tokens: Math.ceil(content.length / 4) } // Estimate tokens
  };
}

/**
 * 3. RESPONSE GENERATOR (FINAL ANSWER)
 */
async function generateAIResponse(userMessage, conversationHistory = [], customContext = null, options = {}) {
  try {
    // ✅ UPGRADE: maxTokens default diturunkan 600 → 450.
    // Target: jawaban lengkap + akurat dalam 150-300 token output (seperti contoh user).
    // 450 memberi cukup ruang untuk jawaban detail (lokasi, biaya, daftar prodi) tanpa membengkak.
    const { maxTokens = 450, temperature = 0.3 } = options;

    // --- Safety Checks ---
    const handleStaticResponse = (reply) => {
      if (options.stream) return createMockStream(reply);
      return {
        content: reply,
        usage: { total_tokens: Math.ceil(reply.length / 4) }
      };
    };

    if (isIdentityQuestion(userMessage)) {
      return handleStaticResponse("Assalamualaikum! 👋 Saya **Kia**, asisten virtual Universitas Tazkia. Kia siap bantu Kakak seputar informasi kampus, prodi, dan akademik. Ada yang bisa dibantu? 😊");
    }

    // --- Greeting Handler (NEW) ---
    if (isGreeting(userMessage)) {
      const lower = userMessage.toLowerCase();
      // Special response for Islamic greeting
      if (lower.includes('assalamualaikum') || lower.includes('assalamu')) {
        return handleStaticResponse("Waalaikumussalam! 👋 Halo Kak, selamat datang di layanan Sapa Tazkia. Ada yang bisa Kia bantu hari ini seputar informasi kampus, prodi, atau akademik? 😊");
      }
      return handleStaticResponse("Halo Kak! 👋 Selamat datang di layanan Sapa Tazkia. Kia siap bantu Kakak seputar informasi kampus, pendaftaran, dan akademik. Ada yang bisa dibantu? 😊");
    }

    if (isBannedTopicQuestion(userMessage)) {
      return handleStaticResponse("Mohon maaf Kak, Kia hanya fokus menjawab seputar informasi **Akademik & Kampus Tazkia** ya. 🙏 Silakan tanya tentang pendaftaran, biaya, atau prodi.");
    }

    // --- Construct Messages ---
    const messages = [{ role: 'system', content: SYSTEM_PROMPT_PERSONA }];

    if (conversationHistory.length > 0) {
      messages.push(...conversationHistory.slice(-4).map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : msg.role,
        content: msg.content
      })));
    }

    // Context Injection Logic
    let finalUserPrompt = userMessage;

    if (customContext && customContext.trim().length > 0) {
      finalUserPrompt = CONTEXT_INSTRUCTION_TEMPLATE
        .replace('{context}', customContext)
        .replace('{query}', userMessage);
    } else {
      finalUserPrompt = `[DATA TIDAK DITEMUKAN]\nUser bertanya: "${userMessage}"\nInstruksi: Jawab dengan sopan bahwa informasi detail belum tersedia di database Kia, dan sarankan user menghubungi Admin atau Website resmi Tazkia.`;
    }

    messages.push({ role: 'user', content: finalUserPrompt });

    // --- Call LLM ---
    if (options.stream) {
      const completion = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        presence_penalty: 0.1,
        stream: true,
      }, { signal: options.abortSignal });
      return completion;
    }

    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model: MODEL_NAME,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        presence_penalty: 0.1,
        stream: false,
      }, { signal: options.abortSignal })
    );

    const reply = completion.choices[0].message.content.trim();
    const usage = completion.usage || { total_tokens: 0 };

    console.log(`🤖 [AI GEN] Answer Generated. Tokens: ${usage.total_tokens}`);
    return { content: reply, usage };

  } catch (error) {
    console.error('❌ [OPENAI] Gen Answer Error:', error.message);
    return {
      content: "Mohon maaf, koneksi Kia ke server sedang tidak stabil. Silakan coba sesaat lagi ya Kak. 🙏",
      usage: {}
    };
  }
}

/**
 * 4. TITLE GENERATOR (SMART TITLE) 🏷️
 * ✅ UPDATED: Lebih deterministik, anti-quote, dan support context jawaban AI.
 */
async function generateTitle(userMessage, aiResponse = null) {
  try {
    // 1. Validasi input kosong (tetap pertahankan ini)
    if (!userMessage || userMessage.trim() === "") return "Percakapan Baru";

    // 2. Jika pesan sangat pendek (< 3 huruf), baru gunakan default
    if (userMessage.length < 3) return "Percakapan Baru";

    const messages = [
      {
        role: 'system',
        content: `Anda adalah Title Generator. 
          Tugas: Buat judul singkat (2-5 kata) yang menggambarkan INTI pertanyaan user.
          
          ATURAN KERAS:
          1. JANGAN gunakan tanda kutip.
          2. JANGAN pakai kata "Tentang" atau "Mengenai". Langsung ke topik.
          3. Jika user bertanya lokasi (misal: "dimana"), judul harus mengandung nama lokasi/tempat.
          4. HANYA jika user murni menyapa (misal: "Assalamualaikum", "Halo", "Pagi"), output: "Percakapan Baru".
          5. Prioritaskan isi pertanyaan user daripada jawaban AI.`
      },
      {
        role: 'user',
        content: `User: "${userMessage}"`
      }
    ];

    // Inject konteks jawaban AI (opsional tapi membantu)
    if (aiResponse) {
      // Kita potong biar hemat token, ambil intinya saja
      const cleanAiResponse = aiResponse.substring(0, 100).replace(/\n/g, " ");
      messages[1].content += `\nKonteks Jawaban AI: "${cleanAiResponse}"`;
    }

    messages[1].content += `\nJudul:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 15,
      temperature: 0.3      // Naikkan sedikit biar lebih kreatif menangkap maksud
    });

    let title = completion.choices[0].message.content.trim();

    // Sanitasi akhir: Hapus tanda kutip & titik di akhir
    title = title.replace(/^["']|["']$/g, '').replace(/\.$/, '');

    // Fallback terakhir jika AI masih bandel output kosong
    if (title.length < 3) return "Percakapan Baru";

    return title;

  } catch (error) {
    console.warn("⚠️ [TITLE GEN] Error, fallback manual:", error.message);
    // Fallback manual: Ambil 4 kata pertama user
    return userMessage.split(' ').slice(0, 4).join(' ');
  }
}

// --- Utils (Safety Filters) ---
function isGreeting(text) {
  const t = text.toLowerCase().trim();

  // ✅ FIX: Threshold 12 karakter — cukup untuk memisahkan salam murni ("halo", "hai kak")
  // dari compound query ("halo, dimana tazkia" = 19 char → RAG).
  // "halo" = 4 ✓ salam | "halo kak" = 8 ✓ salam | "halo, dimana tazkia" = 19 → RAG
  if (t.length > 12) return false;

  const greetings = [
    'halo', 'hai', 'hi', 'hello', 'hey',
    'assalamualaikum', 'assalamu alaikum', 'assalamualaikum wr wb',
    'pagi', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam',
    'good morning', 'good afternoon', 'good evening',
    'permisi', 'punten', 'tes', 'test'
  ];
  // Check exact match or starts with greeting word followed by space/punctuation
  return greetings.some(g => t === g || t.startsWith(g + ' ') || t.startsWith(g + ',') || t.startsWith(g + '.'));
}

function isIdentityQuestion(text) {
  const t = text.toLowerCase();
  // Removed "human" and "manusia" to avoid false positives (e.g., "humaniora")
  // Only target direct identity questions
  return ["siapa kamu", "kamu siapa", "apakah kamu robot", "apakah anda robot", "admin siapa"].some(k => t.includes(k));
}

function isBannedTopicQuestion(text) {
  const t = text.toLowerCase();
  return ["resep", "masak", "politik", "presiden", "partai", "judi", "slot"].some(k => t.includes(k));
}

const RETRIABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Retry wrapper with exponential backoff.
 * @param {Function} fn - async function to retry
 * @param {number} maxAttempts - total attempts (default 3)
 * @param {number} baseDelayMs - base delay in ms (default 1000, set 0 in tests)
 */
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetriable =
        (error.status && RETRIABLE_STATUS.has(error.status)) ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET';

      if (!isRetriable || attempt === maxAttempts) throw error;

      const delay = Math.pow(2, attempt - 1) * baseDelayMs;
      console.warn(`⚠️ [OPENAI] Retry ${attempt}/${maxAttempts} after ${delay}ms — ${error.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function testOpenAIConnection() {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: 'user', content: 'Tes koneksi' }],
      max_tokens: 5
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

module.exports = {
  generateAIResponse,
  createEmbedding,
  testOpenAIConnection,
  generateTitle,
  isGreeting,
  withRetry,
};