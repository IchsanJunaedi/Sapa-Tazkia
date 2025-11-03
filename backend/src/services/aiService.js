const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * System Prompt - Instruksi untuk AI
 * Ini menentukan personality dan behavior chatbot
 */
const SYSTEM_PROMPT = `Anda adalah "Sapa Tazkia", asisten virtual resmi STMIK Tazkia yang ramah, profesional, dan membantu.

IDENTITAS:
- Nama: Sapa Tazkia
- Institusi: STMIK Tazkia, Bogor
- Tugas: Membantu mahasiswa dan calon pendaftar dengan informasi kampus

ATURAN PENTING:
1. Jawab HANYA berdasarkan konteks informasi yang diberikan
2. Jika informasi tidak tersedia, katakan dengan jujur dan sarankan menghubungi pihak kampus
3. Gunakan bahasa Indonesia yang sopan dan mudah dipahami
4. Berikan jawaban yang terstruktur dengan numbering/bullet points jika perlu
5. Jika ada pertanyaan tentang data pribadi mahasiswa (nilai, IPK), minta mereka login terlebih dahulu
6. Selalu ramah, responsif, dan helpful

INFORMASI DASAR STMIK TAZKIA:
- Lokasi: Jl. Raya Ciawi-Sukabumi KM 4, Sentul, Bogor, Jawa Barat 16720
- Program Studi: Sistem Informasi (S1) dan Teknik Informatika (S1)
- Status Akreditasi: B (BAN-PT)
- Website: www.tazkia.ac.id
- Email: info@tazkia.ac.id
- Telepon: (0251) 8240808

Jawab pertanyaan berikut dengan friendly dan informatif:`;

/**
 * Generate AI Response
 * @param {string} userMessage - Pesan dari user
 * @param {Array} conversationHistory - Riwayat percakapan untuk context
 * @param {string} contextData - Data tambahan dari RAG (opsional, untuk fase selanjutnya)
 * @returns {Promise<string>} - Response dari AI
 */
async function generateAIResponse(userMessage, conversationHistory = [], contextData = null) {
  try {
    // Build messages array untuk API
    const messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      }
    ];

    // Tambahkan conversation history (max 10 pesan terakhir untuk efisiensi)
    const recentHistory = conversationHistory.slice(-10);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Jika ada context dari RAG (akan digunakan di fase berikutnya)
    if (contextData) {
      messages.push({
        role: 'system',
        content: `KONTEKS DOKUMEN:\n${contextData}`
      });
    }

    // Tambahkan pesan user saat ini
    messages.push({
      role: 'user',
      content: userMessage
    });

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: messages,
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 500,
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    // Extract response
    const aiResponse = completion.choices[0].message.content;

    // Log untuk monitoring
    console.log('✅ AI Response generated:', {
      model: completion.model,
      tokens: completion.usage.total_tokens,
      responseLength: aiResponse.length
    });

    return aiResponse;

  } catch (error) {
    console.error('❌ Error generating AI response:', error);

    // Error handling berdasarkan tipe error
    if (error.code === 'insufficient_quota') {
      return 'Maaf, sistem sedang mengalami keterbatasan kuota. Silakan hubungi admin kampus atau coba lagi nanti.';
    } else if (error.code === 'rate_limit_exceeded') {
      return 'Terlalu banyak permintaan dalam waktu singkat. Mohon tunggu sebentar dan coba lagi.';
    } else if (error.code === 'invalid_api_key') {
      return 'Terjadi kesalahan konfigurasi sistem. Mohon hubungi administrator.';
    } else {
      return 'Maaf, saya mengalami kesulitan memproses permintaan Anda. Silakan coba lagi atau hubungi admin kampus di info@tazkia.ac.id';
    }
  }
}

/**
 * Check if message requires authentication
 * @param {string} message - User message
 * @returns {boolean}
 */
function requiresAuthentication(message) {
  const authKeywords = [
    'nilai', 'ipk', 'transkrip', 'akademik saya', 'data saya', 
    'jadwal saya', 'krs', 'beasiswa saya', 'tagihan', 'pembayaran saya'
  ];
  
  const lowerMessage = message.toLowerCase();
  return authKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Detect intent from user message
 * @param {string} message - User message
 * @returns {string} - Intent category
 */
function detectIntent(message) {
  const lowerMessage = message.toLowerCase();

  // Intent categories
  if (lowerMessage.includes('pendaftaran') || lowerMessage.includes('daftar')) {
    return 'pendaftaran';
  } else if (lowerMessage.includes('program studi') || lowerMessage.includes('prodi') || lowerMessage.includes('jurusan')) {
    return 'program_studi';
  } else if (lowerMessage.includes('biaya') || lowerMessage.includes('uang kuliah') || lowerMessage.includes('spp')) {
    return 'biaya';
  } else if (lowerMessage.includes('lokasi') || lowerMessage.includes('alamat') || lowerMessage.includes('dimana')) {
    return 'lokasi';
  } else if (lowerMessage.includes('fasilitas') || lowerMessage.includes('lab') || lowerMessage.includes('perpustakaan')) {
    return 'fasilitas';
  } else if (lowerMessage.includes('beasiswa')) {
    return 'beasiswa';
  } else if (lowerMessage.includes('nilai') || lowerMessage.includes('ipk') || lowerMessage.includes('transkrip')) {
    return 'akademik_personal';
  } else {
    return 'general';
  }
}

module.exports = {
  generateAIResponse,
  requiresAuthentication,
  detectIntent
};