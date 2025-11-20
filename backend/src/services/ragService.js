const { QdrantClient } = require('@qdrant/js-client-rest');
const openaiService = require('./openaiService');
const fs = require('fs');
const path = require('path');
const expansionConfig = require('../config/queryExpansionConfig');

/**
 * KONFIGURASI RAG SERVICE - OPTIMIZED FOR SHORT ANSWERS
 */
const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || 6333;
const COLLECTION_NAME = 'sapa_tazkia_knowledge';
const VECTOR_SIZE = 1536;

// ✅ OPTIMASI THRESHOLD UNTUK JAWABAN SINGKAT
const SIMILARITY_THRESHOLD = 0.45;
const FALLBACK_THRESHOLD = 0.30;
const TOP_K_DOCS = 10;

const client = new QdrantClient({ host: QDRANT_HOST, port: QDRANT_PORT });

class RagService {
  
  constructor() {
    this.ensureCollection();
  }

  // =============================================================================
  // ✅ QUERY EXPANSION OPTIMIZED UNTUK BAHASA INDONESIA
  // =============================================================================

  /**
   * Universal query expansion menggunakan config external - OPTIMIZED
   */
  expandQueryWithTypos(query) {
    const normalized = query.toLowerCase().trim();
    
    const synonymMap = expansionConfig.synonymMap;
    const commonTypos = expansionConfig.commonTypos;
    const contextualExpansions = expansionConfig.contextualExpansions;
    const contextualKeywords = expansionConfig.contextualKeywords;

    const expandedQueries = new Set();
    
    // 1. Original query
    expandedQueries.add(normalized);
    
    // 2. ✅ OPTIMASI BARU: Ekspansi khusus untuk query bahasa Indonesia
    this.addIndonesianSpecificExpansions(normalized, expandedQueries);
    
    // 3. Add synonyms based on similarity
    Object.keys(synonymMap).forEach(key => {
      if (this.isSimilar(normalized, key, 0.4) || normalized.includes(key)) {
        synonymMap[key].forEach(synonym => {
          expandedQueries.add(synonym);
          // Replace key dengan synonym dalam query
          const replacedQuery = normalized.replace(new RegExp(key, 'gi'), synonym);
          expandedQueries.add(replacedQuery);
        });
      }
    });

    // 4. Add typo corrections
    Object.keys(commonTypos).forEach(correct => {
      commonTypos[correct].forEach(typo => {
        if (normalized.includes(typo)) {
          const correctedQuery = normalized.replace(new RegExp(typo, 'gi'), correct);
          expandedQueries.add(correctedQuery);
          expandedQueries.add(correct);
        }
      });
    });

    // 5. Add context-based expansions menggunakan config
    this.addContextualExpansions(normalized, expandedQueries, contextualExpansions, contextualKeywords);

    // 6. ✅ OPTIMASI: Tambah query sederhana untuk fallback
    const words = normalized.split(' ').filter(word => word.length > 3);
    words.forEach(word => {
      expandedQueries.add(word);
    });

    // 7. Limit to reasonable number
    const finalQueries = Array.from(expandedQueries).slice(0, 15);
    
    console.log(`🔍 [RAG] Expanded queries (${finalQueries.length}):`, finalQueries.slice(0, 8));
    
    return finalQueries;
  }

  /**
   * ✅ OPTIMASI BARU: Ekspansi khusus untuk query bahasa Indonesia
   */
  addIndonesianSpecificExpansions(query, expandedQueries) {
    // Untuk query tanya "ada dimana?" -> ekspansi lokasi
    if (query.includes('dimana') || query.includes('lokasi') || query.includes('alamat')) {
      expandedQueries.add('lokasi universitas tazkia');
      expandedQueries.add('alamat kampus tazkia');
      expandedQueries.add('jl ir h djuanda sentul city bogor');
      expandedQueries.add('sentul city bogor');
      expandedQueries.add('lokasi kampus tazkia');
    }
    
    // Untuk query tentang program studi
    if (query.includes('prodi') || query.includes('program studi') || query.includes('jurusan')) {
      expandedQueries.add('program studi tazkia');
      expandedQueries.add('jurusan universitas tazkia');
      expandedQueries.add('fakultas tazkia');
      expandedQueries.add('daftar prodi tazkia');
    }
    
    // Untuk query tentang fakultas
    if (query.includes('feb') || query.includes('febs') || query.includes('fakultas ekonomi')) {
      expandedQueries.add('fakultas ekonomi bisnis syariah');
      expandedQueries.add('febs tazkia');
      expandedQueries.add('program studi febs');
    }
    
    // Untuk query tentang humaniora
    if (query.includes('humaniora') || query.includes('pendidikan') || query.includes('hukum')) {
      expandedQueries.add('fakultas humaniora tazkia');
      expandedQueries.add('fakultas pendidikan hukum komunikasi');
    }
    
    // Untuk query tentang kontak
    if (query.includes('kontak') || query.includes('telepon') || query.includes('hubungi')) {
      expandedQueries.add('kontak universitas tazkia');
      expandedQueries.add('telepon kampus tazkia');
      expandedQueries.add('082184800600');
      expandedQueries.add('08995499900');
    }

    // ✅ OPTIMASI BARU: Ekspansi untuk ekonomi syariah & murabahah
    if (query.includes('murabahah') || query.includes('riba') || query.includes('syariah')) {
      expandedQueries.add('murabahah dalam ekonomi syariah');
      expandedQueries.add('fatwa dsn mui murabahah');
      expandedQueries.add('transaksi syariah murabahah');
      expandedQueries.add('prinsip murabahah islamic finance');
    }
  }

  /**
   * Tambah ekspansi berdasarkan konteks query - MENGGUNAKAN CONFIG 100%
   */
  addContextualExpansions(query, expandedQueries, contextualExpansions, contextualKeywords) {
    const lowerQuery = query.toLowerCase();
    
    // 1. Loop melalui contextual expansions dari config
    Object.keys(contextualExpansions).forEach(contextKey => {
      if (lowerQuery.includes(contextKey)) {
        contextualExpansions[contextKey].forEach(expansion => {
          expandedQueries.add(expansion);
        });
      }
    });

    // 2. Loop melalui contextual keywords untuk deteksi konteks lebih luas
    Object.keys(contextualKeywords).forEach(contextKey => {
      contextualKeywords[contextKey].forEach(keyword => {
        if (lowerQuery.includes(keyword)) {
          // Tambah context key dan expansions terkait
          expandedQueries.add(contextKey);
          if (contextualExpansions[contextKey]) {
            contextualExpansions[contextKey].forEach(expansion => {
              expandedQueries.add(expansion);
            });
          }
        }
      });
    });
  }

  /**
   * Fuzzy string similarity check
   */
  isSimilar(str1, str2, threshold = 0.6) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    const similarity = (longer.length - distance) / longer.length;
    
    return similarity >= threshold;
  }

  /**
   * Calculate Levenshtein distance for typo detection
   */
  levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = b[i - 1] === a[j - 1] 
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              matrix[i][j - 1] + 1,     // insertion
              matrix[i - 1][j] + 1      // deletion
            );
      }
    }
    return matrix[b.length][a.length];
  }

  async ensureCollection() {
    try {
      const result = await client.getCollections();
      const exists = result.collections.some(c => c.name === COLLECTION_NAME);
      
      if (!exists) {
        console.log(`⚙️ [RAG] Membuat koleksi Qdrant: ${COLLECTION_NAME}...`);
        await client.createCollection(COLLECTION_NAME, {
          vectors: { size: VECTOR_SIZE, distance: 'Cosine' }
        });
        console.log('✅ [RAG] Koleksi berhasil dibuat.');
      } else {
        console.log(`✅ [RAG] Koleksi ${COLLECTION_NAME} sudah ada.`);
      }
    } catch (error) {
      console.error('❌ [RAG] Qdrant Connection Error:', error.message);
      throw error;
    }
  }

  /**
   * ✅ OPTIMIZED SEARCH dengan Multiple Embeddings
   */
  async searchRelevantDocs(query) {
    try {
      console.log(`🔍 [RAG] Original query: "${query}"`);
      
      // Expand query dengan synonyms dan typo handling
      const expandedQueries = this.expandQueryWithTypos(query);
      
      let bestResults = [];
      let bestQuery = query;
      let bestScore = 0;

      // ✅ OPTIMASI: Buat embedding untuk SETIAP expanded query
      for (const expandedQuery of expandedQueries) {
        try {
          console.log(`   🔍 Mencari dengan: "${expandedQuery}"`);
          
          // Buat embedding untuk query ini
          const queryVector = await openaiService.createEmbedding(expandedQuery);
          
          const searchResult = await client.search(COLLECTION_NAME, {
            vector: queryVector,
            limit: TOP_K_DOCS,
            with_payload: true,
            score_threshold: SIMILARITY_THRESHOLD
          });

          console.log(`   📊 Hasil: ${searchResult.length} dokumen`);

          // Pilih results dengan score tertinggi
          if (searchResult.length > 0) {
            const currentBestScore = Math.max(...searchResult.map(r => r.score));
            if (searchResult.length > bestResults.length || currentBestScore > bestScore) {
              bestResults = searchResult;
              bestQuery = expandedQuery;
              bestScore = currentBestScore;
            }
          }
          
          // Jika sudah dapat cukup results, stop
          if (bestResults.length >= 3) break;
          
        } catch (error) {
          console.log(`   ❌ Gagal search: "${expandedQuery}"`, error.message);
          continue;
        }
      }

      console.log(`🎯 [RAG] Best results: ${bestResults.length} dokumen (query: "${bestQuery}")`);
      
      // ✅ OPTIMASI: Fallback dengan threshold lebih rendah
      if (bestResults.length === 0) {
        console.log(`🔎 [RAG] Fallback: Mencari dengan threshold lebih rendah (${FALLBACK_THRESHOLD})...`);
        
        for (const expandedQuery of expandedQueries.slice(0, 8)) {
          try {
            const queryVector = await openaiService.createEmbedding(expandedQuery);
            const fallbackResults = await client.search(COLLECTION_NAME, {
              vector: queryVector,
              limit: 5,
              with_payload: true,
              score_threshold: FALLBACK_THRESHOLD
            });
            
            if (fallbackResults.length > 0) {
              bestResults = fallbackResults;
              bestQuery = expandedQuery;
              console.log(`   ✅ Fallback berhasil: ${fallbackResults.length} dokumen dengan "${expandedQuery}"`);
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }

      // LOG HASIL DETAIL
      if (bestResults.length > 0) {
        console.log(`📄 [RAG] Dokumen ditemukan:`);
        bestResults.forEach((result, index) => {
          console.log(`   ${index + 1}. Score: ${result.score.toFixed(3)} | Type: ${result.payload.chunk_type} | File: ${result.payload.source_file}`);
          console.log(`      Title: ${result.payload.title}`);
          console.log(`      Preview: ${result.payload.text.substring(0, 80)}...`);
        });
      } else {
        console.log(`❌ [RAG] TIDAK ADA DOKUMEN YANG COCOK untuk semua expanded queries`);
        
        // DEBUG: Cek koleksi
        try {
          const collectionInfo = await this.getCollectionInfo();
          console.log(`🐛 [DEBUG] Koleksi: ${collectionInfo.pointsCount} points, exists: ${collectionInfo.exists}`);
        } catch (error) {
          console.log(`🐛 [DEBUG] Gagal cek koleksi: ${error.message}`);
        }
      }

      return bestResults.map(res => res.payload.text);

    } catch (error) {
      console.error('❌ [RAG] Retrieval Error:', error);
      return [];
    }
  }

  async ingestData() {
    try {
      await this.ensureCollection();
      
      const dataDir = path.join(__dirname, '../../data');
      console.log('📁 [RAG] Data directory path:', dataDir);
      
      if (!fs.existsSync(dataDir)) {
        console.log('❌ [RAG] Data directory tidak ditemukan:', dataDir);
        fs.mkdirSync(dataDir, { recursive: true });
        return { success: false, message: "Folder data dibuat, tapi belum ada file .md." };
      }

      const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.md'));

      if (files.length === 0) {
        console.log('❌ [RAG] Tidak ada file .md di folder data');
        return { success: false, message: "Tidak ada file .md di folder data." };
      }

      console.log(`📚 [RAG] Memproses ${files.length} dokumen:`, files);

      let totalChunks = 0;
      let globalIdCounter = 1;

      for (const file of files) {
        const filePath = path.join(dataDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        console.log(`\n📄 [RAG] Memproses: ${file}`);
        console.log(`   📝 Konten panjang: ${content.length} karakter`);
        
        const chunks = this.simpleChunking(content, file);
        console.log(`   🔪 Dibagi menjadi ${chunks.length} chunks`);

        const points = [];

        for (const [index, chunk] of chunks.entries()) {
          try {
            console.log(`   🧬 Embedding chunk ${index + 1}/${chunks.length}...`);
            const embedding = await openaiService.createEmbedding(chunk.content);
            
            points.push({
              id: globalIdCounter++,
              vector: embedding,
              payload: { 
                text: chunk.content,
                title: chunk.title,
                source_file: file,
                chunk_type: chunk.type,
                type: 'knowledge_base'
              }
            });
          } catch (error) {
            console.error(`   ❌ Gagal embedding chunk ${index + 1}:`, error.message);
          }
        }

        if (points.length > 0) {
          console.log(`   💾 Menyimpan ${points.length} points ke Qdrant...`);
          await client.upsert(COLLECTION_NAME, {
            wait: true,
            points: points
          });
          totalChunks += points.length;
          console.log(`   ✅ ${file} berhasil disimpan (${points.length} chunks)`);
        } else {
          console.log(`   ⚠️ ${file} tidak menghasilkan chunks yang valid`);
        }
      }

      console.log(`\n🎉 [RAG] SUKSES! Total ${totalChunks} chunks dari ${files.length} file.`);
      return { 
        success: true, 
        count: totalChunks, 
        filesProcessed: files 
      };

    } catch (error) {
      console.error('❌ [RAG] Ingestion Failed:', error);
      console.error('Error details:', error.stack);
      return { success: false, error: error.message };
    }
  }

  simpleChunking(content, filename) {
    const chunks = [];
    
    console.log(`   🔍 Menganalisis konten ${filename}...`);
    
    const sections = content.split(/(?=^#+\s+)/m).filter(section => section.trim().length > 0);
    
    console.log(`   📑 Ditemukan ${sections.length} sections utama`);
    
    for (const section of sections) {
      const cleanSection = section.trim();
      if (cleanSection.length < 30) continue;
      
      let title = 'Informasi Umum';
      const titleMatch = cleanSection.match(/^#+\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else {
        title = cleanSection.substring(0, 50).replace(/\n/g, ' ').trim() + '...';
      }
      
      let type = 'general';
      const lowerSection = cleanSection.toLowerCase();
      
      if (lowerSection.includes('alamat') || lowerSection.includes('lokasi') || lowerSection.includes('jl.')) {
        type = 'location';
      } else if (lowerSection.includes('fakultas') || lowerSection.includes('program studi')) {
        type = 'program';
      } else if (lowerSection.includes('kontak') || lowerSection.includes('hotline') || lowerSection.includes('website')) {
        type = 'contact';
      } else if (lowerSection.includes('beasiswa')) {
        type = 'scholarship';
      } else if (lowerSection.includes('fasilitas')) {
        type = 'facilities';
      } else if (lowerSection.includes('murabahah') || lowerSection.includes('syariah') || lowerSection.includes('riba')) {
        type = 'syariah'; // ✅ JENIS BARU: konten ekonomi syariah
      }
      
      chunks.push({
        type: type,
        title: title,
        content: cleanSection
      });
      
      console.log(`   ➕ Chunk: "${title.substring(0, 40)}..." (${type})`);
    }
    
    if (chunks.length === 0) {
      console.log(`   ⚠️ Tidak ada sections, menggunakan paragraph splitting`);
      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50);
      
      for (const [index, paragraph] of paragraphs.entries()) {
        chunks.push({
          type: 'paragraph',
          title: `Bagian ${index + 1} - ${filename}`,
          content: paragraph.trim()
        });
      }
    }
    
    console.log(`   📊 Total chunks: ${chunks.length}`);
    return chunks;
  }

  /**
   * ✅ OPTIMASI BARU: Compile Context yang Lebih Efisien untuk Jawaban Singkat
   */
  compileContext(docs) {
    if (!docs || docs.length === 0) {
      console.log('📭 [RAG] Tidak ada dokumen untuk konteks');
      return null;
    }
    
    console.log(`📋 [RAG] Mengkompilasi ${docs.length} dokumen untuk jawaban singkat`);
    
    // ✅ OPTIMASI: Ambil hanya bagian paling relevan dari setiap dokumen
    const optimizedDocs = docs.map(doc => {
      // Ambil hanya 300-500 karakter pertama dari setiap dokumen
      // untuk menghindari konteks yang terlalu panjang
      if (doc.length > 500) {
        return doc.substring(0, 500) + '...';
      }
      return doc;
    });
    
    const context = "INFORMASI RELEVAN DARI DATABASE TAZKIA:\n\n" + 
                   optimizedDocs.join("\n\n--- INFORMASI TERKAIT ---\n\n");
    
    console.log(`📦 [RAG] Konteks dikompilasi: ${context.length} karakter`);
    
    return context;
  }

  /**
   * ✅ OPTIMASI BARU: Deteksi Question Type untuk Penawaran yang Tepat
   */
  detectQuestionType(userMessage, relevantDocs) {
    const message = userMessage.toLowerCase();
    const docsText = relevantDocs.join(' ').toLowerCase();
    
    // Deteksi berdasarkan keyword
    if (message.includes('apa itu') || message.includes('pengertian') || message.includes('definisi')) {
      return 'definition';
    } else if (message.includes('dimana') || message.includes('lokasi') || message.includes('alamat')) {
      return 'location';
    } else if (message.includes('prodi') || message.includes('program studi') || message.includes('jurusan')) {
      return 'program';
    } else if (message.includes('cara') || message.includes('proses') || message.includes('tahapan')) {
      return 'procedure';
    } else if (message.includes('murabahah') || message.includes('riba') || message.includes('syariah')) {
      return 'syariah';
    }
    
    // Deteksi berdasarkan konten dokumen
    if (docsText.includes('fakultas') || docsText.includes('program studi')) {
      return 'program';
    } else if (docsText.includes('jl.') || docsText.includes('sentul') || docsText.includes('bogor')) {
      return 'location';
    } else if (docsText.includes('murabahah') || docsText.includes('fatwa') || docsText.includes('dsn-mui')) {
      return 'syariah';
    }
    
    return 'general';
  }

  /**
   * ✅ FUNGSI BARU: Deteksi User Type untuk Guest Mode
   */
  detectUserType(userMessage, conversationHistory) {
    const message = userMessage.toLowerCase();
    const fullConversation = conversationHistory.map(msg => msg.content).join(' ').toLowerCase();
    
    // Keyword untuk user engaged
    const engagedKeywords = [
      'thanks', 'thank you', 'makasih', 'terima kasih', 'keren', 'bagus', 'helpful',
      'mantap', 'oke', 'good', 'nice', 'sip', 'oke banget'
    ];
    
    const isEngaged = engagedKeywords.some(keyword => 
      message.includes(keyword) || fullConversation.includes(keyword)
    );
    
    if (isEngaged) return 'engaged';
    return 'general';
  }

  /**
   * ✅ METHOD BARU: Answer Question dengan Short Answer + Offers (OPTIMIZED TOKENS)
   */
  async answerQuestion(userMessage, conversationHistory = [], options = {}) {
    const startTime = performance.now();

    try {
      console.log(`\n💬 [RAG] Pertanyaan: "${userMessage}"`);

      const relevantDocs = await this.searchRelevantDocs(userMessage);
      const contextString = this.compileContext(relevantDocs);
      
      // ✅ DETEKSI USER TYPE & QUESTION TYPE
      const userType = this.detectUserType(userMessage, conversationHistory);
      const questionType = this.detectQuestionType(userMessage, relevantDocs);
      
      console.log(`👤 [RAG] User type: ${userType}, Question type: ${questionType}`);
      
      let aiReply;
      
      if (contextString) {
        console.log('🤖 [RAG] Menggenerate SHORT response dengan konteks...');
        
        // ✅ TENTUKAN LANGUAGE STYLE BERDASARKAN USER TYPE
        let languageStyle = 'formal';
        if (userType === 'engaged') {
          languageStyle = 'casual';
        }
        
        // ✅ OPTIMASI TOKEN: KURANGI MAX TOKEN DRASTIS
        aiReply = await openaiService.generateAIResponse(
          userMessage, 
          conversationHistory, 
          contextString, 
          {
            maxTokens: 400,  // ✅ DIKURANGI dari 600 ke 400
            temperature: 0.1, // ✅ DITURUNKAN dari 0.2 ke 0.1
            isShortAnswer: true,
            languageStyle: languageStyle
          }
        );
      } else {
        console.log('🔄 [RAG] Fallback: Tidak ada konteks relevan');
        
        const isGreeting = /^(assalam|salam|halo|hai|pagi|siang|sore|malam|tes|p|hi|hello)/i.test(userMessage);
        
        if (isGreeting) {
          aiReply = await openaiService.generateAIResponse(
            userMessage, 
            conversationHistory, 
            null,
            {
              maxTokens: 150,  // ✅ SANGAT SINGKAT untuk greeting
              isShortAnswer: true,
              languageStyle: 'casual'
            }
          );
        } else {
          // ✅ GUNAKAN FALLBACK DENGAN LANGUAGE STYLE YANG TEPAT
          let fallbackStyle = 'formal';
          if (userType === 'engaged') {
            fallbackStyle = 'casual';
          }
          
          aiReply = await openaiService.generateAIResponse(
            userMessage, 
            conversationHistory, 
            null,
            {
              maxTokens: 250,  // ✅ DIKURANGI dari 300 ke 250
              isShortAnswer: true,
              languageStyle: fallbackStyle
            }
          );
        }
      }

      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      
      // ✅ LOGGING YANG LEBIH DETAIL DENGAN TOKEN INFO
      console.log(`🚀 [RAG] Selesai dalam ${duration}s`, {
        hasContext: !!contextString,
        docsFound: relevantDocs.length,
        userType: userType,
        questionType: questionType,
        replyLength: aiReply.length,
        wordCount: aiReply.split(' ').length,
        hasOffer: aiReply.includes('?') && (aiReply.includes('ingin') || aiReply.includes('mau') || aiReply.includes('apakah')),
        isShort: aiReply.length <= 600 // ✅ FLAG UNTUK MONITORING
      });

      return aiReply;

    } catch (error) {
      console.error('❌ [RAG] Error:', error);
      
      // ✅ FALLBACK ERROR DENGAN VARIASI
      const fallbacks = [
        "Afwan, sistem sedang mengalami gangguan teknis. Mohon hubungi Admin Kampus di 0821-84-800-600 untuk bantuan lebih lanjut.",
        "Alhamdulillah, saya ingin membantu namun sedang ada kendala teknis. Silakan hubungi Admin Kampus di 0821-84-800-600 ya!",
        "Wah, sepertinya Kia lagi gangguan nih 😅 Yuk langsung chat Admin Kampus di 0821-84-800-600, mereka pasti bisa bantu!"
      ];
      
      return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
  }

  /**
   * ✅ METHOD BARU: Answer dengan Custom Options (OPTIMIZED)
   */
  async answerWithOptions(userMessage, conversationHistory = [], customOptions = {}) {
    const defaultOptions = {
      maxTokens: 400,  // ✅ DIKURANGI
      temperature: 0.1, // ✅ DITURUNKAN
      isShortAnswer: true,
      languageStyle: 'formal'
    };
    
    const options = { ...defaultOptions, ...customOptions };
    
    const relevantDocs = await this.searchRelevantDocs(userMessage);
    const contextString = this.compileContext(relevantDocs);
    
    return await openaiService.generateAIResponse(
      userMessage,
      conversationHistory,
      contextString,
      options
    );
  }

  async getCollectionInfo() {
    try {
      const info = await client.getCollection(COLLECTION_NAME);
      const count = await client.count(COLLECTION_NAME);
      
      return {
        exists: true,
        vectorsCount: info.vectors_count,
        pointsCount: count.count,
        status: info.status
      };
    } catch (error) {
      return { exists: false, error: error.message };
    }
  }

  /**
   * ✅ METHOD BARU: Test RAG dengan Short Answers (OPTIMIZED)
   */
  async testShortAnswerPerformance() {
    try {
      console.log('🧪 [RAG] Testing short answer performance...');
      
      const testQuestions = [
        "Apa itu murabahah?",
        "Dimana lokasi kampus Tazkia?",
        "Program studi apa saja yang ada?",
        "Bagaimana cara daftar beasiswa?",
        "Apa syarat pendaftaran mahasiswa baru?"
      ];
      
      const results = [];
      
      for (const question of testQuestions) {
        const startTime = performance.now();
        const answer = await this.answerQuestion(question, [], {
          maxTokens: 400,  // ✅ DIKURANGI
          isShortAnswer: true
        });
        const duration = ((performance.now() - startTime) / 1000).toFixed(2);
        
        results.push({
          question: question,
          answer: answer,
          duration: duration,
          length: answer.length,
          wordCount: answer.split(' ').length,
          hasOffer: answer.includes('?') && (answer.includes('ingin') || answer.includes('mau') || answer.includes('apakah')),
          isShort: answer.length <= 600
        });
      }
      
      // ✅ STATISTIK YANG LEBIH DETAIL
      const shortAnswers = results.filter(r => r.isShort);
      const withOffers = results.filter(r => r.hasOffer);
      
      return {
        success: true,
        results: results,
        summary: {
          totalQuestions: results.length,
          shortAnswers: shortAnswers.length,
          withOffers: withOffers.length,
          averageLength: Math.round(results.reduce((acc, r) => acc + r.length, 0) / results.length),
          averageWordCount: Math.round(results.reduce((acc, r) => acc + r.wordCount, 0) / results.length),
          averageDuration: (results.reduce((acc, r) => acc + parseFloat(r.duration), 0) / results.length).toFixed(2)
        }
      };
      
    } catch (error) {
      console.error('❌ [RAG] Performance test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new RagService();