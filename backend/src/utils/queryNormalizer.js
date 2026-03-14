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
  'pendaftran': 'pendaftaran', 'dafatar': 'daftar',
  // Jurusan / Prodi
  'juruusan': 'jurusan', 'jursan': 'jurusan', 'prpdi': 'prodi',
  'prgram': 'program', 'informatiak': 'informatika', 'informatka': 'informatika',
  'akutansi': 'akuntansi', 'akontansi': 'akuntansi',
  'shariah': 'syariah',
  // Kampus
  'kampas': 'kampus', 'kamppus': 'kampus',
  'tazqia': 'tazkia', 'tazakia': 'tazkia',
  // Akademik
  'akdemik': 'akademik', 'akademk': 'akademik',
  'smeester': 'semester', 'semestre': 'semester', 'semster': 'semester',
  'niali': 'nilai', 'nilia': 'nilai', 'niilai': 'nilai',
  'jadawal': 'jadwal', 'jadawl': 'jadwal',
  'kuliyah': 'kuliah', 'kuliiah': 'kuliah', 'kuliyahh': 'kuliah',
  // Lokasi
  'sentull': 'sentul',
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
  return original.toLowerCase().trim().replace(/\s+/g, ' ') !== normalized;
}

module.exports = { normalizeQuery, wasNormalized, CORRECTION_MAP };
