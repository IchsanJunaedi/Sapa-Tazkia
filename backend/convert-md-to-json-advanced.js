const fs = require('fs');
const path = require('path');

// Konfigurasi Input/Output
const DATA_DIR = path.join(__dirname, 'data');
const FILES_TO_PROCESS = [
    'brosur_febs_optimized.md',
    'brosur_humaniora_optimized.md',
    'ijarah_optimized.md',
    'mudharabah_optimized.md',
    'murabahah_optimized.md',
    'musyarakah_optimized.md',
    'program_magister.md',
    'stmik_profile.md',
    'tazkia_profile_optimized.md'
];

// Utilitas: Membersihkan teks dari karakter markdown
const cleanText = (text) => {
    if (!text) return "";
    return text
        .replace(/\*\*/g, '') // Hapus bold
        .replace(/__/g, '')   // Hapus italic
        .replace(/^-\s+/gm, '') // Hapus bullet points
        .trim();
};

// Utilitas: Ekstraksi Key-Value yang LEBIH KUAT (Tahan Bold/Spasi)
const extractKeyValue = (text) => {
    // Regex ini menangkap pola "Key: Value" walaupun ada bold (**Key**: Value)
    const regex = /^(?:(?:\d+\.|-)?\s*)?(?:\*\*)?([a-zA-Z\s&]+)(?:\*\*)?\s*:\s*(.+)$/;
    const match = text.match(regex);
    if (match) {
        return { 
            key: match[1].trim().toLowerCase().replace(/\s/g, '_'), 
            value: cleanText(match[2]) // Bersihkan value dari markdown juga
        };
    }
    return null;
};

// Utilitas: Generate keywords
const generateKeywords = (text) => {
    const stopwords = ['dan', 'di', 'ke', 'dari', 'yang', 'untuk', 'pada', 'adalah', 'ini', 'itu', 'dengan', 'dalam', 'atau', 'program', 'studi'];
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const uniqueWords = [...new Set(words.filter(w => w.length > 3 && !stopwords.includes(w)))];
    return uniqueWords.slice(0, 10); 
};

const processFile = (fileName) => {
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File ${fileName} tidak ditemukan. Skip.`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let chunks = [];
    
    // STATE MEMORY
    let context = {
        h1: "Umum",      
        h2: "",          
        source: fileName
    };

    let currentBuffer = {
        type: "general",
        lines: [],
        metadata: {}
    };

    const flushBuffer = () => {
        // Jangan simpan buffer kosong
        if (currentBuffer.lines.length === 0 && Object.keys(currentBuffer.metadata).length === 0) return;
        
        const fullContent = currentBuffer.lines.join('\n').trim();
        
        // Cek double empty
        if (!fullContent && Object.keys(currentBuffer.metadata).length === 0) return;

        // Semantic String Construction
        let semanticString = "";
        
        if (currentBuffer.type === 'prodi') {
            semanticString = `Program Studi: ${currentBuffer.metadata.program_studi || 'Tidak diketahui'}. 
            Fakultas: ${currentBuffer.metadata.fakultas || context.h1}. 
            Deskripsi Jurusan: ${currentBuffer.metadata.deskripsi || ''}. 
            Sertifikasi Profesi: ${currentBuffer.metadata.sertifikasi || ''}.
            Kurikulum Utama: ${currentBuffer.metadata.kurikulum_utama || ''}.
            Prospek Karir: ${currentBuffer.metadata.karir || ''}.`;
        } else {
            semanticString = `Topik: ${context.h1} ${context.h2 ? '- ' + context.h2 : ''}. 
            Isi: ${fullContent}`;
        }

        chunks.push({
            id: `${fileName.replace('.md', '')}-${chunks.length + 1}`,
            category: context.h1,
            topic: currentBuffer.type === 'prodi' ? currentBuffer.metadata.program_studi : (context.h2 || "General Info"),
            type: currentBuffer.type,
            raw_content: fullContent,
            structured_data: currentBuffer.type === 'prodi' ? currentBuffer.metadata : null, 
            semantic_content: cleanText(semanticString), 
            keywords: generateKeywords(fullContent + " " + (currentBuffer.metadata.program_studi || ""))
        });

        // Reset Buffer
        currentBuffer = { type: "general", lines: [], metadata: {} };
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // 1. Deteksi Heading Level 1 (# atau INFORMASI UTAMA)
        if (line.startsWith('INFORMASI UTAMA:') || line.startsWith('# ')) {
            flushBuffer();
            context.h1 = cleanText(line.replace('INFORMASI UTAMA:', '').replace('#', ''));
            context.h2 = ""; 
            return;
        }

        // 2. Deteksi Heading Level 2 (##)
        if (line.startsWith('## ') || line.startsWith('DETAIL LENGKAP')) {
            flushBuffer();
            context.h2 = cleanText(line.replace('##', ''));
            return;
        }

        // 3. DETEKSI PROGRAM STUDI (Revisi Regex Lebih Kuat)
        // Menangkap "1. Program Studi:", "1. **Program Studi**:", "- Program Studi:"
        const prodiRegex = /^(?:\d+\.|-)?\s*(?:\*\*)?Program Studi(?:\*\*)?\s*:\s*(.+)$/i;
        const prodiMatch = trimmed.match(prodiRegex);
        
        if (prodiMatch) {
            flushBuffer();
            currentBuffer.type = 'prodi';
            // Ambil nama prodi dari regex match group 1
            const namaProdi = cleanText(prodiMatch[1]);
            context.h2 = namaProdi; 
            currentBuffer.metadata['program_studi'] = namaProdi;
            return;
        }

        // 4. Ekstraksi Metadata (Hanya jika mode prodi)
        if (currentBuffer.type === 'prodi') {
            const kv = extractKeyValue(trimmed);
            // Validasi: Key harus masuk akal (hindari kalimat biasa dianggap key)
            // Kita whitelist key yang umum ada di brosur
            const validKeys = ['fakultas', 'deskripsi', 'sertifikasi', 'kurikulum_utama', 'kurikulum', 'karir', 'prospek_karir', 'kategori'];
            
            if (kv && validKeys.some(k => kv.key.includes(k))) {
                currentBuffer.metadata[kv.key] = kv.value;
            } else {
                currentBuffer.lines.push(trimmed);
            }
        } else {
            currentBuffer.lines.push(trimmed);
        }
    });

    flushBuffer();

    const jsonPath = path.join(DATA_DIR, fileName.replace('.md', '.json'));
    fs.writeFileSync(jsonPath, JSON.stringify(chunks, null, 2));
    console.log(`✅ ${fileName} converted -> ${chunks.length} chunks.`);
};

console.log("🚀 Starting FIX Convert...");
FILES_TO_PROCESS.forEach(processFile);
console.log("🎉 Selesai!");