const { QdrantClient } = require('@qdrant/js-client-rest');
const openaiService = require('./openaiService'); 
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

const MAX_CONTEXT_CHARS = 2500; 
const SCORE_THRESHOLD = 0.30;   

const client = new QdrantClient({ host: QDRANT_HOST, port: QDRANT_PORT });

class RagService {
  constructor() {
    this.ensureCollection();
  }

  // =============================================================================
  // 1. QUERY OPTIMIZATION (THE BRAIN) 🧠 - HYBRID MODE
  // =============================================================================

  async generateSearchQueries(userQuery, history = []) {
    try {
      const finalQueries = new Set();
      const cleanQuery = userQuery.toLowerCase().trim();
      
      // --- LOGIC: CONTEXT INJECTION (FAST & STABLE) ⚡ ---
      // Daripada panggil AI Refiner (yang lama & bisa timeout), kita pakai Logic Kode.
      // Jika pertanyaan pendek/ambigu DAN ada history, GABUNGKAN dengan pertanyaan sebelumnya.
      
      let contextAdded = false;

      if (history.length > 0) {
          // Ambil pertanyaan user terakhir dari history
          const lastUserMessage = history.find(m => m.role === 'user')?.content || "";
          
          // Deteksi pertanyaan ambigu (contoh: "Dalilnya?", "Lokasinya dimana?", "Syaratnya?")
          const isShort = cleanQuery.split(' ').length < 6; // Kurang dari 6 kata
          const triggers = ['nya', 'itu', 'tersebut', 'tadi', 'ini', 'dia', 'beliau', 'dimana', 'berapa', 'kapan'];
          const hasTrigger = triggers.some(w => cleanQuery.includes(w));

          if ((isShort || hasTrigger) && lastUserMessage.length > 2) {
              // ⚡ SPEED HACK: Gabungkan String (Instant, 0ms)
              // Contoh: "Dalilnya ada ga?" + "Apa itu Ijarah?" 
              // Menjadi: "Dalilnya ada ga? Apa itu Ijarah?"
              // Vector DB akan otomatis menangkap konteks "Ijarah".
              const combinedQuery = `${userQuery} ${lastUserMessage}`;
              
              console.log(`🔗 [CONTEXT FIX] Combined Query: "${combinedQuery}"`);
              finalQueries.add(combinedQuery);
              contextAdded = true;
          }
      }

      // Selalu masukkan query asli juga sebagai cadangan
      finalQueries.add(userQuery);

      // Manual Expansion (Hardcoded Knowledge - Instant)
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

  // Fungsi Manual: Hardcoded knowledge
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
    if (cleanQuery.includes('murabahah') && (cleanQuery.includes('harga') || cleanQuery.includes('jual'))) {
      expanded.push('mekanisme penetapan harga murabahah');
      expanded.push('definisi margin keuntungan murabahah');
    }
    return expanded;
  }

  // =============================================================================
  // 2. SEARCH ENGINE (PARALLEL EXECUTION) 🚀
  // =============================================================================

  async searchRelevantDocs(userQuery, history = []) {
    const startSearchTotal = Date.now();
    try {
      const queries = await this.generateSearchQueries(userQuery, history);
      let allCandidates = [];

      console.log('🔍 [RAG] Executing Parallel Vector Search...');
      const startVector = Date.now();

      const searchPromises = queries.map(async (q) => {
        try {
          const vector = await openaiService.createEmbedding(q);
          const result = await client.search(COLLECTION_NAME, {
            vector: vector,
            limit: 3, 
            with_payload: true,
            score_threshold: SCORE_THRESHOLD,
          });
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

      // Deduplication
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

      const finalDocs = Array.from(uniqueDocs.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); 

      if (finalDocs.length > 0) {
        console.log(`📄 [RAG] Found ${finalDocs.length} unique docs. Total Retrieval Time: ${(Date.now() - startSearchTotal)}ms`);
        finalDocs.forEach((d, i) => {
          console.log(`   ${i+1}. [Score: ${d.score.toFixed(4)}] ${d.payload.title}`);
        });
      } else {
        console.log('📭 [RAG] No relevant documents found.');
      }

      return finalDocs;

    } catch (error) {
      console.error('❌ [RAG] Retrieval Critical Error:', error.message);
      return [];
    }
  }

  // =============================================================================
  // 3. CONTEXT & ANSWERING
  // =============================================================================

  compileContext(docs) {
    if (!docs || docs.length === 0) return "";
    const contextChunks = [];
    let currentLength = 0;
    for (const doc of docs) {
      const title = doc.payload.title || "Informasi";
      let text = doc.cleanContent || "";
      const formattedChunk = `[[Sumber: ${title}]]\n${text}`;
      if ((currentLength + formattedChunk.length) > MAX_CONTEXT_CHARS) break;
      contextChunks.push(formattedChunk);
      currentLength += formattedChunk.length;
    }
    return contextChunks.join('\n\n---\n\n'); 
  }

  async answerQuestion(userMessage, conversationHistory = []) {
    const startTotal = Date.now();
    try {
      // 1. Fast Path Check untuk Salam/Basa-basi (0ms - Gak usah ke DB)
      if (userMessage.length < 15 && conversationHistory.length === 0) {
         const lower = userMessage.toLowerCase();
         if (['halo', 'hi', 'assalamualaikum', 'pagi', 'tes'].some(w => lower.includes(w))) {
             return { 
                 answer: "Waalaikumsalam! Halo, saya Kia. Ada yang bisa dibantu seputar Tazkia?", 
                 usage: {}, docsFound: 0, metrics: { totalTime: 0.01, genTime: 0 } 
             };
         }
      }
      
      // 2. Search (Using Fast Logic)
      const relevantDocs = await this.searchRelevantDocs(userMessage, conversationHistory);
      const contextString = this.compileContext(relevantDocs);
      
      // 3. Generate Answer
      const options = {
        questionType: 'general',
        forceContextUsage: relevantDocs.length > 0
      };
      
      console.log('🤖 [RAG] Generating Final Answer...');
      const startGen = Date.now();

      const aiResult = await openaiService.generateAIResponse(
        userMessage,
        conversationHistory,
        contextString,
        options
      );

      const genTime = ((Date.now() - startGen) / 1000).toFixed(2);
      const totalTime = ((Date.now() - startTotal) / 1000).toFixed(2);
      
      console.log(`🚀 [Perf] Answer Generated in ${genTime}s. Total Request Time: ${totalTime}s`);

      return {
        answer: aiResult.content,
        usage: aiResult.usage,
        docsFound: relevantDocs.length,
        docsDetail: relevantDocs.map(d => ({ title: d.payload.title, score: d.score })),
        metrics: { totalTime: totalTime, genTime: genTime }
      };

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
    const normalized = text.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim().substring(0, 200);
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

  async deleteCollection() { try { await client.deleteCollection(COLLECTION_NAME); } catch {} }

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
      } catch(e) { 
          console.error(`❌ Error processing file ${file}:`, e.message); 
      }
    }
    
    console.log(`✅ [RAG] Ingestion complete. Total Vectors: ${totalCount}`);
    return { success: true, count: totalCount };
  }
}

module.exports = new RagService();