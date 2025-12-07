const { QdrantClient } = require('@qdrant/js-client-rest');
const openaiService = require('./openaiService');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * KONFIGURASI RAG SERVICE - OPTIMIZED VERSION
 */
const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || 6333;
const COLLECTION_NAME = 'sapa_tazkia_knowledge';
const VECTOR_SIZE = 1536;

const MAX_CONTEXT_CHARS = 2000; // Lebih ringkas agar AI fokus ke inti
const FALLBACK_THRESHOLD = 0.30;
const client = new QdrantClient({ host: QDRANT_HOST, port: QDRANT_PORT });

class RagService {
  constructor() {
    this.ensureCollection();
  }

  // =============================================================================
  // 1. QUERY EXPANSION (DIPERTAHANKAN & DITUNING)
  // =============================================================================

  expandQueryWithTypos(query) {
    const normalized = query.toLowerCase().trim();
    const expandedQueries = new Set([normalized]);
    
    // Tweak: Fokuskan ekspansi Murabahah ke 'definisi' dan 'mekanisme' 
    // agar mendapat chunk JSON yang tepat.
    if (normalized.includes('murabahah')) {
      if (normalized.includes('harga') || normalized.includes('jual')) {
        expandedQueries.add(`mekanisme penetapan harga murabahah`);
        expandedQueries.add(`definisi margin keuntungan murabahah`);
      }
    }
    
    // Keyword mapping tetap dipertahankan...
    const keywords = {
      'biaya': 'biaya kuliah ukt',
      'ukt': 'biaya kuliah ukt',
      'lokasi': 'alamat kampus sentul dramaga',
      'alamat': 'alamat kampus sentul dramaga',
      'prodi': 'program studi jurusan',
    };

    Object.keys(keywords).forEach(key => {
      if (normalized.includes(key)) expandedQueries.add(keywords[key]);
    });

    return Array.from(expandedQueries).slice(0, 3);
  }

  async ensureCollection() {
    try {
      const result = await client.getCollections();
      if (!result.collections.some(c => c.name === COLLECTION_NAME)) {
        await client.createCollection(COLLECTION_NAME, { 
          vectors: { size: VECTOR_SIZE, distance: 'Cosine' } 
        });
      }
    } catch (error) {
      console.error('❌ [RAG] Qdrant Connection Error:', error.message);
    }
  }

  // =============================================================================
  // 2. SEARCH & RETRIEVAL (OPTIMIZED)
  // Logic deduplikasi dipertahankan karena sudah bagus (Engineered well)
  // =============================================================================

  calculateTextHash(text) {
    const normalized = text.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim().substring(0, 200);
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  async searchRelevantDocs(query) {
    try {
      // Logic search tetap sama, hanya threshold dituning sedikit
      const expandedQueries = this.expandQueryWithTypos(query);
      let allCandidates = [];
      
      for (const expandedQuery of expandedQueries.slice(0, 2)) {
        try {
          const queryVector = await openaiService.createEmbedding(expandedQuery);
          const searchResult = await client.search(COLLECTION_NAME, {
            vector: queryVector,
            limit: 5, // Cukup 5, kualitas lebih penting dari kuantitas
            with_payload: true,
            score_threshold: 0.35, // Strict threshold
          });

          allCandidates.push(...searchResult.map(res => ({
            ...res,
            cleanContent: (res.payload.text || "").trim()
          })));
        } catch (e) {
          console.warn(`⚠️ [RAG] Search warn:`, e.message);
        }
      }

      // Simple deduplication based on ID/Hash to keep it fast
      const uniqueMap = new Map();
      allCandidates.forEach(item => {
        // Gunakan payload.title + cleanContent hash sebagai key unik
        const key = item.payload.title + this.calculateTextHash(item.cleanContent);
        if (!uniqueMap.has(key)) uniqueMap.set(key, item);
      });
      
      const uniqueCandidates = Array.from(uniqueMap.values());

      // Reranking simple (Sort by score)
      return uniqueCandidates.sort((a, b) => b.score - a.score).slice(0, 3);

    } catch (error) {
      console.error('❌ [RAG] Retrieval Error:', error.message);
      return [];
    }
  }

  // =============================================================================
  // 3. CONTEXT COMPILATION (MAJOR REFACTOR)
  // Hapus instruksi prompt di sini agar tidak konflik dengan OpenAI Service
  // =============================================================================

  compileContext(docs) {
    if (!docs || docs.length === 0) return "";
    
    const cleanDocs = [];
    let currentLength = 0;

    for (const doc of docs) {
      // Ambil text yang sudah diperkaya dengan topic di step Ingestion
      let text = doc.payload.text || "";
      
      // Bersihkan format berlebih, tapi JANGAN hapus informasi Topik
      text = text.replace(/\n+/g, '\n').trim();

      if ((currentLength + text.length) > MAX_CONTEXT_CHARS) break;
      
      cleanDocs.push(text);
      currentLength += text.length;
    }

    // OUTPUT MURNI DATA. Tidak ada "Instruksi: Jawab blabla".
    // Biarkan openaiService.js yang mengatur gaya bicaranya.
    return cleanDocs.join('\n\n###\n\n'); 
  }

  // =============================================================================
  // 4. MAIN ANSWERING FUNCTION
  // =============================================================================

  async answerQuestion(userMessage, conversationHistory = []) {
    try {
      // 1. Fast Path untuk pertanyaan sangat pendek (sapaan dll)
      if (userMessage.length < 5) {
        return { answer: "Halo! Ada yang bisa Kia bantu?", usage: {}, docsFound: 0 };
      }
      
      // 2. Retrieve Docs
      const relevantDocs = await this.searchRelevantDocs(userMessage);
      
      // 3. Compile Context (Clean Data Only)
      const contextString = this.compileContext(relevantDocs);
      
      // 4. Generate Answer via OpenAI Service
      const options = {
        questionType: 'general',
        forceContextUsage: relevantDocs.length > 0
      };
      
      const aiResult = await openaiService.generateAIResponse(
        userMessage,
        conversationHistory,
        contextString, // Context murni
        options
      );

      return {
        answer: aiResult.content,
        usage: aiResult.usage,
        docsFound: relevantDocs.length
      };

    } catch (error) {
      console.error('❌ [RAG] Answer Error:', error.message);
      return { answer: "Maaf, sistem sedang sibuk.", usage: {}, docsFound: 0 };
    }
  }

  // =============================================================================
  // 5. INGESTION (DI-OPTIMASI UNTUK JSON)
  // Kita perbaiki cara embedding teks agar Topic menyatu dengan Content
  // =============================================================================

  generateDeterministicId(text) {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20)}`;
  }

  async ingestData() {
    console.log('🔄 [RAG] Resetting DB & Ingesting JSON Data...');
    await this.deleteCollection();
    await new Promise(r => setTimeout(r, 1000));
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
          // 🔥 OPTIMISASI UTAMA: Gabungkan Topic + Semantic Content
          // Ini agar saat search "Apa itu murabahah", chunk ini punya bobot semantic tinggi
          const rawContent = item.semantic_content || item.text || '';
          const topic = item.topic || 'General Info';
          
          // Format text yang akan di-embed dan disimpan
          // Kita beri label jelas agar AI di openaiService paham ini bagian apa
          const richText = `[Topik: ${topic}]\n${rawContent}`;
          
          if (richText.length < 20) continue;

          const vector = await openaiService.createEmbedding(richText);
          const pointId = this.generateDeterministicId(item.id || richText);
          
          points.push({
            id: pointId,
            vector: vector,
            payload: {
              text: richText, // Simpan teks yang sudah diperkaya
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
        console.error(`❌ Error file ${file}:`, e.message);
      }
    }
    
    console.log(`✅ [RAG] Ingestion complete: ${totalCount} points`);
    return { success: true, count: totalCount };
  }

  async deleteCollection() {
    try { await client.deleteCollection(COLLECTION_NAME); } catch {}
  }
}

module.exports = new RagService();