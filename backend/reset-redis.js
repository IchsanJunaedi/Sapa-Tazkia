// Nama file: reset-redis.js
require('dotenv').config(); // Load password dari .env jika ada
const Redis = require('ioredis'); // Kita pinjam library yang udah ada

// Konfigurasi koneksi (mengambil dari .env atau default)
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

async function clearRedis() {
  try {
    console.log('🧹 Sedang membersihkan Redis...');
    
    // Perintah sakti untuk menghapus semua data
    await redis.flushall();
    
    console.log('✅ SUKSES! Redis sudah bersih total (0 count).');
    console.log('🚀 Sekarang kamu bisa tes limit 5x lagi dari awal.');
  } catch (error) {
    console.error('❌ Gagal:', error.message);
  } finally {
    // Tutup koneksi biar script berhenti
    redis.quit();
  }
}

clearRedis();