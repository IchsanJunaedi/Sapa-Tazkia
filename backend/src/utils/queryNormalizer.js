// backend/src/utils/queryNormalizer.js
/**
 * Query Normalizer — Rule-based typo correction untuk Bahasa Indonesia
 * Zero LLM call, zero async, zero latency overhead.
 *
 * Urutan koreksi per kata:
 * 1. CORRECTION_MAP  — exact known typos (prioritas tertinggi)
 * 2. Phonetic patterns — pola ejaan Indonesia yang konsisten & zero false positive
 */

// Domain-specific correction map (tambahkan sesuai kebutuhan)
const CORRECTION_MAP = {
  // Note: identity entries (e.g., 'biaya': 'biaya') are intentionally excluded —
  // the fallback `CORRECTION_MAP[lower] || word` already preserves the original.
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
 * Phonetic patterns yang AMAN untuk Bahasa Indonesia (zero false positive):
 *
 * 1. iy + vokal → i    : kuliyah→kuliah, biyaya→biaya, syariyah→syariah
 *    (iy sebelum vokal hampir selalu typo 'i' di Indonesia)
 *
 * 2. 3+ karakter berulang → 1 : kuliiiiah→kuliah, kampusss→kampus
 *    (tidak ada kata Indonesia baku dengan 3+ huruf sama berurutan)
 *
 * 3. ii → i  : kuliiah→kuliah
 * 4. uu → u  : ruumah→rumah, kuuliah→kuliah
 *    (ii dan uu tidak ada dalam kata baku Indonesia)
 *
 * TIDAK digunakan (terlalu berisiko):
 * - oo→o : merusak "koordinasi" (k-oo-rdinasi)
 * - aa→a : merusak beberapa kata
 * - ei→i : merusak "keinginan", "keikutsertaan"
 */
const PHONETIC_PATTERNS = [
  [/iy(?=[aeiou])/g, 'i'],   // iy + vokal → i
  [/(.)\1{2,}/g, '$1'],       // 3+ karakter berulang → 1
  [/ii/g, 'i'],               // ii → i
  [/uu/g, 'u'],               // uu → u
];

/**
 * Terapkan phonetic patterns ke sebuah kata (lowercase, sudah tanpa tanda baca)
 */
function applyPhoneticPatterns(word) {
  return PHONETIC_PATTERNS.reduce((w, [pattern, replacement]) => w.replace(pattern, replacement), word);
}

/**
 * Normalisasi single word: CORRECTION_MAP dulu, lalu phonetic patterns
 */
function correctWord(word) {
  // Strip leading/trailing punctuation before correction, then restore it
  const match = word.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9]+)([^a-zA-Z0-9]*)$/);
  if (!match) return word;
  const [, prefix, core, suffix] = match;
  const lower = core.toLowerCase();

  // Step 1: exact map lookup (highest priority)
  if (CORRECTION_MAP[lower]) {
    return prefix + CORRECTION_MAP[lower] + suffix;
  }

  // Step 2: phonetic patterns
  const phonetic = applyPhoneticPatterns(lower);
  return prefix + phonetic + suffix;
}

/**
 * Normalisasi full query:
 * 1. Trim + lowercase
 * 2. Collapse multiple spaces
 * 3. Koreksi per-kata: CORRECTION_MAP → phonetic patterns
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

module.exports = { normalizeQuery, wasNormalized, CORRECTION_MAP, applyPhoneticPatterns };
