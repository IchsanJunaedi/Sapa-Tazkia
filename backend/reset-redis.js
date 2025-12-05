const fs = require('fs');
const path = require('path');

// 1. CARI FILE .ENV (Coba di folder backend dulu, lalu root)
const backendEnvPath = path.resolve(__dirname, 'backend', '.env');
const rootEnvPath = path.resolve(__dirname, '.env');

if (fs.existsSync(backendEnvPath)) {
  require('dotenv').config({ path: backendEnvPath });
  console.log(`📂 Memuat konfigurasi dari: ${backendEnvPath}`);
} else {
  require('dotenv').config({ path: rootEnvPath });
  console.log(`📂 Memuat konfigurasi dari: ${rootEnvPath}`);
}

const Redis = require('ioredis');

// 2. KONFIGURASI (Sesuai dengan Backend)
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

console.log(`🔌 Menghubungkan ke Redis: ${redisUrl}`);

const redis = new Redis(redisUrl);

async function clearRedis() {
  try {
    console.log('⏳ Sedang menghapus semua data rate limit...');
    
    // Gunakan flushdb (hapus database saat ini) atau flushall (hapus semua DB)
    // flushall lebih aman untuk memastikan bersih total
    await redis.flushall();
    
    console.log('✅ SUKSES! Redis telah dibersihkan.');
    console.log('🔄 Semua kuota Token & Spam limit kembali ke 0.');
    
  } catch (error) {
    console.error('❌ GAGAL:', error.message);
  } finally {
    redis.quit();
  }
}

clearRedis();