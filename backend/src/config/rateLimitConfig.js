require('dotenv').config(); // Memastikan variabel environment terbaca

const rateLimitConfig = {
  // ============================================================
  // 1. TOKEN QUOTA LIMITS (Limit Harian)
  // ============================================================
  
  guest: {
    // Default: 7.000 token (setara ~5-7 chat panjang)
    tokenLimitDaily: parseInt(process.env.RATE_LIMIT_GUEST_TOKEN) || 7000,   
    // Default: 20 request/menit (Anti-Spam klik)
    spamLimitPerMinute: parseInt(process.env.RATE_LIMIT_GUEST_SPAM) || 100,
  },
  
  user: {
    // Default: 15.000 token
    tokenLimitDaily: parseInt(process.env.RATE_LIMIT_USER_TOKEN) || 15000,  
    spamLimitPerMinute: parseInt(process.env.RATE_LIMIT_USER_SPAM) || 300,
  },
  
  premium: {
    // Default: 100.000 token (High Priority)
    tokenLimitDaily: parseInt(process.env.RATE_LIMIT_PREMIUM_TOKEN) || 100000, 
    spamLimitPerMinute: parseInt(process.env.RATE_LIMIT_PREMIUM_SPAM) || 1000,
  },

  // ============================================================
  // 2. SYSTEM CONFIG (Redis Keys)
  // ============================================================
  redis: {
    prefix: 'rate_limit:',
    
    // ✅ FIX: Ganti ke 'v4' agar data lama (yang 16 jam) dibuang
    // dan sistem dipaksa membuat timer baru yang murni 12 jam.
    tokenPrefix: 'usage:token:v4:', 
    
    // Margin tidak lagi dipakai di logic baru (fixed window), tapi dibiarkan aman.
    expiryMargin: 3600, 
  },

  // ============================================================
  // 3. ADAPTIVE CONFIG (Opsional)
  // ============================================================
  adaptive: {
    enabled: true,
    loadThreshold: 0.8, 
  }
};

module.exports = rateLimitConfig;