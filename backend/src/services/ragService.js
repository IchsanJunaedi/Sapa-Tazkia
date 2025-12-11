const { QdrantClient } = require('@qdrant/js-client-rest');
const openaiService = require('./openaiService'); // Pastikan ini terhubung dengan benar
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * ⚙️ KONFIGURASI RAG SERVICE - PRODUCTION GRADE (HYBRID EDITION)
 */
const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || 6333;
const COLLECTION_NAME = 'sapa_tazkia_knowledge';
const VECTOR_SIZE = 1536;

// Context window besar untuk menampung jawaban multi-topik
const MAX_CONTEXT_CHARS = 3500; 
const SCORE_THRESHOLD = 0.35;

const client = new QdrantClient({ host: QDRANT_HOST, port: QDRANT_PORT });

class RagService {
  constructor() {
    this.ensureCollection();
  }

  // =============================================================================
  // 1. QUERY OPTIMIZATION (THE BRAIN) 🧠 - HYBRID MODE
  // =============================================================================

  /**
   * Menggabungkan kecerdasan AI (Refine) + Aturan Pasti (Manual)
   * Agar sistem tidak hanya pintar tapi juga patuh pada aturan bisnis.
   */
  async generateSearchQueries(userQuery) {
    try {
      console.log(`🧠 [RAG] Generating queries for: "${userQuery}"`);
      
      const finalQueries = new Set();
      
      // 1. Masukkan Query Asli (Wajib)
      finalQueries.add(userQuery);

      // 2. Jalankan Manual Expansion (KODE LAMA KAMU DIPERTAHANKAN & DIPAKAI)
      // Ini penting untuk keyword spesifik seperti 'murabahah' -> 'margin'
      const manualQueries = this.expandQueryManually(userQuery);
      if (manualQueries.length > 0) {
        console.log(`   ↳ 🛠️ Manual Logic added: ${JSON.stringify(manualQueries)}`);
        manualQueries.forEach(q => finalQueries.add(q));
      }

      // 3. Jalankan AI Refinement (UPGRADE BARU)
      // Ini untuk menangani typo parah & multi-intent ("dimana dan prodi apa")
      try {
        const aiQueries = await openaiService.refineQuery(userQuery);
        if (Array.isArray(aiQueries) && aiQueries.length > 0) {
            console.log(`   ↳ 🤖 AI Logic added: ${JSON.stringify(aiQueries)}`);
            aiQueries.forEach(q => finalQueries.add(q));
        }
      } catch (aiError) {
        console.warn('⚠️ [RAG] AI Refiner busy, proceeding with Manual+Raw only.');
      }

      // Konversi Set ke Array & Batasi jumlah agar tidak overload Qdrant (Max 5 query variasi)
      const queryArray = Array.from(finalQueries).slice(0, 5);
      
      console.log(`✅ [RAG] Final Search Queries: ${JSON.stringify(queryArray)}`);
      return queryArray;

    } catch (error) {
      console.warn('⚠️ [RAG] Query Gen Critical Error:', error.message);
      return [userQuery];
    }
  }

  // Fungsi Manual ini SANGAT PENTING dan TIDAK DIHAPUS
  expandQueryManually(query) {
    const normalized = query.toLowerCase().trim();
    const expanded = [];

    // Fix Typo Fatal Manual
    let cleanQuery = normalized.replace(/taozkia|tazkya|taskia/g, 'tazkia');

    // Deteksi Multi-Intent Sederhana
    if (cleanQuery.includes('dimana') || cleanQuery.includes('lokasi') || cleanQuery.includes('alamat')) {
      expanded.push('alamat lengkap lokasi kampus stmik tazkia');
    }
    
    if (cleanQuery.includes('prodi') || cleanQuery.includes('jurusan') || cleanQuery.includes('studi')) {
      expanded.push('daftar program studi jurusan stmik tazkia');
    }

    // Domain Specific Expansion (Bisnis Logic Tazkia)
    if (cleanQuery.includes('murabahah') && (cleanQuery.includes('harga') || cleanQuery.includes('jual'))) {
      expanded.push('mekanisme penetapan harga murabahah');
      expanded.push('definisi margin keuntungan murabahah');
    }

    return expanded;
  }

  // =============================================================================
  // 2. SEARCH ENGINE (PARALLEL EXECUTION) 🚀
  // =============================================================================

  async searchRelevantDocs(userQuery) {
    try {
      // Step 1: Generate Multiple Search Queries (Hybrid: AI + Manual)
      const queries = await this.generateSearchQueries(userQuery);
      
      let allCandidates = [];

      // Step 2: Parallel Search (Mencari dokumen untuk SEMUA variasi query)
      console.log('🔍 [RAG] Executing Parallel Vector Search...');
      const searchPromises = queries.map(async (q) => {
        try {
          const vector = await openaiService.createEmbedding(q);
          const result = await client.search(COLLECTION_NAME, {
            vector: vector,
            limit: 4, // Ambil top 4 per sub-query
            with_payload: true,
            score_threshold: SCORE_THRESHOLD,
          });
          return result;
        } catch (e) {
          console.warn(`⚠️ [RAG] Sub-search failed for "${q}":`, e.message);
          return [];
        }
      });

      const results = await Promise.all(searchPromises);
      
      // Flatten array (Gabungkan semua hasil)
      results.forEach(resArray => allCandidates.push(...resArray));

      // Step 3: Advanced Deduplication
      // Kita pakai Map untuk memastikan tidak ada dokumen kembar (berdasarkan Hash Isi)
      const uniqueDocs = new Map();
      
      for (const item of allCandidates) {
        const content = (item.payload.text || "").trim();
        const title = item.payload.title || "No Title";
        
        // Gunakan Hash Content sebagai kunci unik agar dokumen yg isinya sama persis tidak muncul 2x
        const docId = this.calculateTextHash(content);

        if (uniqueDocs.has(docId)) {
          // Jika duplikat ditemukan, simpan HANYA jika score-nya lebih tinggi (lebih relevan)
          const existing = uniqueDocs.get(docId);
          if (item.score > existing.score) {
            uniqueDocs.set(docId, { ...item, cleanContent: content });
          }
        } else {
          uniqueDocs.set(docId, { ...item, cleanContent: content });
        }
      }

      // Sort by Highest Score & Ambil Top 5 Terbaik
      const finalDocs = Array.from(uniqueDocs.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); 

      // 🔍 DETAILED LOGGING (Untuk Debugging Kamu)
      if (finalDocs.length > 0) {
        console.log(`📄 [RAG] Found ${finalDocs.length} unique relevant documents:`);
        finalDocs.forEach((d, i) => {
          console.log(`   ${i+1}. [Score: ${d.score.toFixed(4)}] ${d.payload.title}`);
          console.log(`      Source: ${d.payload.source_file}`);
        });
      } else {
        console.log('📭 [RAG] No relevant documents found above threshold.');
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
      
      // Format konteks: [Topik] Isi
      const formattedChunk = `[[Sumber: ${title}]]\n${text}`;
      
      if ((currentLength + formattedChunk.length) > MAX_CONTEXT_CHARS) break;
      
      contextChunks.push(formattedChunk);
      currentLength += formattedChunk.length;
    }

    console.log(`🧩 [RAG] Context Compiled: ${contextChunks.length} chunks (${currentLength} chars).`);
    return contextChunks.join('\n\n---\n\n'); 
  }

  async answerQuestion(userMessage, conversationHistory = []) {
    try {
      // 1. Fast Path (Sapaan pendek)
      if (userMessage.length < 4) {
        return { answer: "Halo! Ada yang bisa Kia bantu seputar STMIK Tazkia?", usage: {}, docsFound: 0 };
      }
      
      // 2. Retrieve Docs (Hybrid: AI + Manual)
      const relevantDocs = await this.searchRelevantDocs(userMessage);
      
      // 3. Compile Context
      const contextString = this.compileContext(relevantDocs);
      
      // 4. Generate Answer via OpenAI Service
      const options = {
        questionType: 'general',
        forceContextUsage: relevantDocs.length > 0
      };
      
      const aiResult = await openaiService.generateAIResponse(
        userMessage,
        conversationHistory,
        contextString,
        options
      );

      return {
        answer: aiResult.content,
        usage: aiResult.usage,
        docsFound: relevantDocs.length,
        docsDetail: relevantDocs.map(d => ({ title: d.payload.title, score: d.score }))
      };

    } catch (error) {
      console.error('❌ [RAG] Answer Process Error:', error.message);
      return { answer: "Maaf, Kia sedang mengalami gangguan sistem sebentar.", usage: {}, docsFound: 0 };
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
        console.log(`✅ [RAG] Collection '${COLLECTION_NAME}' ready.`);
      }
    } catch (error) {
      console.error('❌ [RAG] Qdrant Connect Error:', error.message);
    }
  }

  async deleteCollection() {
    try { await client.deleteCollection(COLLECTION_NAME); } catch {}
  }

  // =============================================================================
  // 5. INGESTION (DATA LOADING)
  // =============================================================================

  async ingestData() {
    console.log('🔄 [RAG] Ingestion Start... (Updating Knowledge Base)');
    
    // Reset DB untuk memastikan data bersih
    await this.deleteCollection();
    await new Promise(r => setTimeout(r, 1000)); // Delay aman
    await this.ensureCollection();
    
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) return { success: false, message: "Folder data missing" };
    
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
           
           // Format text embedding agar 'topic' menyatu dengan 'isi'
           const richText = `[Topik: ${topic}]\n${rawContent}`;
           
           if (richText.length < 15) continue; // Skip jika terlalu pendek
           
           // Create embedding
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