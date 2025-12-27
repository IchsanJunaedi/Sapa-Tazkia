const { QdrantClient } = require('@qdrant/js-client-rest');
const openaiService = require('./openaiService');
const redisService = require('./redisService'); // ✅ Added Redis for Caching
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * ⚙️ KONFIGURASI RAG SERVICE - PRODUCTION GRADE (HYBRID EDITION)
 * Project: Sapa Tazkia Chatbot
 */
const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || 6333;
const COLLECTION_NAME = 'sapa_tazkia_knowledge';
const VECTOR_SIZE = 1536;

const MAX_CONTEXT_TOKENS = 800; // ✅ Menggunakan limit TOKEN (estimasi)
const SCORE_THRESHOLD = 0.30;
const CACHE_TTL_SECONDS = 3600 * 6; // 6 Jam Cache

const client = new QdrantClient({ host: QDRANT_HOST, port: QDRANT_PORT });

class RagService {
  constructor() {
    this.ensureCollection();
  }

  // =============================================================================
  // 1. QUERY OPTIMIZATION & SEMANTIC CACHE 🧠
  // =============================================================================

  async generateSearchQueries(userQuery, history = []) {
    try {
      const finalQueries = new Set();
      const cleanQuery = userQuery.toLowerCase().trim();

      // --- LOGIC: CONTEXT INJECTION (FAST & STABLE) ⚡ ---
      let contextAdded = false;

      if (history.length > 0) {
        // ✅ FIX: Ambil pesan user TERAKHIR (bukan yang pertama)
        const lastUserMessage = [...history].reverse().find(m => m.role === 'user')?.content || "";

        const isShort = cleanQuery.split(' ').length < 6;
        const triggers = ['nya', 'itu', 'tersebut', 'tadi', 'ini', 'dia', 'beliau', 'dimana', 'berapa', 'kapan', 'dalil', 'hukum'];
        const hasTrigger = triggers.some(w => cleanQuery.includes(w));

        if ((isShort || hasTrigger) && lastUserMessage.length > 2) {
          const combinedQuery = `${userQuery} ${lastUserMessage}`;
          console.log(`🔗 [CONTEXT FIX] Combined Query: "${combinedQuery}"`);
          finalQueries.add(combinedQuery);
          contextAdded = true;

          // 💡 Jika query sangat pendek (seperti "dalilnya?"), 
          // JANGAN masukkan query aslinya ke pencarian agar tidak "nyasar" ke dokumen lain.
          if (cleanQuery.split(' ').length <= 2) {
            console.log(`🚫 [RAG] Skipping raw ambiguous query: "${userQuery}"`);
          } else {
            finalQueries.add(userQuery);
          }
        } else {
          finalQueries.add(userQuery);
        }
      } else {
        finalQueries.add(userQuery);
      }

      const manualQueries = this.expandQueryManually(userQuery);
      if (manualQueries.length > 0) manualQueries.forEach(q => finalQueries.add(q));

      const queryArray = Array.from(finalQueries).slice(0, 4);
      console.log(`✅ [RAG] Queries Ready: ${JSON.stringify(queryArray)}`);
      return queryArray;

    } catch (error) {
      console.warn('⚠️ [RAG] Query Gen Critical Error:', error.message);
      return [userQuery];
    }
  }

  expandQueryManually(query) {
    const normalized = query.toLowerCase().trim();
    const expanded = [];
    let cleanQuery = normalized.replace(/taozkia|tazkya|taskia/g, 'tazkia');

    if (cleanQuery.includes('dimana') || cleanQuery.includes('lokasi') || cleanQuery.includes('alamat')) {
      expanded.push('alamat lengkap lokasi kampus stmik tazkia sentul');
    }
    if (cleanQuery.includes('prodi') || cleanQuery.includes('jurusan') || cleanQuery.includes('studi')) {
      expanded.push('daftar program studi jurusan stmik tazkia');
    }
    return expanded;
  }

  // =============================================================================
  // 2. SEARCH ENGINE (HYBRID & RE-RANKING) 🚀
  // =============================================================================

  async searchRelevantDocs(userQuery, history = [], category = null, abortSignal = null) {
    const startSearchTotal = Date.now();
    try {
      const queries = await this.generateSearchQueries(userQuery, history);
      let allCandidates = [];

      console.log('🔍 [RAG] Executing Parallel Vector Search...');
      const startVector = Date.now();

      // ✅ optimization: Embedding Cost Check
      // Jika queries mirip satu sama lain, skip embedding redundan
      const uniqueQueries = Array.from(new Set(queries));

      const searchPromises = uniqueQueries.map(async (q) => {
        // ✅ Cek Abort mid-loop
        if (abortSignal?.aborted) throw new Error('AbortError');

        try {
          const vector = await openaiService.createEmbedding(q);

          // ✅ Hybrid Search logic: Vector + Filter Metadata
          const searchOptions = {
            vector: vector,
            limit: 5,
            with_payload: true,
            score_threshold: SCORE_THRESHOLD,
          };

          // Tambahkan filtering berdasarkan kategori jika tersedia
          if (category) {
            searchOptions.filter = {
              must: [{ key: "category", match: { value: category } }]
            };
          }

          const result = await client.search(COLLECTION_NAME, searchOptions);
          return result;
        } catch (e) {
          console.warn(`⚠️ [RAG] Sub-search failed for "${q}":`, e.message);
          return [];
        }
      });

      const results = await Promise.allSettled(searchPromises);
      console.log(`⏱️ [Perf] Vector DB Search completed in ${(Date.now() - startVector)}ms`);

      results.forEach(res => {
        if (res.status === 'fulfilled') {
          allCandidates.push(...res.value);
        }
      });

      // Deduplication & Initial Scoring
      const uniqueDocs = new Map();
      for (const item of allCandidates) {
        const content = (item.payload.text || "").trim();
        const docId = this.calculateTextHash(content);

        if (uniqueDocs.has(docId)) {
          const existing = uniqueDocs.get(docId);
          if (item.score > existing.score) {
            uniqueDocs.set(docId, { ...item, cleanContent: content });
          }
        } else {
          uniqueDocs.set(docId, { ...item, cleanContent: content });
        }
      }

      // ✅ RE-RANKING LAYER: Simple Keyword Score Boost
      const finalDocs = Array.from(uniqueDocs.values())
        .map(doc => {
          let rerankScore = doc.score;
          // Boost jika judul atau konten mengandung kata yang sama persis dengan query
          const words = userQuery.toLowerCase().split(' ');
          words.forEach(word => {
            if (word.length > 3) {
              if (doc.payload.title?.toLowerCase().includes(word)) rerankScore += 0.05;
              if (doc.cleanContent?.toLowerCase().includes(word)) rerankScore += 0.02;
            }
          });
          return { ...doc, rerankScore };
        })
        .sort((a, b) => b.rerankScore - a.rerankScore)
        .slice(0, 5);

      if (finalDocs.length > 0) {
        console.log(`📄 [RAG] Found ${finalDocs.length} unique docs. Total Retrieval Time: ${(Date.now() - startSearchTotal)}ms`);
        finalDocs.forEach((d, i) => {
          console.log(`   ${i + 1}. [Rerank Score: ${d.rerankScore.toFixed(4)}] ${d.payload.title}`);
        });
      }

      return finalDocs;

    } catch (error) {
      console.error('❌ [RAG] Retrieval Critical Error:', error.message);
      return [];
    }
  }

  // =============================================================================
  // 3. CONTEXT & ANSWERING (WITH SEMANTIC CACHE)
  // =============================================================================

  compileContext(docs) {
    if (!docs || docs.length === 0) return "";
    const contextChunks = [];
    let currentTokens = 0;

    for (const doc of docs) {
      const title = doc.payload.title || "Informasi";
      let text = doc.cleanContent || "";
      const formattedChunk = `[[Sumber: ${title}]]\n${text}`;

      // ✅ Estimasi Token (Chars / 4)
      const estimatedTokens = formattedChunk.length / 4;
      if ((currentTokens + estimatedTokens) > MAX_CONTEXT_TOKENS) break;

      contextChunks.push(formattedChunk);
      currentTokens += estimatedTokens;
    }
    return contextChunks.join('\n\n---\n\n');
  }

  async answerQuestion(userMessage, conversationHistory = [], options = {}) {
    const startTotal = Date.now();
    const cacheKey = `rag_cache:${this.calculateTextHash(userMessage + JSON.stringify(conversationHistory.slice(-2)))}`;

    try {
      // ✅ 1. Semantic Cache Check (Redis)
      const cachedResponse = await redisService.get(cacheKey);
      if (cachedResponse) {
        console.log('⚡ [CACHE] Cache Hit! Returning stored answer.');
        return JSON.parse(cachedResponse);
      }

      // ✅ ABORT CHECK 1
      if (options.abortSignal?.aborted) throw new Error('AbortError');

      // 2. Fast Path Check untuk Salam/Basa-basi
      if (userMessage.length < 15 && conversationHistory.length === 0) {
        const lower = userMessage.toLowerCase();
        if (['halo', 'hi', 'assalamualaikum', 'pagi', 'tes'].some(w => lower.includes(w))) {
          return {
            answer: "Waalaikumsalam! Halo, saya Kia. Ada yang bisa dibantu seputar Tazkia?",
            usage: {}, docsFound: 0, metrics: { totalTime: 0.01, genTime: 0 }
          };
        }
      }

      // 3. Search (With Category Filtering if provided)
      const relevantDocs = await this.searchRelevantDocs(userMessage, conversationHistory, options.category, options.abortSignal);

      // ✅ ABORT CHECK 2
      if (options.abortSignal?.aborted) throw new Error('AbortError');

      const contextString = this.compileContext(relevantDocs);

      // 4. Generate Answer
      const startGen = Date.now();
      const aiResult = await openaiService.generateAIResponse(
        userMessage,
        conversationHistory,
        contextString,
        { ...options, forceContextUsage: relevantDocs.length > 0 }
      );

      const genTime = ((Date.now() - startGen) / 1000).toFixed(2);
      const totalTime = ((Date.now() - startTotal) / 1000).toFixed(2);

      const response = {
        answer: aiResult.content,
        usage: aiResult.usage,
        docsFound: relevantDocs.length,
        docsDetail: relevantDocs.map(d => ({ title: d.payload.title, score: d.score })),
        metrics: { totalTime: totalTime, genTime: (totalTime - (Date.now() - startTotal) / 1000).toFixed(2) } // Approximate
      };

      // ✅ Store in Cache
      await redisService.set(cacheKey, response, CACHE_TTL_SECONDS);

      return response;

    } catch (error) {
      console.error('❌ [RAG] Answer Process Error:', error.message);
      return {
        answer: "Mohon maaf, sistem Sapa Tazkia sedang mengalami gangguan teknis.",
        usage: {},
        docsFound: 0
      };
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
  // 5. INGESTION (DATA LOADING - ORIGINAL LOGIC PRESERVED)
  // =============================================================================

  async ingestData() {
    console.log('🔄 [RAG] Ingestion Start... (Updating Knowledge Base)');

    await this.deleteCollection();
    await new Promise(r => setTimeout(r, 1000));
    await this.ensureCollection();

    const dataDir = path.join(__dirname, '../../data');

    if (!fs.existsSync(dataDir)) {
      console.error(`❌ [RAG] Data directory not found at: ${dataDir}`);
      return { success: false, message: "Folder data missing" };
    }

    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    let totalCount = 0;

    for (const file of files) {
      try {
        const rawData = fs.readFileSync(path.join(dataDir, file), 'utf-8');
        const jsonItems = JSON.parse(rawData);
        console.log(`📥 Processing ${file}: ${jsonItems.length} items`);

        const points = [];

        for (const item of jsonItems) {
          const rawContent = item.semantic_content || item.text || '';
          const topic = item.topic || 'General Info';

          // Format text embedding agar 'topic' menyatu dengan 'isi' plus KEYWORDS
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