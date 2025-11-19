const OpenAI = require('openai');

// --- PERBAIKAN 1: Panggil dotenv di sini ---
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * System Prompt untuk OpenAI (Kia Assistant)
 */
const SYSTEM_INSTRUCTION = `Anda adalah "Kia", asisten virtual resmi Universitas & STMIK Tazkia yang ramah, profesional, dan membantu.

IDENTITAS:
- Nama: Kia
- Institusi: Universitas & STMIK Tazkia, Bogor
- Tugas: Membantu mahasiswa dan calon pendaftar dengan informasi kampus

ATURAN PENTING:
1. Jawab HANYA berdasarkan konteks informasi yang diberikan
2. Jika informasi tidak tersedia, katakan dengan jujur dan sarankan menghubungi pihak kampus
3. Gunakan bahasa Indonesia yang sopan dan mudah dipahami
4. Berikan jawaban yang terstruktur dengan numbering/bullet points jika perlu
5. Jika ada pertanyaan tentang data pribadi mahasiswa (nilai, IPK), minta mereka login terlebih dahulu
6. Selalu ramah, responsif, dan helpful
7. Jangan mengarang informasi yang tidak ada
8. Maksimal 3-4 paragraf per response
9. Jika user mengucapkan assalamualaikum, jawab waalaikumsalam

INFORMASI DASAR UNIVERSITAS & STMIK TAZKIA:
- Lokasi: Jalan Raya Dramaga Km.7 Kel. Margajaya, Kec. Bogor Barat (STMIK Tazkia) & Jl. Ir. H. Djuanda No. 78 Sentul, Citaringgul, Kec. Babakan Madang, Kota Bogor (Universitas Tazkia)
- Program Studi: Sistem Informasi (S1) dan Teknik Informatika (S1)
- Status Akreditasi: A
- Website: www.tazkia.ac.id
- Email: info@tazkia.ac.id
- Telepon: +6285123123119 (Admin)
- SPP per Semester: Rp 3.500.000 - Rp 4.500.000
- Biaya Pendaftaran: Rp 300.000
- Tim Developer: ican dan kawan kawan
- Fasilitas: Lab Komputer, Perpustakaan Digital, WiFi Kampus, Masjid, Kantin`;

/**
 * Generate AI Response menggunakan OpenAI
 */
async function generateAIResponse(userMessage, conversationHistory = []) {
  try {
    // Cek API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      throw new Error('OPENAI_API_KEY tidak valid. Silakan cek file .env');
    }

    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // Build messages array untuk OpenAI
    const messages = [
      {
        role: 'system',
        content: SYSTEM_INSTRUCTION
      },
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content: userMessage
      }
    ];

    // Generate response menggunakan OpenAI
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
      top_p: 0.9,
    });

    const aiReply = completion.choices[0].message.content;

    // Log untuk monitoring
    console.log('✅ OpenAI response generated:', {
      model: modelName,
      responseLength: aiReply.length,
      promptTokens: completion.usage?.prompt_tokens || 0,
      completionTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0
    });

    return aiReply;

  } catch (error) {
    console.error('❌ Error generating OpenAI response:', error);

    // Error handling untuk OpenAI
    if (error.code === 'invalid_api_key') {
      return 'Terjadi kesalahan konfigurasi sistem. Mohon hubungi administrator.';
    } else if (error.code === 'rate_limit_exceeded') {
      return 'Terlalu banyak permintaan. Mohon tunggu sebentar dan coba lagi.';
    } else if (error.code === 'context_length_exceeded') {
      return 'Percakapan terlalu panjang. Silakan mulai percakapan baru.';
    } else if (error.code === 'content_filter') {
      return 'Maaf, pertanyaan Anda tidak dapat diproses karena alasan keamanan. Silakan ajukan pertanyaan lain.';
    } else {
      return `Maaf, saya mengalami kesulitan: ${error.message}. Silakan coba lagi atau hubungi admin.`;
    }
  }
}

/**
 * Test OpenAI Connection
 */
async function testOpenAIConnection() {
  try {
    // Cek API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      return {
        success: false,
        error: 'OPENAI_API_KEY tidak valid. Pastikan sudah diatur di file .env'
      };
    }

    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: 'Say hello in Indonesian'
        }
      ],
      max_tokens: 50,
    });

    const response = completion.choices[0].message.content;

    console.log('✅ OpenAI connection test successful:', response);
    return { 
      success: true, 
      message: response,
      model: modelName,
      tokens: completion.usage?.total_tokens || 0
    };

  } catch (error) {
    console.error('❌ OpenAI connection test failed:', error);
    return {
      success: false,
      error: error.message,
      code: error.code,
      details: 'Pastikan OPENAI_API_KEY valid dan koneksi internet tersedia'
    };
  }
}

/**
 * Analyze Academic Content (untuk keperluan khusus)
 */
async function analyzeAcademicContent(content) {
  try {
    const prompt = `Analisis konten akademik berikut dan berikan insight:\n\n${content}`;
    
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Anda adalah asisten akademik yang ahli dalam menganalisis materi pembelajaran.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.5,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('❌ Error analyzing academic content:', error);
    throw new Error('Gagal menganalisis konten akademik');
  }
}

module.exports = {
  generateAIResponse,
  testOpenAIConnection,
  analyzeAcademicContent
};