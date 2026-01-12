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
2. **Struktur:** - Paragraf 1: Jawaban Inti.
   - List/Poin: Detail & Link Resmi (Jika perlu).
   - Penutup: Tawarkan bantuan lain ("Ada lagi yang bisa Kia bantu, Kak?").

☪️ **ADAB:**
- Mulai dengan "Assalamualaikum" jika user memulai percakapan dengan salam.
- Tone: Hangat, Islami, Profesional.
`;


/**
 * Template Context dengan Instruksi Ringkas (Hemat Token)
 */
const CONTEXT_INSTRUCTION_TEMPLATE = `
[CONTEXT]
{context}

[USER QUERY]
{query}

Instruksi: Jawab berdasarkan context di atas. Ikuti persona Kia. Gunakan format yang efisien.
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
  try {
    const cleanText = text.replace(/\s+/g, " ").trim();
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ [OPENAI] Embed Error:', error.message);
    throw error; // Throw error agar RAG tau koneksi putus
  }
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
    const { maxTokens = 600, temperature = 0.3 } = options;

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
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
      presence_penalty: 0.1,
      stream: options.stream || false, // ✅ Support Streaming
    }, { signal: options.abortSignal });

    if (options.stream) return completion;

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
  isGreeting
};