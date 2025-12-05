const { QdrantClient } = require('@qdrant/js-client-rest');
const openaiService = require('./openaiService');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); 

/**
 * KONFIGURASI RAG SERVICE
 */
const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || 6333;
const COLLECTION_NAME = 'sapa_tazkia_knowledge';
const VECTOR_SIZE = 1536;

const MAX_CHUNK_SIZE = 800;  
const CHUNK_OVERLAP = 100;   
const MAX_CONTEXT_CHARS = 4500; 

const getAdaptiveThreshold = (query) => {
  if (query.length < 15) return 0.35;
  return 0.28; 
};

const FALLBACK_THRESHOLD = 0.25; 
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
    expandedQueries.add(normalized);
    
    if (normalized.includes('apa aja') || normalized.includes('sebutkan') || normalized.includes('daftar') || normalized.includes('list')) {
        expandedQueries.add(`daftar lengkap program studi ${normalized}`);
        expandedQueries.add(`ringkasan semua jurusan ${normalized}`);
    }

    if (normalized.includes('sertifika') || normalized.includes('gelar')) {
        expandedQueries.add(`sertifikasi kompetensi ${normalized}`);
        expandedQueries.add(`gelar lulusan ${normalized}`);
    }

    this.addDomainSpecificExpansions(normalized, expandedQueries);
    
    const surahRegex = /(?:qs\.?|surat|surah)\s+([a-z'-]+)(?:\s*(?:\[\d+\]|ayat|no|nomor)?\s*[:]?\s*(\d+))?/i;
    const match = normalized.match(surahRegex);
    if (match) {
      const surahName = match[1].replace(/['`]/g, ''); 
      const verseNo = match[2];
      expandedQueries.add(surahName);
      if (verseNo) expandedQueries.add(`${surahName} ${verseNo}`);
    }

    return this.prioritizeExpandedQueries(Array.from(expandedQueries));
  }

  addDomainSpecificExpansions(query, expandedQueries) {
    if (query.includes('febs') || query.includes('ekonomi')) {
        expandedQueries.add('fakultas ekonomi bisnis syariah');
    }
    if (query.includes('humaniora')) {
        expandedQueries.add('fakultas hukum komunikasi pendidikan');
    }
  }

  prioritizeExpandedQueries(queries) {
    return queries.slice(0, 5); 
  }

  async ensureCollection() {
    try {
      const result = await client.getCollections();
      if (!result.collections.some(c => c.name === COLLECTION_NAME)) {
        await client.createCollection(COLLECTION_NAME, { vectors: { size: VECTOR_SIZE, distance: 'Cosine' } });
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
      console.log(`🔍 [RAG] Searching for: "${query}"`); 
      const adaptiveThreshold = getAdaptiveThreshold(query);
      const expandedQueries = this.expandQueryWithTypos(query);
      
      let allCandidates = [];
      const seenPayloads = new Set(); 
      const searchQueries = expandedQueries.slice(0, 3);

      for (const expandedQuery of searchQueries) {
        try {
          const queryVector = await openaiService.createEmbedding(expandedQuery);
          const searchResult = await client.search(COLLECTION_NAME, {
            vector: queryVector,
            limit: 40, 
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
        } catch (e) { console.warn(`⚠️ [RAG] Embedding error: ${e.message}`); }
      }

      if (allCandidates.length === 0) {
        console.log(`🔎 [RAG] Fallback search active...`);
        const fallbackVector = await openaiService.createEmbedding(query);
        const fallbackRes = await client.search(COLLECTION_NAME, {
          vector: fallbackVector,
          limit: 20, 
          with_payload: true,
          score_threshold: FALLBACK_THRESHOLD
        });
        allCandidates = fallbackRes;
      }

      console.log(`📊 [RAG] Candidates Found: ${allCandidates.length} docs (Before Reranking)`);

      const finalResults = await this.rerankResults(query, allCandidates, 6);

      if (finalResults.length > 0) {
        console.log(`📄 [RAG] TOP ${finalResults.length} FINAL CONTEXT:`);
        finalResults.forEach((doc, index) => {
            const score = doc.rerankScore.toFixed(3);
            const title = doc.payload.title || 'No Title';
            const source = doc.payload.source_file || 'Unknown';
            const snippet = doc.payload.text.replace(/\n/g, ' ').substring(0, 50);
            console.log(`   ${index + 1}. [${score}] [${source}] "${title}" -> "${snippet}..."`);
        });
      }

      return finalResults;

    } catch (error) {
      console.error('❌ [RAG] Retrieval Error:', error);
      return [];
    }
  }

  normalizeString(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[\[\]:;'"\(\)]/g, '').replace(/\s+/g, ' ').trim();
  }

  async rerankResults(query, searchResults, topN = 6) {
    const queryLower = this.normalizeString(query); 
    
    const isListRequest = queryLower.includes('apa aja') || 
                          queryLower.includes('sebutkan') || 
                          queryLower.includes('daftar') || 
                          queryLower.includes('list') ||
                          (queryLower.includes('prodi') && !queryLower.includes('detail'));

    const isDetailRequest = queryLower.includes('sertifika') || 
                            queryLower.includes('karir') || 
                            queryLower.includes('kerja') || 
                            queryLower.includes('kurikulum') || 
                            queryLower.includes('belajar');

    const reranked = searchResults.map(result => {
      let score = result.score; 
      const payload = result.payload;
      const filename = payload.source_file ? payload.source_file.toLowerCase() : '';
      const titleClean = this.normalizeString(payload.title);
      const contentClean = this.normalizeString(payload.text);

      if (contentClean.includes(queryLower)) score += 0.1;

      if (queryLower.includes('febs') && filename.includes('febs')) score += 0.5; 
      if (queryLower.includes('humaniora') && filename.includes('humaniora')) score += 0.5;

      if (isListRequest) {
          if (titleClean.includes('ringkasan') || titleClean.includes('daftar')) {
              score += 0.8; 
          }
      } 
      else if (isDetailRequest) {
          if (queryLower.includes('sertifika') && contentClean.includes('sertifikasi')) {
              score += 0.8; 
              console.log(`   🎯 [RAG] Detail Match Found (Certification): ${payload.title}`);
          }
          if (queryLower.includes('karir') && (contentClean.includes('karir') || contentClean.includes('prospek'))) {
              score += 0.8; 
          }
      }

      return { ...result, rerankScore: parseFloat(score.toFixed(3)) };
    });

    return reranked.sort((a, b) => b.rerankScore - a.rerankScore).slice(0, topN);
  }

  // =============================================================================
  // 3. CONTEXT & ANSWERING
  // =============================================================================

  compileContext(docs) {
    if (!docs || docs.length === 0) return "";
    const MAX_CHARS = MAX_CONTEXT_CHARS; 
    let currentLength = 0;
    const contextParts = [];

    for (const doc of docs) {
        const payload = doc.payload || doc; 
        const header = `[SUMBER: ${payload.source_file || 'Umum'} - ${payload.title}]\n`;
        const content = payload.text;
        
        const itemLength = header.length + content.length + 5; 
        if (currentLength + itemLength > MAX_CHARS) {
             if (MAX_CHARS - currentLength > 200) {
                 contextParts.push(`${header}${content.substring(0, MAX_CHARS - currentLength)}...`);
             }
             break;
        }
        
        contextParts.push(`${header}${content}`);
        currentLength += itemLength;
    }
    
    console.log(`📦 [RAG] Context compiled: ${currentLength} chars sent to OpenAI.`);
    return "BERIKUT ADALAH DATA FAKTA:\n\n" + contextParts.join("\n\n---\n\n");
  }

  // ✅ METODE UTAMA: RETURN OBJECT LENGKAP
  async answerQuestion(userMessage, conversationHistory = []) {
    try {
      const startTime = performance.now();
      const relevantDocs = await this.searchRelevantDocs(userMessage);
      const contextString = this.compileContext(relevantDocs);
      
      let questionType = 'general';
      if (userMessage.toLowerCase().includes('prodi') || userMessage.toLowerCase().includes('jurusan')) questionType = 'program';

      // Call OpenAI (Return object {content, usage})
      const aiResult = await openaiService.generateAIResponse(
        userMessage, 
        conversationHistory, 
        contextString, 
        { questionType: questionType, forceContextUsage: relevantDocs.length > 0 }
      );

      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️ [RAG] Total processing time: ${duration}s`);
      
      // ✅ [FIX] Return Object: Jawaban + Metadata Usage Asli
      return {
        answer: aiResult.content, // Teks jawaban
        usage: aiResult.usage,    // Data token ASLI dari OpenAI {total_tokens, ...}
        docsFound: relevantDocs.length
      };

    } catch (error) {
      console.error('❌ [RAG] Answer Error:', error);
      // Return error structure
      return {
        answer: "Mohon maaf, sistem sedang mengalami kendala teknis.",
        usage: { total_tokens: 0 }, // Safety fallback
        docsFound: 0
      };
    }
  }

  // =============================================================================
  // 4. INGESTION
  // =============================================================================

  optimalChunking(content, filename) {
    const rawSections = content.split(/(?=^#{1,3}\s)/m); 
    const finalChunks = [];

    rawSections.forEach(section => {
      const trimmed = section.trim();
      if (trimmed.length < 30) return; 

      const titleMatch = trimmed.match(/^#{1,3}\s+(.+?)(?:\n|$)/m);
      let title = titleMatch ? titleMatch[1].replace(/[:]+$/, '').trim() : `Info: ${filename}`;
      
      let type = 'general';
      if (title.toLowerCase().includes('prodi') || title.toLowerCase().includes('program')) type = 'program';

      if ((title.toLowerCase().includes('ringkasan') || type === 'program') && trimmed.length < 2000) {
         finalChunks.push({ content: trimmed, title: title, type: 'program' });
      } 
      else if (trimmed.length > MAX_CHUNK_SIZE) {
         const paragraphs = trimmed.split(/\n\n+/);
         let buffer = "";
         paragraphs.forEach(p => {
            if (buffer.length + p.length > MAX_CHUNK_SIZE) {
                if (buffer.length > 0) finalChunks.push({ content: buffer, title: title, type: type });
                buffer = p; 
            } else {
                buffer += (buffer ? "\n\n" : "") + p;
            }
         });
         if (buffer.length > 0) finalChunks.push({ content: buffer, title: title, type: type });
      } else {
         finalChunks.push({ content: trimmed, title: title, type: type });
      }
    });
    
    if (finalChunks.length === 0) finalChunks.push({ content: content.substring(0, 1000), title: filename, type: 'general' });
    return finalChunks;
  }

  generateDeterministicId(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  async ingestData() {
    return this.resetAndReingest();
  }

  async getCollectionInfo() { 
      try { const i = await client.getCollection(COLLECTION_NAME); return { exists: true, pointsCount: i.points_count }; } 
      catch { return { exists: false }; } 
  }
  
  async deleteCollection() { try { await client.deleteCollection(COLLECTION_NAME); return { success: true }; } catch (e) { return { success: false }; } }
  
  async resetAndReingest() {
      console.log('🔄 [RAG] Resetting DB & Ingesting...');
      await this.deleteCollection();
      await new Promise(r => setTimeout(r, 1000));
      await this.ensureCollection();
      
      const dataDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dataDir)) return { success: false, message: "Folder data tidak ditemukan." };
      
      const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.md'));
      if (files.length === 0) return { success: false, message: "Tidak ada file .md" };
      
      let count = 0;
      for (const f of files) {
          const txt = fs.readFileSync(path.join(dataDir, f), 'utf-8');
          const chunks = this.optimalChunking(txt, f);
          console.log(`   📄 ${f}: ${chunks.length} chunks`);
          
          const points = [];
          for (const c of chunks) {
              points.push({
                  id: this.generateDeterministicId(c.content + f),
                  vector: await openaiService.createEmbedding(c.content),
                  payload: { text: c.content, title: c.title, source_file: f, chunk_type: c.type }
              });
              await new Promise(r => setTimeout(r, 20));
          }
          if (points.length) await client.upsert(COLLECTION_NAME, { points });
          count += points.length;
      }
      return { success: true, count };
  }
}

module.exports = new RagService();