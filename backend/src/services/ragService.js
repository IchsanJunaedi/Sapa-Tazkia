const { QdrantClient } = require('@qdrant/js-client-rest');
const openaiService = require('./openaiService');
const fs = require('fs');
const path = require('path');
const expansionConfig = require('../config/queryExpansionConfig');

/**
 * KONFIGURASI RAG SERVICE
 */
const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || 6333;
const COLLECTION_NAME = 'sapa_tazkia_knowledge';
const VECTOR_SIZE = 1536;

// ✅ OPTIMISASI: Limit Chunking yang Lebih Ketat (Hemat Token)
const MAX_CHUNK_SIZE = 800;  // Maksimal karakter per chunk (±200 token)
const CHUNK_OVERLAP = 100;   // Overlap agar konteks tidak terputus
const MAX_CONTEXT_CHARS = 3500; // Batas total konteks ke AI (±900 token)

// Threshold adaptive
const getAdaptiveThreshold = (query) => {
  if (query.length < 10) return 0.35;
  if (query.length < 20) return 0.40;  
  if (query.length < 30) return 0.45;
  return 0.50;
};

const FALLBACK_THRESHOLD = 0.30; 
const TOP_K_DOCS = 15;

const client = new QdrantClient({ host: QDRANT_HOST, port: QDRANT_PORT });

class RagService {
  
  constructor() {
    this.ensureCollection();
  }

  // =============================================================================
  // 1. QUERY EXPANSION
  // =============================================================================

  expandQueryWithTypos(query) {
    const normalized = query.toLowerCase().trim();
    const expandedQueries = new Set();
    
    // 1. Original query
    expandedQueries.add(normalized);
    
    // 2. Syariah specific
    this.addSyariahSpecificExpansions(normalized, expandedQueries);
    
    // 3. Indonesian specific
    this.addIndonesianSpecificExpansions(normalized, expandedQueries);
    
    // 4. Keywords
    const words = normalized.split(' ').filter(word => word.length > 3);
    if (words.length > 0) expandedQueries.add(words.join(' '));

    // 5. Smart Surah Extraction
    const surahRegex = /(?:qs\.?|surat|surah)\s+([a-z'-]+)(?:\s*(?:\[\d+\]|ayat|no|nomor)?\s*[:]?\s*(\d+))?/i;
    const match = normalized.match(surahRegex);
    
    if (match) {
      const surahName = match[1].replace(/['`]/g, ''); 
      const verseNo = match[2];
      expandedQueries.add(surahName);
      expandedQueries.add(`surat ${surahName}`);
      if (verseNo) {
        expandedQueries.add(`${surahName} ${verseNo}`);
        expandedQueries.add(`surat ${surahName} ayat ${verseNo}`);
      }
    }

    return this.prioritizeExpandedQueries(Array.from(expandedQueries));
  }

  addSyariahSpecificExpansions(query, expandedQueries) {
    const syariahTerms = {
      'feb': ['fakultas ekonomi bisnis syariah', 'febs tazkia', 'prodi ekonomi syariah'],
      'febs': ['fakultas ekonomi bisnis syariah', 'jurusan ekonomi', 'akuntansi syariah'],
      'hukum': ['fakultas hukum', 'prodi hukum ekonomi syariah', 'hes'],
      'humaniora': ['fakultas humaniora', 'komunikasi penyiaran islam', 'pendidikan'],
      'mudarabah': ['pengertian mudarabah', 'fatwa mudarabah', 'bagi hasil'],
      'beasiswa': ['info beasiswa', 'syarat beasiswa', 'potongan biaya']
    };

    Object.keys(syariahTerms).forEach(term => {
      if (query.includes(term)) {
        syariahTerms[term].forEach(exp => expandedQueries.add(exp));
      }
    });
  }

  addIndonesianSpecificExpansions(query, expandedQueries) {
    if (query.includes('dimana') || query.includes('lokasi')) expandedQueries.add('alamat kampus tazkia sentul');
    if (query.includes('ekonomi') || query.includes('bisnis')) {
      expandedQueries.add('fakultas ekonomi bisnis syariah febs');
      expandedQueries.add('program studi akuntansi syariah');
    }
    // Tambahan untuk fasilitas
    if (query.includes('fasilitas') || query.includes('sarana')) {
      expandedQueries.add('fasilitas gedung kampus asrama perpustakaan');
    }
  }

  prioritizeExpandedQueries(queries) {
    return queries.sort((a, b) => {
      const hasNumberA = /\d+/.test(a);
      const hasNumberB = /\d+/.test(b);
      if (hasNumberA && !hasNumberB) return -1;
      if (!hasNumberA && hasNumberB) return 1;
      
      const scoreA = (a.includes('fakultas') ? 2 : 0) + (a.includes('syariah') ? 1 : 0);
      const scoreB = (b.includes('fakultas') ? 2 : 0) + (b.includes('syariah') ? 1 : 0);
      return scoreB - scoreA;
    }).slice(0, 8);
  }

  async ensureCollection() {
    try {
      const result = await client.getCollections();
      const exists = result.collections.some(c => c.name === COLLECTION_NAME);
      if (!exists) {
        await client.createCollection(COLLECTION_NAME, {
          vectors: { size: VECTOR_SIZE, distance: 'Cosine' }
        });
      }
    } catch (error) {
      console.error('❌ [RAG] Qdrant Connection Error:', error.message);
    }
  }

  // =============================================================================
  // 2. SEARCH & RETRIEVAL
  // =============================================================================

  async searchRelevantDocs(query) {
    try {
      console.log(`🔍 [RAG] Original query: "${query}"`);
      
      const adaptiveThreshold = getAdaptiveThreshold(query);
      const expandedQueries = this.expandQueryWithTypos(query);
      
      let allCandidates = [];
      const seenPayloads = new Set(); 
      const isVerseQuery = /\d+/.test(query) && /(?:qs|surat)/i.test(query);
      const searchLimit = isVerseQuery ? 10 : 5;

      // Limit expansion agar tidak terlalu lama
      const searchQueries = expandedQueries.slice(0, 4);

      for (const expandedQuery of searchQueries) {
        try {
          const queryVector = await openaiService.createEmbedding(expandedQuery);
          const searchResult = await client.search(COLLECTION_NAME, {
            vector: queryVector,
            limit: searchLimit, 
            with_payload: true,
            score_threshold: adaptiveThreshold
          });

          for (const res of searchResult) {
            const contentHash = res.payload.text.substring(0, 50); 
            if (!seenPayloads.has(contentHash)) {
              seenPayloads.add(contentHash);
              allCandidates.push({ ...res, searchQueryUsed: expandedQuery });
            }
          }
        } catch (e) { /* ignore */ }
      }

      if (allCandidates.length === 0) {
        console.log(`🔎 [RAG] Fallback search...`);
        const fallbackVector = await openaiService.createEmbedding(query);
        const fallbackRes = await client.search(COLLECTION_NAME, {
          vector: fallbackVector,
          limit: 5,
          with_payload: true,
          score_threshold: FALLBACK_THRESHOLD
        });
        allCandidates = fallbackRes;
      }

      // Ambil 3 Dokumen terbaik saja
      const finalResults = await this.rerankResults(query, allCandidates, 3);

      if (finalResults.length > 0) {
        console.log(`📄 [RAG] Dokumen terpilih (${finalResults.length}):`);
        finalResults.forEach((r, i) => {
          console.log(`   ${i+1}. [${r.payload.source_file}] Score: ${r.rerankScore.toFixed(3)}`);
        });
      }

      return finalResults.map(res => ({
        text: res.payload.text,
        score: res.score,
        source: res.payload.source_file,
        type: res.payload.chunk_type
      }));

    } catch (error) {
      console.error('❌ [RAG] Retrieval Error:', error);
      return [];
    }
  }

  normalizeString(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[\[\]:;'"\(\)]/g, '').replace(/\s+/g, ' ').trim();
  }

  async rerankResults(query, searchResults, topN = 3) {
    const queryLower = this.normalizeString(query); 
    const questionType = this.detectQuestionType(query);

    const surahRegex = /(?:qs\.?|surat|surah)\s+([a-z-]+)/i;
    const surahMatch = queryLower.match(surahRegex);
    const requestedSurah = surahMatch ? surahMatch[1] : null; 
    const verseMatch = query.match(/:\s*(\d+)/) || query.match(/\s(\d+)$/) || query.match(/\[(\d+)\]/);
    const requestedVerse = verseMatch ? verseMatch[1] : null;

    const reranked = searchResults.map(result => {
      let score = result.score * 0.5; 
      const payload = result.payload;
      const filename = payload.source_file ? payload.source_file.toLowerCase() : '';
      const titleClean = this.normalizeString(payload.title);
      const contentClean = this.normalizeString(payload.text);

      // 1. Citation Boosting
      if (requestedSurah) {
        if (titleClean.includes(requestedSurah) || contentClean.includes(requestedSurah)) {
          score += 0.40; 
          if (requestedVerse && (titleClean.includes(requestedVerse) || contentClean.includes(` ${requestedVerse} `) || contentClean.includes(`:${requestedVerse}`))) {
            score += 0.30; 
          }
        }
      }

      // 2. Filename Boosting
      if (queryLower.includes('ekonomi') || queryLower.includes('feb')) {
        if (filename.includes('febs') || filename.includes('ekonomi')) score += 0.25;
      }
      if (queryLower.includes('hukum') && (filename.includes('hukum') || filename.includes('syariah'))) score += 0.20;
      if (queryLower.includes('pendidikan') && filename.includes('humaniora')) score += 0.20;
      if (queryLower.includes('fasilitas') && (contentClean.includes('gedung') || contentClean.includes('asrama'))) score += 0.15;

      // 3. Chunk Type Match
      if (payload.chunk_type === questionType) score += 0.10;

      return { ...result, rerankScore: parseFloat(score.toFixed(3)) };
    });

    return reranked.sort((a, b) => b.rerankScore - a.rerankScore).slice(0, topN);
  }

  // =============================================================================
  // 3. CONTEXT & ANSWERING (STRICT LIMIT)
  // =============================================================================

  compileContext(docs) {
    if (!docs || docs.length === 0) return null;
    
    // ✅ STRICT LIMIT: Hanya ambil 3500 karakter (±900 token)
    const MAX_CHARS = MAX_CONTEXT_CHARS; 
    let currentLength = 0;
    const selectedDocs = [];

    for (const doc of docs) {
        if (currentLength + doc.text.length > MAX_CHARS) {
            // Jika dokumen ini bikin overflow, potong dia agar pas
            const remainingSpace = MAX_CHARS - currentLength;
            if (remainingSpace > 200) { // Kalau masih ada sisa cukup banyak, ambil potongannya
                selectedDocs.push({
                    ...doc,
                    text: doc.text.substring(0, remainingSpace) + "...(lanjutan dipotong)"
                });
            }
            break;
        }
        selectedDocs.push(doc);
        currentLength += doc.text.length;
    }

    const contextSections = selectedDocs.map((doc, index) => {
      return `[SUMBER ${index + 1}: ${doc.source}]\n${doc.text}`;
    });
    
    return "BERIKUT ADALAH DATA FAKTA:\n\n" + contextSections.join("\n\n---\n\n");
  }

  async answerQuestion(userMessage, conversationHistory = [], options = {}) {
    try {
      const startTime = performance.now();
      const relevantDocs = await this.searchRelevantDocs(userMessage);
      const contextString = this.compileContext(relevantDocs);
      const questionType = this.detectQuestionType(userMessage);
      
      const aiReply = await openaiService.generateAIResponse(
        userMessage, 
        conversationHistory, 
        contextString, 
        {
          questionType: questionType,
          forceContextUsage: true
        }
      );

      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`🚀 [RAG] Answer generated in ${duration}s`);
      return aiReply;
    } catch (error) {
      console.error('❌ [RAG] Answer Error:', error);
      return "Mohon maaf, sistem sedang mengalami kendala. Silakan hubungi Admin.";
    }
  }

  detectQuestionType(query) {
    const q = query.toLowerCase();
    if (q.includes('prodi') || q.includes('jurusan')) return 'program';
    if (q.includes('biaya') || q.includes('harga')) return 'tuition';
    if (q.includes('lokasi') || q.includes('alamat')) return 'location';
    if (q.includes('dalil') || q.includes('ayat')) return 'syariah';
    if (q.includes('fasilitas') || q.includes('gedung')) return 'facilities'; // New Type
    return 'general';
  }

  // =============================================================================
  // 4. INGESTION (OPTIMIZED RECURSIVE CHUNKING)
  // =============================================================================

  /**
   * ✅ RECURSIVE CHUNKING: Memecah teks besar menjadi potongan kecil yang masuk akal
   */
  optimalChunking(content, filename) {
    // 1. Split kasar berdasarkan Header Markdown (###)
    const rawSections = content.split(/(?=^#{1,4}\s)/m); 
    const finalChunks = [];

    rawSections.forEach(section => {
      const trimmed = section.trim();
      if (trimmed.length < 30) return; 

      // Ambil judul
      const titleMatch = trimmed.match(/^#{1,4}\s+(.+?)(?:\n|$)/m);
      let title = titleMatch ? titleMatch[1].replace(/[:]+$/, '').trim() : `Info dari ${filename}`;
      
      let type = 'general';
      if (trimmed.toLowerCase().includes('prodi')) type = 'program';
      if (trimmed.toLowerCase().includes('syariah') || trimmed.toLowerCase().includes('ayat')) type = 'syariah';
      if (trimmed.toLowerCase().includes('fasilitas')) type = 'facilities';

      // 2. CEK UKURAN: Apakah section ini > MAX_CHUNK_SIZE (800 chars)?
      if (trimmed.length > MAX_CHUNK_SIZE) {
        // RECURSIVE SPLIT: Pecah berdasarkan double newline (paragraf)
        const paragraphs = trimmed.split(/\n\n+/);
        let buffer = "";
        
        paragraphs.forEach(p => {
            // Jika buffer + paragraf ini > Max Size, simpan buffer dulu
            if (buffer.length + p.length > MAX_CHUNK_SIZE) {
                if (buffer.length > 0) {
                    finalChunks.push({ content: buffer, title: title, type: type });
                }
                // Reset buffer dengan overlap (ambil 100 karakter terakhir dari buffer lama + paragraf baru)
                const overlapText = buffer.slice(-CHUNK_OVERLAP); 
                buffer = overlapText + "\n\n" + p; 
            } else {
                buffer += (buffer ? "\n\n" : "") + p;
            }
        });

        // Push sisa buffer
        if (buffer.length > 50) {
             finalChunks.push({ content: buffer, title: title, type: type });
        }

      } else {
        // Ukuran aman, langsung simpan
        finalChunks.push({ content: trimmed, title: title, type: type });
      }
    });

    // Fallback jika file tidak punya header sama sekali
    if (finalChunks.length === 0) {
        const parts = content.match(new RegExp(`.{1,${MAX_CHUNK_SIZE}}`, 'g')) || [];
        parts.forEach(p => finalChunks.push({ content: p, title: `Bagian dari ${filename}`, type: 'general' }));
    }

    return finalChunks;
  }

  async ingestData() {
    try {
      await this.ensureCollection();
      const dataDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        return { success: false, message: "Folder data dibuat." };
      }

      const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.md'));
      if (files.length === 0) return { success: false, message: "Tidak ada file .md" };

      console.log(`📚 [RAG] Ingesting ${files.length} files (STRICT MODE)...`);
      let totalPoints = 0;

      for (const file of files) {
        const filePath = path.join(dataDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const chunks = this.optimalChunking(content, file);
        console.log(`   📄 ${file}: ${chunks.length} chunks created.`);

        const points = [];
        for (const [i, chunk] of chunks.entries()) {
          const embedding = await openaiService.createEmbedding(chunk.content);
          points.push({
            id: Date.now() + i, 
            vector: embedding,
            payload: {
              text: chunk.content,
              title: chunk.title,
              source_file: file,
              chunk_type: chunk.type
            }
          });
          await new Promise(r => setTimeout(r, 50)); 
        }

        if (points.length > 0) {
          await client.upsert(COLLECTION_NAME, { points });
          totalPoints += points.length;
        }
      }

      return { success: true, count: totalPoints, message: "Ingestion Selesai" };
    } catch (error) {
      console.error('❌ [RAG] Ingestion Failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ✅ UTILITIES
  async getCollectionInfo() {
    try {
        const info = await client.getCollection(COLLECTION_NAME);
        return { exists: true, vectorsCount: info.vectors_count, pointsCount: info.points_count };
    } catch (e) { return { exists: false, error: e.message }; }
  }
  async getCollectionStats() { return this.getCollectionInfo(); }
  async deleteCollection() {
    try { await client.deleteCollection(COLLECTION_NAME); return { success: true }; } 
    catch (e) { return { success: false }; }
  }
  async resetAndReingest() {
    console.log('🔄 [RAG] Resetting database...');
    await this.deleteCollection();
    await new Promise(resolve => setTimeout(resolve, 2000)); 
    return await this.ingestData();
  }
}

module.exports = new RagService();