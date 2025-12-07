require('dotenv').config(); // Load environment variables (.env)
const ragService = require('./src/services/ragService');

// [SECURITY CHECK] Pastikan variable penting ada sebelum mulai
if (!process.env.OPENAI_API_KEY) {
    console.error("❌ FATAL ERROR: OPENAI_API_KEY tidak ditemukan di file .env!");
    process.exit(1);
}

if (!process.env.QDRANT_HOST) {
    console.warn("⚠️ WARNING: QDRANT_HOST tidak diset, default ke 'localhost'.");
}

(async () => {
    console.clear();
    console.log("==========================================");
    console.log("🚀 SAPA TAZKIA - KNOWLEDGE INGESTION TOOL");
    console.log("==========================================");
    console.log(`📅 Waktu   : ${new Date().toLocaleString()}`);
    console.log(`📡 Target  : ${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || 6333}`);
    console.log("🔄 Memulai proses reset & ingestion data...");
    console.log("------------------------------------------");

    const startTime = Date.now();
    
    try {
        // Panggil fungsi reset & ingest yang ada di ragService
        // Fungsi ini otomatis membaca file .json di folder /data dan memasukkannya ke Qdrant
        const result = await ragService.ingestData();
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (result.success) {
            console.log("------------------------------------------");
            console.log(`✅ SUKSES! Ingestion Selesai.`);
            console.log(`📊 Total Data : ${result.count} chunks berhasil disimpan.`);
            console.log(`⏱️ Durasi     : ${duration} detik.`);
            console.log("==========================================");
            console.log("👉 Database Qdrant sudah terupdate. Silakan jalankan server utama.");
        } else {
            console.error("\n❌ GAGAL MEMPROSES DATA:", result.message);
        }
    } catch (error) {
        console.error("\n❌ ERROR CRITICAL (SYSTEM CRASH):", error);
    } finally {
        console.log("\n👋 Menutup koneksi...");
        process.exit();
    }
})();