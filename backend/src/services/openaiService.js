const OpenAI = require('openai');
require('dotenv').config();

// ✅ FIX 1: Cek API Key agar tidak error gaib jika .env bermasalah
if (!process.env.OPENAI_API_KEY) {
    console.error("🚨 [FATAL] OPENAI_API_KEY tidak ditemukan di .env!");
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    // ✅ FIX 2: Tambahkan Timeout & Retry agar tahan banting (Koneksi Cafe Friendly)
    timeout: 20000, // 20 Detik
    maxRetries: 2,  // Coba ulang 2x otomatis
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

✍️ **GAYA MENJAWAB:**
1. **Direct Answer:** Jawab inti pertanyaan di kalimat pertama.
2. **Struktur:** - Paragraf 1: Jawaban Inti.
   - List/Poin: Detail (Jika perlu).
   - Penutup: Tawarkan bantuan lain ("Ada lagi yang bisa Kia bantu, Kak?").

☪️ **ADAB:**
- Mulai dengan "Assalamualaikum" jika user memulai percakapan dengan salam.
- Tone: Hangat, Islami, Profesional.
`;

/**
 * Prompt khusus untuk AI Query Refiner (OPTIMIZED SPEED ⚡)
 * Dibuat lebih ringkas agar respon AI di bawah 2 detik & Format JSON Valid.
 */
const SYSTEM_PROMPT_REFINER = `
Role: Search Query Optimizer.
Tugas: Konversi input user menjadi JSON Array keyword untuk pencarian database.

LOGIC:
1. Jika input jelas (misal: "Biaya kuliah"), langsung jadikan keyword.
2. Jika input ambigu (misal: "Dalilnya?", "Lokasinya?"), WAJIB gabungkan dengan topik dari HISTORY CHAT.

CONTOH 1 (Tanpa Konteks):
Input: "stmik tazkia dimana?"
Output: ["alamat lokasi kampus stmik tazkia"]

CONTOH 2 (Dengan Konteks):
History: "Apa itu Musyarakah?"
Input: "ada dalilnya ga?"
Output: ["dalil dasar hukum musyarakah al-quran hadis"]

FORMAT OUTPUT: HANYA JSON Array valid. Jangan ada teks lain.
`;

/**
 * Template Context dengan Instruksi Formatting Ketat
 */
const CONTEXT_INSTRUCTION_TEMPLATE = `
[DATA PENGETAHUAN DARI DATABASE]
{context}

[PERTANYAAN USER]
{query}

[INSTRUKSI PENJAWABAN]
1. Analisa Data di atas.
2. Jawab pertanyaan user dengan gaya "Direct Answer".
3. **FORMATTING:** - Jika data berisi daftar, WAJIB ubah menjadi **Bullet Points**.
   - Jika data adalah Penjelasan Konsep, gunakan **Paragraf Narasi**.
   - TEBALKAN (**Bold**) kata kunci penting.
`;

/**
 * ========================================================================
 * 🛠️ SERVICE METHODS
 * ========================================================================
 */

/**
 * 1. QUERY REFINEMENT (THE BRAIN) 🧠
 * Fitur: Memperbaiki typo & Context Awareness
 */
async function refineQuery(rawQuery, history = []) {
  try {
    // Optimization: Skip untuk query sapaan pendek HANYA JIKA tidak ada history
    if (history.length === 0 && (rawQuery.length < 5 || ["halo", "hi", "pagi", "assalamualaikum", "tes"].some(s => rawQuery.toLowerCase().includes(s)))) {
        return [rawQuery]; 
    }

    const messages = [{ role: 'system', content: SYSTEM_PROMPT_REFINER }];

    // Inject History (2 Chat Terakhir) agar AI paham konteks
    if (history.length > 0) {
         const lastTurn = history.slice(-2);
         messages.push({
             role: 'system',
             content: `HISTORY CHAT TERAKHIR:\n${lastTurn.map(m => `${m.role}: ${m.content}`).join('\n')}`
         });
    }

    messages.push({ role: 'user', content: rawQuery });

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: messages,
      temperature: 0,
      max_tokens: 150,
      response_format: { type: "json_object" } // Force JSON Mode
    });

    const result = completion.choices[0].message.content.trim();
    
    try {
        const parsed = JSON.parse(result);
        // Handle format { "queries": [...] } atau [...]
        const finalArray = Array.isArray(parsed) ? parsed : (parsed.queries || parsed.results || [rawQuery]);
        
        if (finalArray.length > 0) {
            console.log(`🧠 [AI REFINER] "${rawQuery}" -> ${JSON.stringify(finalArray)}`);
            return finalArray;
        }
    } catch (e) {
        console.warn(`⚠️ [AI REFINER] Parse fail, fallback to raw query.`);
    }
    return [rawQuery];

  } catch (error) {
    // Log warning saja, jangan throw error agar sistem tetap jalan pakai raw query
    console.warn('⚠️ [AI REFINER] Fail/Timeout, using raw query:', error.message);
    return [rawQuery];
  }
}

/**
 * 2. EMBEDDING GENERATOR
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
 * 3. RESPONSE GENERATOR (FINAL ANSWER)
 */
async function generateAIResponse(userMessage, conversationHistory = [], customContext = null, options = {}) {
  try {
    const { maxTokens = 600, temperature = 0.3 } = options;

    // --- Safety Checks ---
    if (isIdentityQuestion(userMessage)) {
      return { 
        content: "Assalamualaikum! 👋 Saya **Kia**, asisten virtual Universitas Tazkia. Kia siap bantu Kakak seputar informasi kampus, prodi, dan akademik. Ada yang bisa dibantu? 😊", 
        usage: { total_tokens: 0 } 
      };
    }
    if (isBannedTopicQuestion(userMessage)) {
      return { 
        content: "Mohon maaf Kak, Kia hanya fokus menjawab seputar informasi **Akademik & Kampus Tazkia** ya. 🙏 Silakan tanya tentang pendaftaran, biaya, atau prodi.", 
        usage: { total_tokens: 0 } 
      };
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
    });

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
function isIdentityQuestion(text) {
  const t = text.toLowerCase();
  return ["siapa kamu", "kamu siapa", "admin", "robot", "human", "manusia"].some(k => t.includes(k));
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
  refineQuery,
  testOpenAIConnection,
  generateTitle 
};