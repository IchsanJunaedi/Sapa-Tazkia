# Backend Stability Upgrade — Design Spec

**Date:** 2026-04-02  
**Status:** Approved  
**Scope:** Backend only — no frontend changes

---

## Context

SAPA-TAZKIA backend sudah memiliki fondasi yang solid (rate limiting, auth, RAG), namun audit menemukan 6 gap stabilitas yang perlu diperbaiki sebelum produksi:

1. Request tidak punya trace ID → debugging log sulit
2. Response tidak di-compress → bandwidth boros
3. `uncaughtException`/`unhandledRejection` langsung `process.exit(1)` tanpa log proper
4. `createEmbedding()` tidak punya application-level retry — satu kegagalan langsung fatal ke RAG pipeline
5. PDF upload hanya validasi ukuran, tidak validasi content-type dan magic bytes
6. Session store crash kalau Redis down; rate limiting tidak ada in-memory fallback

Pilihan arsitektur: **Opsi 3 — Middleware folder lengkap**, ikuti struktur yang sudah ada.

---

## Arsitektur Perubahan

### File Baru
| File | Tanggung Jawab |
|------|----------------|
| `backend/src/middleware/requestId.js` | Generate UUID v4, set `req.id` dan `X-Request-Id` header |

### File Dimodifikasi
| File | Perubahan |
|------|-----------|
| `backend/src/app.js` | Pasang `requestId`, `compression`, perbaiki `uncaughtException`/`unhandledRejection` |
| `backend/src/services/openaiService.js` | Tambah `withRetry()` wrapper, apply ke `createEmbedding()` dan `generateAIResponse()` |
| `backend/src/controllers/adminController.js` | Tambah `fileFilter` + magic bytes validation ke multer config |
| `backend/src/services/redisService.js` | Tambah `degradedMode` dengan in-memory fallback (TTL-aware `Map`) |

### Dependency Baru
- `uuid` — generate request ID
- `compression` — gzip/deflate response

---

## Detail per Komponen

### 1. Request ID (`middleware/requestId.js`)

```js
// Pseudocode
const { v4: uuidv4 } = require('uuid');

module.exports = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
};
```

- Dipasang sebagai middleware **pertama** di `app.js` (sebelum CORS dan Helmet)
- Jika request sudah membawa `X-Request-Id` header (dari load balancer), dipakai ulang
- Logger di `app.js` request-logging middleware menyertakan `req.id`

---

### 2. Compression (`app.js`)

```js
const compression = require('compression');

app.use(compression({
  threshold: 1024, // skip response < 1KB
  filter: (req, res) => {
    // Jangan compress SSE streaming
    if (req.path.includes('/api/ai/chat') || req.path.includes('/api/guest/chat')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
```

- Dipasang setelah `requestId`, sebelum `cors`
- SSE endpoints dikecualikan agar streaming tidak di-buffer

---

### 3. Global Error Handler — `process.on` handlers (`app.js`)

**Sebelum:**
```js
process.on('uncaughtException', (error) => {
  console.error('🔴 UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});
```

**Sesudah:**
```js
process.on('uncaughtException', (error) => {
  logger.error('[UNCAUGHT EXCEPTION] Process will exit', { 
    error: error.message, stack: error.stack 
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('[UNHANDLED REJECTION] Process will exit', { 
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  gracefulShutdown('unhandledRejection');
});
```

- Log via Winston sebelum shutdown (agar tersimpan ke file di production)
- Panggil `gracefulShutdown()` yang sudah ada (disconnect DB + Redis)

---

### 4. OpenAI Retry — `withRetry()` (`openaiService.js`)

```js
const RETRIABLE_STATUS = [429, 500, 502, 503, 504];

async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetriable =
        error.status && RETRIABLE_STATUS.includes(error.status) ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET';
      
      if (!isRetriable || attempt === maxAttempts) throw error;
      
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      logger.warn(`[OPENAI] Retry ${attempt}/${maxAttempts} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

- `createEmbedding()`: dibungkus `withRetry()` — 3 attempts, error tetap di-throw setelah habis
- `generateAIResponse()` non-streaming: dibungkus `withRetry()` — 3 attempts, fallback ke pesan error statik setelah habis
- Streaming (`options.stream = true`): **tidak** dibungkus retry (SSE sudah punya error handling di `aiController.js`)
- `generateTitle()`: **tidak** dibungkus retry (fallback manual sudah ada, judul tidak kritis)

---

### 5. PDF Validation (`adminController.js`)

**Perubahan multer config:**
```js
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Hanya file PDF yang diperbolehkan'), false);
    }
    cb(null, true);
  }
});
```

**Setelah multer, validasi magic bytes di `uploadPdfDoc()`:**
```js
const PDF_MAGIC = Buffer.from('%PDF-');
if (!req.file.buffer.slice(0, 5).equals(PDF_MAGIC)) {
  return res.status(422).json({
    success: false,
    message: 'File bukan PDF yang valid'
  });
}
```

---

### 6. Redis Degraded Mode (`redisService.js`)

**Property baru di `RedisService`:**
- `this.degradedMode = false` — flag status
- `this._memoryStore = new Map()` — in-memory fallback
- `this._memoryExpiry = new Map()` — TTL tracking

**Behavior:**
- Saat Redis error pada operasi (`get`, `set`, `incr`, dll.), jika `degradedMode = true`, gunakan `_memoryStore` sebagai fallback
- `degradedMode` di-set `true` saat ping gagal (di `healthCheck()`)
- `degradedMode` di-set `false` kembali saat `connect` event fired (auto-recovery)
- Memory store dibatasi 10.000 entries; jika penuh, hapus 100 entry terlama (FIFO eviction)
- TTL di memory store di-check saat `get()` — entry expired dihapus dan return `null`

**Session store di `app.js`:**
- Tidak ubah ke MemoryStore — session memang butuh Redis (user harus login ulang kalau Redis down)
- Tambah event handler di sesi startup: kalau `RedisStore` gagal connect, log warning `SESSION: Redis unavailable, sessions will fail until Redis recovers`
- Rate limiting tetap berfungsi via `degradedMode` in-memory fallback

---

## Urutan Middleware di `app.js` (Sesudah)

```
requestId          ← BARU (paling atas)
compression        ← BARU (sebelum CORS)
cors
cors preflight
helmet
body parser (json + urlencoded)
rate limit headers
session
passport
request logging    ← sudah include req.id
... routes ...
rateLimitErrorHandler
404 handler
global error handler
```

---

## Verifikasi

1. **Request ID:** `curl -i http://localhost:5000/health` → response header harus ada `X-Request-Id: <uuid>`
2. **Compression:** `curl -H "Accept-Encoding: gzip" http://localhost:5000/health -v` → `Content-Encoding: gzip`
3. **SSE tidak di-compress:** Chat endpoint harus tetap streaming tanpa `Content-Encoding`
4. **OpenAI retry:** Mock test dengan `OPENAI_API_KEY=invalid` → log harus tampil `[OPENAI] Retry 1/3 after 1000ms`
5. **PDF validation:** Upload file `.txt` renamed `.pdf` → harus dapat `422 File bukan PDF yang valid`
6. **Redis degraded:** Stop Redis, kirim chat request → app tetap respond (rate limiting via memory), session failed (expected), log `SESSION: Redis unavailable`
7. **Graceful shutdown log:** `kill -SIGTERM <pid>` → log Winston muncul sebelum process exit
