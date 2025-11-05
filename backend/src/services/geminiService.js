const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * System Prompt untuk Gemini
 */
const SYSTEM_INSTRUCTION = `Anda adalah "Sapa Tazkia", asisten virtual resmi STMIK Tazkia yang ramah, profesional, dan membantu.

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
7. Jangan mengarang informasi yang tidak ada
8. Maksimal 3-4 paragraf per response

INFORMASI DASAR STMIK TAZKIA:
- Lokasi: Jalan Raya Dramaga Km.7 Kel. Margajaya, Kec. Bogor Barat
- Program Studi: Sistem Informasi (S1) dan Teknik Informatika (S1)
- Status Akreditasi: A
- Website: www.tazkia.ac.id
- Email: info@tazkia.ac.id
- Telepon: (0251) 8240808
- SPP per Semester: Rp 3.500.000 - Rp 4.500.000
- Biaya Pendaftaran: Rp 300.000
- Tim Developer: ican dan kawan kawan
- Fasilitas: Lab Komputer, Perpustakaan Digital, WiFi Kampus, Masjid, Kantin`;

/**
 * Generate AI Response menggunakan Gemini
 */
async function generateGeminiResponse(userMessage, conversationHistory = []) {
  try {
    // Cek API key
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'AIzaSy.....') {
      throw new Error('GEMINI_API_KEY tidak valid. Silakan cek file .env');
    }

    // Initialize model dengan system instruction
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini 2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION
    });

    // Build conversation history untuk Gemini
    const chatHistory = conversationHistory.slice(-10).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Start chat session
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
        topK: 40
      }
    });

    // Send message dan get response
    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    const aiReply = response.text();

    // Log untuk monitoring
    console.log('✅ Gemini response generated:', {
      model: process.env.GEMINI_MODEL,
      responseLength: aiReply.length,
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0
    });

    return aiReply;

  } catch (error) {
    console.error('❌ Error generating Gemini response:', error);

    // Error handling
    if (error.message?.includes('API_KEY_INVALID')) {
      return 'Terjadi kesalahan konfigurasi sistem. Mohon hubungi administrator.';
    } else if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
      return 'Terlalu banyak permintaan. Mohon tunggu sebentar dan coba lagi.';
    } else if (error.message?.includes('SAFETY')) {
      return 'Maaf, pertanyaan Anda tidak dapat diproses karena alasan keamanan. Silakan ajukan pertanyaan lain.';
    } else {
      return 'Maaf, saya mengalami kesulitan memproses permintaan Anda. Silakan coba lagi atau hubungi admin kampus di info@tazkia.ac.id';
    }
  }
}

/**
 * Test Gemini Connection
 */
async function testGeminiConnection() {
  try {
    // Cek API key
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'AIzaSy.....') {
      return { 
        success: false, 
        error: 'GEMINI_API_KEY tidak valid. Pastikan sudah diatur di file .env' 
      };
    }

    const model = genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini 2.5-flash'
    });
    
    const result = await model.generateContent('Say hello in Indonesian');
    const response = result.response.text();
    
    console.log('✅ Gemini connection test successful:', response);
    return { success: true, message: response };
    
  } catch (error) {
    console.error('❌ Gemini connection test failed:', error);
    return { 
      success: false, 
      error: error.message,
      details: 'Pastikan GEMINI_API_KEY valid dan koneksi internet tersedia'
    };
  }
}

module.exports = {
  generateGeminiResponse,
  testGeminiConnection
};