const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL_NAME = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/**
 * ========================================================================
 * 🧠 1. SYSTEM PROMPT (PERSONA + SMART FORMATTER)
 * ========================================================================
 * Update: Instruksi Visual (Bold & List) sudah ditanam di sini.
 */
const SYSTEM_PROMPT_PERSONA = `
🎯 **PERAN ANDA:**
Anda adalah "Kia", Asisten Akademik Virtual Universitas Tazkia yang cerdas, hangat, dan profesional.
Tugas Anda adalah melayani Mahasiswa/Calon Mahasiswa dengan informasi yang **Akurat, Ringkas, dan Solutif**.

⛔ **BATASAN KERAS (STRICT RULES):**
1. **Scope:** HANYA jawab pertanyaan seputar Akademik, Kampus Tazkia, dan Islam/Ekonomi Syariah.
2. **Context-Driven:** Jawab HANYA berdasarkan [CONTEXT]. Jika data tidak ada, katakan jujur "Data belum tersedia", jangan mengarang.

🎨 **ATURAN FORMATTING (VISUAL GUIDE):**
Agar jawaban mudah dibaca, ikuti aturan ini:
1. **BOLD (PENEKANAN):** Wajib gunakan **Bold** (\`**Teks**\`) untuk entitas penting:
   - **Nama Lokasi** (e.g., **Sentul**, **Dramaga**)
   - **Nama Prodi** (e.g., **Akuntansi Syariah**, **Teknik Informatika**)
   - **Nominal Biaya** (e.g., **Rp 5.000.000**)
   - **Tanggal/Deadline**.
2. **LIST / BULLET POINTS:** Gunakan format list (\`- Item\`) HANYA JIKA menjelaskan:
   - Daftar Prodi/Jurusan.
   - Daftar Alamat/Lokasi Kampus (Jika lebih dari 1).
   - Rincian Biaya/Syarat.
   - Langkah-langkah.
   - Fasilitas Kampus
3. **NARASI:** Gunakan paragraf biasa untuk:
   - Definisi konsep (misal: "Apa itu Murabahah?").
   - Sapaan awal dan penutup. 

✍️ **GAYA MENJAWAB:**
1. **Direct Answer:** Jawab inti pertanyaan di kalimat pertama.
2. **Struktur:** - Paragraf 1: Jawaban Inti.
   - List/Poin: Detail (Jika perlu).
   - Penutup: Tawarkan bantuan lain ("Ada lagi yang bisa Kia bantu, Kak?").

☪️ **ADAB:**
- Mulai dengan "Assalamualaikum" jika user memulai percakapan.
- Tone: Hangat, Islami, Profesional.
`;

/**
 * Prompt khusus untuk AI Query Refiner (JANGAN DIHAPUS - INI FITUR CANGGIHNYA)
 */
const SYSTEM_PROMPT_REFINER = `
Anda adalah AI Query Optimizer.
Tugas: Ubah input user yang kotor/typo menjadi JSON Array kalimat baku untuk Vector Search.

CONTOH:
Input: "stmik taozkia dimana? prodinya apa aja?"
Output: ["alamat lokasi kampus stmik tazkia", "daftar program studi jurusan stmik tazkia"]

ATURAN:
- HANYA KIRIMKAN JSON ARRAY.
- JANGAN berikan penjelasan apapun.
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
3. **FORMATTING:** - Jika data berisi daftar (Lokasi/Prodi), WAJIB ubah menjadi **Bullet Points**.
   - Jika data adalah Penjelasan Konsep (Definisi), gunakan **Paragraf Narasi**.
   - TEBALKAN (**Bold**) kata kunci penting seperti Lokasi, Harga, dan Nama Prodi.
`;

/**
 * ========================================================================
 * 🛠️ SERVICE METHODS
 * ========================================================================
 */

/**
 * 1. QUERY REFINEMENT (THE BRAIN) 🧠
 * Fitur: Memperbaiki typo & memecah query.
 */
async function refineQuery(rawQuery) {
  try {
    if (rawQuery.length < 5 || ["halo", "hi", "pagi", "assalamualaikum"].some(s => rawQuery.toLowerCase().includes(s))) {
        return [rawQuery]; 
    }

    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_REFINER },
        { role: 'user', content: rawQuery }
      ],
      temperature: 0,
      max_tokens: 150,
    });

    const result = completion.choices[0].message.content.trim();
    
    try {
        const cleanJson = result.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`🧠 [AI REFINER] "${rawQuery}" -> ${JSON.stringify(parsed)}`);
            return parsed;
        }
    } catch (e) {
        console.warn(`⚠️ [AI REFINER] Parse fail, fallback to raw query.`);
    }
    return [rawQuery];

  } catch (error) {
    console.error('❌ [AI REFINER] Error:', error.message);
    return [rawQuery];
  }
}

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
    throw error;
  }
}

/**
 * 2. RESPONSE GENERATOR (FINAL ANSWER)
 * Logic: Persona + Formatting + Context
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
        content: "Mohon maaf Kak, Kia hanya fokus menjawab seputar informasi **Akademik & Kampus Tazkia** ya. 🙏", 
        usage: { total_tokens: 0 } 
      };
    }

    // --- Construct Messages ---
    const messages = [{ role: 'system', content: SYSTEM_PROMPT_PERSONA }];

    // History (2 Chat Terakhir)
    if (conversationHistory.length > 0) {
      messages.push(...conversationHistory.slice(-2).map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : msg.role,
        content: msg.content
      })));
    }

    // Context Injection
    let finalUserPrompt = userMessage;
    if (customContext) {
      finalUserPrompt = CONTEXT_INSTRUCTION_TEMPLATE
        .replace('{context}', customContext)
        .replace('{query}', userMessage);
    } else {
      finalUserPrompt = `[DATA TIDAK DITEMUKAN]\nUser bertanya: "${userMessage}"\nJawab dengan sopan bahwa informasi detail belum tersedia, sarankan hubungi Admin.`;
    }

    messages.push({ role: 'user', content: finalUserPrompt });

    // --- Call LLM ---
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
      presence_penalty: 0.1, // Mencegah kata berulang
    });

    const reply = completion.choices[0].message.content.trim();
    const usage = completion.usage || { total_tokens: 0 };

    console.log(`🤖 [AI GEN] Answer Generated. Tokens: ${usage.total_tokens}`);
    return { content: reply, usage };

  } catch (error) {
    console.error('❌ [OPENAI] Gen Answer Error:', error.message);
    return { 
      content: "Mohon maaf sistem sedang sibuk, silakan coba sesaat lagi atau hubungi **Admin**.", 
      usage: {} 
    };
  }
}

// --- Utils (Safety Filters) ---
function isIdentityQuestion(text) {
  const t = text.toLowerCase();
  return ["siapa kamu", "kamu siapa", "admin", "robot"].some(k => t.includes(k));
}

function isBannedTopicQuestion(text) {
  const t = text.toLowerCase();
  return ["resep", "masak", "politik", "presiden"].some(k => t.includes(k));
}

async function testOpenAIConnection() {
    try {
        const res = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: 'user', content: 'Tes' }],
            max_tokens: 5
        });
        return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
}

module.exports = {
  generateAIResponse,
  createEmbedding,
  refineQuery, // Fitur ini TETAP ADA dan AMAN
  testOpenAIConnection
};