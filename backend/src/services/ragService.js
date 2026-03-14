const { QdrantClient } = require('@qdrant/js-client-rest');
const openaiService = require('./openaiService');
const redisService = require('./redisService'); // ✅ Added Redis for Caching
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeQuery, wasNormalized } = require('../utils/queryNormalizer');

/**
 * ⚙️ KONFIGURASI RAG SERVICE - PRODUCTION GRADE (HYBRID EDITION)
 * Project: Sapa Tazkia Chatbot
 */
const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || 6333;
const COLLECTION_NAME = 'sapa_tazkia_knowledge';
const VECTOR_SIZE = 1536;

const MAX_CONTEXT_TOKENS = 800;
// ✅ UPGRADE: Threshold dinaikkan 0.35 → 0.45 agar hanya dokumen SANGAT relevan yang masuk.
// Ini mengurangi noise di context sehingga LLM bisa jawab akurat dengan token lebih sedikit.
const SCORE_THRESHOLD = 0.45;
// Fallback threshold jika primary search return 0 docs (misal: typo yang belum di-map)
const SCORE_THRESHOLD_FALLBACK = 0.30;
const CACHE_TTL_SECONDS = 3600 * 6; // 6 Jam Cache

const client = new QdrantClient({ host: QDRANT_HOST, port: QDRANT_PORT, checkCompatibility: false });

class RagService {
  constructor() {
    this.ensureCollection();
  }

  // =============================================================================
  // 1. QUERY OPTIMIZATION 🧠
  // =============================================================================

  async generateSearchQueries(userQuery, history = []) {
    try {
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

    } catch (error) {
      console.warn('⚠️ [RAG] Query Gen Critical Error:', error.message);
      return [userQuery];
    }
  }

  // =============================================================================
  // 2. SEARCH ENGINE (HYBRID) 🚀
  // =============================================================================

  async searchRelevantDocs(userQuery, history = [], category = null, abortSignal = null) {
    const startSearchTotal = Date.now();
    try {
      const queries = await this.generateSearchQueries(userQuery, history);

      console.log(`🔍 [RAG] Search Queries: ${JSON.stringify(queries)}`);

      // Parallel Search
      const searchPromises = queries.map(async (q) => {
        if (abortSignal?.aborted) throw new Error('AbortError');

        try {
          const vector = await openaiService.createEmbedding(q);

          const searchOptions = {
            vector: vector,
            // ✅ UPGRADE: Limit 5 → 3 per sub-query.
            // 3 dokumen berkualitas tinggi (threshold 0.45) lebih berguna daripada
            // 5 dokumen campuran. Hasilnya: context lebih bersih, token LLM lebih hemat.
            limit: 3,
            with_payload: true,
            score_threshold: SCORE_THRESHOLD,
          };

          if (category) {
            searchOptions.filter = {
              must: [{ key: "category", match: { value: category } }]
            };
          }

          return await client.search(COLLECTION_NAME, searchOptions);
        } catch (e) {
          console.warn(`⚠️ [RAG] Sub-search failed for "${q}":`, e.message);
          return [];
        }
      });

      const results = await Promise.allSettled(searchPromises);

      // Flatten & Deduplicate
      const uniqueDocs = new Map();

      results.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          res.value.forEach(item => {
            // Use payload.text hash or ID as key
            const content = (item.payload.text || "").trim();
            const docHash = this.calculateTextHash(content);

            if (!uniqueDocs.has(docHash)) {
              uniqueDocs.set(docHash, item);
            } else {
              // Keep the one with higher score
              if (item.score > uniqueDocs.get(docHash).score) {
                uniqueDocs.set(docHash, item);
              }
            }
          });
        }
      });

      // Sort by Score — ambil top 3 saja (cukup untuk jawaban akurat + token efisien)
      const finalDocs = Array.from(uniqueDocs.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      // --- FALLBACK: Retry dengan threshold lebih rendah jika 0 hasil ---
      if (finalDocs.length === 0) {
        console.log(`🔁 [RAG] Zero docs at threshold ${SCORE_THRESHOLD}, retrying with ${SCORE_THRESHOLD_FALLBACK}...`);
        try {
          const primaryQuery = queries[0]; // Gunakan query pertama (sudah normalized)
          const vector = await openaiService.createEmbedding(primaryQuery);
          // Intentionally unconstrained (no category filter): if primary category-scoped search
          // returned 0 docs, we relax both threshold AND category as a last resort.
          const fallbackResults = await client.search(COLLECTION_NAME, {
            vector,
            limit: 2,
            with_payload: true,
            score_threshold: SCORE_THRESHOLD_FALLBACK,
          });

          if (fallbackResults.length > 0) {
            console.log(`📄 [RAG] Fallback retrieved ${fallbackResults.length} docs`);
            return fallbackResults;
          } else {
            console.log(`📭 [RAG] Fallback also returned zero docs for: "${primaryQuery}"`);
          }
        } catch (e) {
          console.warn('⚠️ [RAG] Fallback search failed:', e.message);
        }
      }

      if (finalDocs.length > 0) {
        console.log(`📄 [RAG] Retrieved ${finalDocs.length} docs in ${(Date.now() - startSearchTotal)}ms`);
      }

      return finalDocs;

    } catch (error) {
      console.error('❌ [RAG] Retrieval Critical Error:', error.message);
      return [];
    }
  }

  // =============================================================================
  // 3. CONTEXT & ANSWERING (STREAMING SUPPORT)
  // =============================================================================

  compileContext(docs) {
    if (!docs || docs.length === 0) return "";

    let contextString = "";
    let currentTokens = 0;

    for (const doc of docs) {
      const title = doc.payload.title || "Informasi";
      const text = doc.payload.text || "";

      const chunk = `[[Sumber: ${title}]]\n${text}\n\n`;

      // Rough token check (char / 4)
      if ((currentTokens + (chunk.length / 4)) > MAX_CONTEXT_TOKENS) break;

      contextString += chunk;
      currentTokens += (chunk.length / 4);
    }

    return contextString;
  }

  async answerQuestion(userMessage, conversationHistory = [], options = {}) {
    const { stream = false, abortSignal = null } = options;
    const startTotal = Date.now();

    // 1. Cache Check (Hanya untuk non-streaming atau jika streaming support cache flag nanti) 
    // Saat ini kita skip cache untuk streaming agar simple, atau return cache langsung.
    // Untuk streaming, kita bisa return "fake stream" dari cache, tapi kompleks. 
    // Sederhana: jika cache hit, return JSON biasa (Frontend harus bisa handle JSON or Stream).

    const cacheKey = `rag_cache:${this.calculateTextHash(userMessage + JSON.stringify(conversationHistory.slice(-2)))}`;

    try {
      // ✅ Cache Check (Redis)
      const cachedResponse = await redisService.get(cacheKey);
      if (cachedResponse) {
        // console.log('⚡ [CACHE] Cache Hit!');
        // Jika minta stream tapi ada cache, sebaiknya kita tetap return JSON saja 
        // karena frontend harusnya hybrid. Tapi jika strict stream, kita kirim text langsung.
        return JSON.parse(cachedResponse);
      }

      if (abortSignal?.aborted) throw new Error('AbortError');

      // 2. Search
      const relevantDocs = await this.searchRelevantDocs(userMessage, conversationHistory, options.category, abortSignal);
      const contextString = this.compileContext(relevantDocs);

      // 3. Generate Answer (Streaming or Promise)
      const aiResult = await openaiService.generateAIResponse(
        userMessage,
        conversationHistory,
        contextString,
        { ...options, forceContextUsage: relevantDocs.length > 0, stream: stream }
      );

      // A. Jika Streaming, return stream object langsung
      if (stream) {
        return {
          isStream: true,
          stream: aiResult, // Ini adalah AsyncIterable
          docsDetail: relevantDocs.map(d => ({ title: d.payload.title, score: d.score })),
          cacheKey: cacheKey // User harus cache sendiri nanti setelah stream selesai (di controller)
        };
      }

      // B. Jika Regular (JSON)
      const genTime = ((Date.now() - startTotal) / 1000).toFixed(2);

      const response = {
        answer: aiResult.content,
        usage: aiResult.usage,
        docsFound: relevantDocs.length,
        docsDetail: relevantDocs.map(d => ({ title: d.payload.title, score: d.score })),
        metrics: { totalTime: genTime, genTime: genTime } // Compatibility: genTime ~= totalTime for now
      };

      // Store Cache (Background)
      await redisService.set(cacheKey, response, CACHE_TTL_SECONDS);

      return response;

    } catch (error) {
      console.error('❌ [RAG] Answer Process Error:', error.message);
      throw error;
    }
  }

  // =============================================================================
  // UTILS & SETUP
  // =============================================================================

  calculateTextHash(text) {
    const normalized = text.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim().substring(0, 300);
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  generateDeterministicId(text) {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20)}`;
  }

  async ensureCollection() {
    try {
      const result = await client.getCollections();
      if (!result.collections.some(c => c.name === COLLECTION_NAME)) {
        await client.createCollection(COLLECTION_NAME, {
          vectors: { size: VECTOR_SIZE, distance: 'Cosine' }
        });
        console.log(`✅ [RAG] Collection '${COLLECTION_NAME}' created.`);
      }
    } catch (error) {
      console.error('❌ [RAG] Qdrant Connect Error:', error.message);
    }
  }

  async deleteCollection() { try { await client.deleteCollection(COLLECTION_NAME); } catch { } }

  // =============================================================================
  // 5. INGESTION (DATA LOADING)
  // =============================================================================

  async ingestData() {
    // ... (Ingestion logic kept same but simplified logging if needed)
    console.log('🔄 [RAG] Ingestion Start...');

    await this.deleteCollection();
    await new Promise(r => setTimeout(r, 1000));
    await this.ensureCollection();

    const dataDir = path.join(__dirname, '../../data');

    if (!fs.existsSync(dataDir)) {
      return { success: false, message: "Folder data missing" };
    }

    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    let totalCount = 0;

    for (const file of files) {
      try {
        const rawData = fs.readFileSync(path.join(dataDir, file), 'utf-8');
        const jsonItems = JSON.parse(rawData);
        const points = [];

        for (const item of jsonItems) {
          const rawContent = item.semantic_content || item.text || '';
          const topic = item.topic || 'General Info';
          const keywordStr = item.keywords ? `\n[Keywords: ${item.keywords.join(', ')}]` : '';
          const richText = `[Topik: ${topic}]${keywordStr}\n${rawContent}`;

          if (richText.length < 15) continue;

          const vector = await openaiService.createEmbedding(richText);

          points.push({
            id: this.generateDeterministicId(item.id || richText),
            vector: vector,
            payload: {
              text: richText,
              title: topic,
              source_file: file,
              category: item.category || 'general'
            }
          });
          totalCount++;
        }

        if (points.length > 0) {
          await client.upsert(COLLECTION_NAME, { points });
        }
      } catch (e) {
        console.error(`❌ Error processing file ${file}:`, e.message);
      }
    }

    console.log(`✅ [RAG] Ingestion complete. Total Vectors: ${totalCount}`);
    return { success: true, count: totalCount };
  }
}

module.exports = new RagService();