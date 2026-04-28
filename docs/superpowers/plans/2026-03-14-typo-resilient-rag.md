# Typo-Resilient RAG Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat RAG pipeline tahan terhadap typo/salah eja dari user, tanpa menambah LLM token usage (streaming tetap ~300 token/prompt).

**Architecture:** Tambahkan pre-processing layer di `generateSearchQueries` menggunakan rule-based normalizer untuk Bahasa Indonesia + fallback threshold strategy jika search pertama return 0 dokumen.

**Tech Stack:** Node.js, existing Qdrant client, `natural` (edit distance), tidak ada LLM call tambahan.

**Constraint:** Jangan ubah `maxTokens` (450), `stream: true`, atau `SCORE_THRESHOLD` default (0.45). Implementasi harus zero-latency-overhead saat query sudah benar.

---

## Chunk 1: Query Normalizer Utility

### Task 1: Buat `queryNormalizer.js`

**Files:**
- Create: `backend/src/utils/queryNormalizer.js`
- Test: manual via `node` REPL (no test framework setup diperlukan)

**Tujuan:** Normalisasi typo umum Bahasa Indonesia sebelum query dikirim ke OpenAI embedding. Murni rule-based, zero latency overhead dibanding LLM correction.

**Strategi normalisasi (3 layer):**
1. **Whitespace & karakter** — lowercase, strip multiple spaces, trim
2. **Common substitution map** — kamus typo → kata benar (khusus domain Tazkia)
3. **Phonetic normalization** — `ei` → `i`, `iy` → `i` untuk pola typo Indonesia

- [ ] **Step 1: Buat file queryNormalizer.js**

```javascript
// backend/src/utils/queryNormalizer.js
/**
 * Query Normalizer — Rule-based typo correction untuk Bahasa Indonesia
 * Zero LLM call, zero async, zero latency overhead.
 */

// Domain-specific correction map (tambahkan sesuai kebutuhan)
const CORRECTION_MAP = {
  // Biaya & Keuangan
  'beiyaa': 'biaya', 'biyaa': 'biaya', 'biay': 'biaya', 'byaya': 'biaya',
  'biyaya': 'biaya', 'bayia': 'biaya',
  // Pendaftaran
  'pendataran': 'pendaftaran', 'pendafaran': 'pendaftaran',
  'pendaftran': 'pendaftaran', 'dafatar': 'daftar', 'daftar': 'daftar',
  // Jurusan / Prodi
  'juruusan': 'jurusan', 'jursan': 'jurusan', 'prpdi': 'prodi',
  'prgram': 'program', 'informatiak': 'informatika', 'informatka': 'informatika',
  'akuntansi': 'akuntansi', 'akutansi': 'akuntansi', 'akontansi': 'akuntansi',
  'syariah': 'syariah', 'syari\'ah': 'syariah', 'shariah': 'syariah',
  // Kampus
  'kampas': 'kampus', 'kamppus': 'kampus',
  'tazkia': 'tazkia', 'tazqia': 'tazkia', 'tazakia': 'tazkia',
  // Akademik
  'akdemik': 'akademik', 'akademk': 'akademik',
  'smeester': 'semester', 'semestre': 'semester', 'semster': 'semester',
  'niali': 'nilai', 'nilia': 'nilai', 'niilai': 'nilai',
  'jadawal': 'jadwal', 'jadawl': 'jadwal',
  'kuliyah': 'kuliah', 'kuliiah': 'kuliah', 'kuliyahh': 'kuliah',
  // Lokasi
  'sentull': 'sentul', 'sentull': 'sentul',
  'dramagah': 'dramaga', 'drmaga': 'dramaga',
  // Umum
  'dimaan': 'dimana', 'diaman': 'dimana',
  'bagaiman': 'bagaimana', 'bagiamana': 'bagaimana',
  'syaratt': 'syarat', 'syararat': 'syarat',
};

/**
 * Normalisasi single word menggunakan correction map
 */
function correctWord(word) {
  const lower = word.toLowerCase();
  return CORRECTION_MAP[lower] || word;
}

/**
 * Normalisasi full query:
 * 1. Trim + lowercase
 * 2. Ganti double space
 * 3. Koreksi per-kata dari CORRECTION_MAP
 */
function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return query;

  const cleaned = query.trim().toLowerCase().replace(/\s+/g, ' ');

  const corrected = cleaned
    .split(' ')
    .map(word => correctWord(word))
    .join(' ');

  return corrected;
}

/**
 * Cek apakah query berubah setelah normalisasi (ada koreksi)
 */
function wasNormalized(original, normalized) {
  return original.toLowerCase().trim() !== normalized;
}

module.exports = { normalizeQuery, wasNormalized, CORRECTION_MAP };
```

- [ ] **Step 2: Verifikasi manual di REPL**

```bash
cd backend
node -e "
const { normalizeQuery, wasNormalized } = require('./src/utils/queryNormalizer');
const tests = [
  ['beiyaa kuliah', 'biaya kuliah'],
  ['dimaan kampas tazkia', 'dimana kampus tazkia'],
  ['biaya kuliah', 'biaya kuliah'],  // sudah benar, tidak berubah
  ['informatiak syariah', 'informatika syariah'],
];
tests.forEach(([input, expected]) => {
  const result = normalizeQuery(input);
  const pass = result === expected ? '✅' : '❌';
  console.log(pass, JSON.stringify(input), '->', JSON.stringify(result), expected !== result ? '(expected: ' + expected + ')' : '');
});
"
```

Expected output: semua ✅

- [ ] **Step 3: Commit**

```bash
git add backend/src/utils/queryNormalizer.js
git commit -m "feat: add Indonesian query normalizer for typo correction"
```

---

## Chunk 2: Integrasi Normalizer ke RAG Pipeline

### Task 2: Modifikasi `generateSearchQueries` di ragService.js

**Files:**
- Modify: `backend/src/services/ragService.js` (method `generateSearchQueries`, line ~34)

**Tujuan:** Inject query yang sudah dinormalisasi sebagai query tambahan. Kalau ada koreksi, query asli tetap masuk (jaga coverage) + query terkoreksi juga masuk.

- [ ] **Step 1: Tambahkan import normalizer di bagian atas ragService.js**

Di baris setelah `const crypto = require('crypto');`, tambahkan:

```javascript
const { normalizeQuery, wasNormalized } = require('../utils/queryNormalizer');
```

- [ ] **Step 2: Modifikasi `generateSearchQueries` — inject normalized query**

Ganti isi method `generateSearchQueries` (mulai dari `const finalQueries = new Set()` hingga sebelum `return queryArray`):

```javascript
const finalQueries = new Set();
const cleanQuery = userQuery.toLowerCase().trim();

// --- LAYER 0: Normalized (Typo-Corrected) Query ---
const normalizedQuery = normalizeQuery(userQuery);
finalQueries.add(normalizedQuery); // selalu masuk sebagai base (sudah lowercase + corrected)

// Jika ada koreksi, tambahkan original juga (jaga coverage edge case)
if (wasNormalized(userQuery, normalizedQuery)) {
  finalQueries.add(userQuery); // original tetap masuk
  console.log(`🔧 [NORMALIZER] "${userQuery}" → "${normalizedQuery}"`);
}

// --- LAYER 1: Context Injection ---
if (history.length > 0) {
  const lastUserMessage = [...history].reverse().find(m => m.role === 'user')?.content || "";
  const isShort = cleanQuery.split(' ').length < 4;
  const triggers = ['nya', 'itu', 'tersebut', 'tadi', 'ini', 'dia', 'beliau', 'dimana', 'berapa', 'kapan', 'dalil', 'hukum', 'biaya'];
  const hasTrigger = triggers.some(w => cleanQuery.includes(w));

  if ((isShort || hasTrigger) && lastUserMessage.length > 2) {
    const combinedQuery = `${normalizedQuery} (Konteks: ${lastUserMessage})`;
    finalQueries.add(combinedQuery);
  }
}

// --- LAYER 2: Keyword Extraction ---
if (cleanQuery.length > 50) {
  const keywords = normalizedQuery
    .replace(/\b(dan|yang|di|ke|dari|untuk|pada|adalah|itu|ini|saya|ingin|mau|tanya|apakah|bagaimana)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (keywords.length > 5 && keywords !== normalizedQuery) {
    finalQueries.add(keywords);
  }
}

const queryArray = Array.from(finalQueries).slice(0, 3); // Limit 3 queries max
return queryArray;
```

- [ ] **Step 3: Test manual — pastikan log normalizer muncul saat typo**

```bash
cd backend
npm run dev
# Di terminal lain atau Postman/curl:
curl -X POST http://localhost:5000/api/guest/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "beiyaa kuliah tazkia", "sessionId": "test-123"}'
# Expected di backend log: 🔧 [NORMALIZER] "beiyaa kuliah tazkia" → "biaya kuliah tazkia"
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/ragService.js
git commit -m "feat: integrate typo normalizer into RAG query generation"
```

---

## Chunk 3: Fallback Threshold Strategy

### Task 3: Tambahkan fallback score threshold di `searchRelevantDocs`

**Files:**
- Modify: `backend/src/services/ragService.js` (method `searchRelevantDocs`, line ~84)

**Tujuan:** Jika search dengan threshold 0.45 return 0 dokumen, coba ulang dengan threshold 0.30. Ini safety net untuk typo yang tidak ada di CORRECTION_MAP tapi embedding-nya masih "mendekati".

- [ ] **Step 1: Tambahkan konstanta SCORE_THRESHOLD_FALLBACK**

Di bagian konstanta (setelah baris `const SCORE_THRESHOLD = 0.45;`):

```javascript
// Fallback threshold jika primary search return 0 docs (misal: typo yang belum di-map)
const SCORE_THRESHOLD_FALLBACK = 0.30;
```

- [ ] **Step 2: Tambahkan fallback logic di akhir method `searchRelevantDocs`**

Setelah `const finalDocs = Array.from(uniqueDocs.values())...` dan sebelum `return finalDocs`, tambahkan:

```javascript
// --- FALLBACK: Retry dengan threshold lebih rendah jika 0 hasil ---
if (finalDocs.length === 0) {
  console.log(`🔁 [RAG] Zero docs at threshold ${SCORE_THRESHOLD}, retrying with ${SCORE_THRESHOLD_FALLBACK}...`);
  try {
    const primaryQuery = queries[0]; // Gunakan query pertama (sudah normalized)
    const vector = await openaiService.createEmbedding(primaryQuery);
    const fallbackResults = await client.search(COLLECTION_NAME, {
      vector,
      limit: 2,
      with_payload: true,
      score_threshold: SCORE_THRESHOLD_FALLBACK,
    });

    if (fallbackResults.length > 0) {
      console.log(`📄 [RAG] Fallback retrieved ${fallbackResults.length} docs`);
      return fallbackResults;
    }
  } catch (e) {
    console.warn('⚠️ [RAG] Fallback search failed:', e.message);
  }
}
```

- [ ] **Step 3: Test fallback — gunakan typo yang tidak ada di CORRECTION_MAP**

```bash
# Gunakan typo yang belum ada di map, contoh "pendaptaran mahsiswa bru"
curl -X POST http://localhost:5000/api/guest/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "pendaptaran mahsiswa bru", "sessionId": "test-456"}'
# Expected di log: 🔁 [RAG] Zero docs at threshold 0.45, retrying with 0.30...
# Dan response harus lebih informatif dibanding "data tidak tersedia"
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/ragService.js
git commit -m "feat: add fallback score threshold for unmatched typo queries"
```

---

## Chunk 4: Extend CORRECTION_MAP (Ongoing)

### Task 4: Tambah kata-kata domain Tazkia ke CORRECTION_MAP

**Files:**
- Modify: `backend/src/utils/queryNormalizer.js`

**Tujuan:** Kumpulkan typo yang sering muncul di logs production dan tambahkan ke map. Ini bukan satu kali kerja — harus diupdate berkala.

- [ ] **Step 1: Cek log backend untuk pattern typo**

```bash
# Di backend production/dev, cari pola NORMALIZER log
grep "NORMALIZER" backend/logs/*.log 2>/dev/null || echo "No logs yet"
```

- [ ] **Step 2: Tambahkan typo baru ke CORRECTION_MAP**

Pattern yang perlu ditambahkan berdasarkan domain Tazkia:
```javascript
// Tambahkan ke CORRECTION_MAP sesuai temuan dari logs:
// 'pendaptaran': 'pendaftaran',
// 'mahsiswa': 'mahasiswa',
// 'mahaswa': 'mahasiswa',
// 'spmbp': 'spmb',          // typo nama program
// dll.
```

- [ ] **Step 3: Re-run REPL test dengan kata baru**

```bash
node -e "const { normalizeQuery } = require('./backend/src/utils/queryNormalizer'); console.log(normalizeQuery('YOUR NEW TYPO HERE'));"
```

- [ ] **Step 4: Commit setiap batch penambahan**

```bash
git add backend/src/utils/queryNormalizer.js
git commit -m "fix: extend correction map with [N] new typo entries"
```

---

## Summary: Apa yang TIDAK Diubah

| Komponen | Status |
|----------|--------|
| `maxTokens` (450) | ✅ Tidak diubah |
| `stream: true` | ✅ Tidak diubah |
| `SCORE_THRESHOLD` (0.45) — primary | ✅ Tidak diubah |
| `MAX_CONTEXT_TOKENS` (800) | ✅ Tidak diubah |
| Query limit (3 max) | ✅ Tidak diubah |
| LLM call tambahan | ✅ Tidak ada |
| Streaming response flow | ✅ Tidak diubah |

## Token Budget Check

```
Sebelum: query asli → 1 embedding call → search
Sesudah: query dinormalisasi (sync, 0ms) → 1 embedding call → search (+ 1 fallback embedding call HANYA jika 0 hasil)
```

Overhead: **0 token tambahan** di jalur normal. Hanya ada 1 extra embedding call (~0.0001 USD) jika query benar-benar tidak ditemukan.
