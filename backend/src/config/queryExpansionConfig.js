// config/queryExpansionConfig.js

module.exports = {
  // =============================================================================
  // 1. SYNONYM MAP - Untuk kata yang sama artinya
  // =============================================================================
  synonymMap: {
    // Kampus & Institusi
    'feb': ['feb', 'febs', 'fakultas ekonomi bisnis syariah', 'ekonomi bisnis', 'fakultas ekonomi'],
    'febs': ['febs', 'feb', 'fakultas ekonomi bisnis syariah', 'ekonomi bisnis', 'fakultas ekonomi'],
    'humaniora': ['humaniora', 'fakultas humaniora', 'fakultas pendidikan hukum komunikasi', 'pendidikan hukum komunikasi'],
    'fakultas': ['fakultas', 'jurusan', 'program studi', 'departemen'],
    'universitas': ['universitas', 'kampus', 'perguruan tinggi', 'university'],
    'akreditasi': ['akreditasi', 'accreditation', 'penilaian mutu'],
    'prestasi': ['prestasi', 'achievement', 'penghargaan'],
    'kompetisi': ['kompetisi', 'competition', 'lomba', 'kontes'],
    
    // Program Studi & Akademik
    'prodi': ['prodi', 'program studi', 'jurusan', 'program pendidikan', 'konsentrasi'],
    'program studi': ['program studi', 'prodi', 'jurusan', 'konsentrasi', 'spesialisasi'],
    'pendidikan': ['pendidikan', 'akademik', 'studi', 'belajar', 'education'],
    'akademik': ['akademik', 'pendidikan', 'studi', 'kurikulum'],
    'kuliah': ['kuliah', 'studi', 'pendidikan', 'belajar'],
    
    // Lokasi & Kontak
    'lokasi': ['lokasi', 'alamat', 'tempat', 'dimana', 'address', 'letak'],
    'alamat': ['alamat', 'lokasi', 'tempat', 'address'],
    'kontak': ['kontak', 'hubungi', 'telepon', 'whatsapp', 'hotline', 'call'],
    'telepon': ['telepon', 'hp', 'whatsapp', 'call', 'kontak'],
    'tazkia': ['tazkia', 'universitas tazkia', 'stmik tazkia', 'kampus tazkia'],
    
    // Ekonomi Syariah & Murabahah
    'murabahah': ['murabahah', 'murobahah', 'jual beli dengan keuntungan', 'cost plus sale', 'bai murabahah'],
    'riba': ['riba', 'bunga bank', 'interest', 'usury', 'bunga'],
    'syariah': ['syariah', 'shariah', 'islamic', 'syariat islam', 'hukum islam'],
    'fatwa': ['fatwa', 'keputusan hukum', 'ruling', 'pendapat ulama', 'ketetapan dsn-mui'],
    'halal': ['halal', 'dibolehkan', 'diperbolehkan', 'boleh', 'legal syariah'],
    'haram': ['haram', 'dilarang', 'terlarang', 'tidak boleh', 'illegal syariah'],
    'akad': ['akad', 'kontrak', 'perjanjian', 'kesepakatan', 'transaksi'],
    'dsn-mui': ['dsn-mui', 'dewan syariah nasional', 'majelis ulama indonesia', 'dewan syariah', 'mui'],
    'bank syariah': ['bank syariah', 'bank islam', 'islamic bank', 'perbankan syariah', 'bank berdasarkan syariah'],
    'jual beli': ['jual beli', 'transaksi jual beli', 'perdagangan', 'bisnis', 'niaga'],
    'urban': ['urban', 'uang muka', 'down payment', 'advance payment', 'deposit'],
    'jaminan': ['jaminan', 'collateral', 'agunan', 'jaminan kredit', 'jaminan hutang'],
    'pailit': ['pailit', 'bangkrut', 'insolven', 'tidak mampu bayar', 'gagal bayar'],
    'arbitrase': ['arbitrase', 'badan arbitrasi syariah', 'penyelesaian sengketa', 'mediasi syariah', 'penyelesaian konflik'],
    'suka sama suka': ['suka sama suka', 'kerelaan', 'saling ridha', 'mutual consent', 'sukarela'],
    'menunda bayar': ['menunda bayar', 'penundaan pembayaran', 'keterlambatan bayar', 'telat bayar', 'menunggak'],
    'orang mampu': ['orang mampu', 'ghani', 'mampu finansial', 'punya kemampuan', 'berkemampuan'],
    'akad bebas riba': ['akad bebas riba', 'kontrak tanpa riba', 'transaksi non riba', 'bebas bunga'],
    'nasabah': ['nasabah', 'customer', 'pengguna bank', 'klien bank', 'peminjam'],
    'pedagang': ['pedagang', 'pihak ketiga', 'supplier', 'penjual barang', 'vendor'],
    'bank': ['bank', 'lembaga keuangan', 'institusi finansial', 'perbankan', 'lembaga pembiayaan'],
    'permohonan': ['permohonan', 'pengajuan', 'aplikasi', 'request', 'permintaan'],
    'pesanan': ['pesanan', 'pemesanan', 'order', 'barang dipesan', 'item dipesan'],
    'harga pokok': ['harga pokok', 'harga beli', 'cost price', 'harga dasar', 'harga modal'],
    'keuntungan': ['keuntungan', 'laba', 'profit', 'margin', 'markup','cuan'],

    // ✅ OPTIMASI UNTUK SHORT ANSWER & PENAWARAN
    'lebih lanjut': ['lebih lanjut', 'detail', 'informasi lengkap', 'rincian', 'penjelasan detail', 'selengkapnya'],
    'ketentuan': ['ketentuan', 'syarat', 'aturan', 'prosedur', 'kebijakan', 'ketetapan'],
    'cara': ['cara', 'proses', 'tahapan', 'mekanisme', 'langkah-langkah', 'tata cara'],
    'dimana': ['dimana', 'di mana', 'lokasi', 'tempat', 'alamat', 'letak'],
    'apa itu': ['apa itu', 'pengertian', 'definisi', 'arti', 'maksud', 'penjelasan'],
    'ingin tahu': ['ingin tahu', 'mau tahu', 'penasaran', 'ingin mengetahui', 'ingin belajar'],
    'bagaimana': ['bagaimana', 'cara', 'proses', 'mekanisme', 'tahapan'],
    'bisa': ['bisa', 'dapat', 'mampu', 'memungkinkan', 'boleh'],
  },

  // =============================================================================
  // 2. COMMON TYPOS - Untuk koreksi typo otomatis
  // =============================================================================
  commonTypos: {
    // Kampus & Institusi
    'feb': ['feb', 'febs', 'febz', 'febp', 'febss', 'febsi'],
    'febs': ['febs', 'feb', 'febz', 'febss', 'febsi', 'febis'],
    'humaniora': ['humaniora', 'humanior', 'humaniorra', 'humaniora', 'humanioraa'],
    'fakultas': ['fakultas', 'fakultas', 'fakultas', 'fakultas', 'fakultas'],
    'universitas': ['universitas', 'universitas', 'univeritas', 'universitas', 'univ'],
    
    // Program Studi & Akademik
    'prodi': ['prodi', 'prodj', 'prody', 'prod', 'porodi', 'prode', 'prodie'],
    'program': ['program', 'progam', 'progrem', 'porogram', 'programm'],
    'studi': ['studi', 'study', 'studi', 'studi', 'studi'],
    'jurusan': ['jurusan', 'jurusan', 'jurusan', 'jurussan', 'juruzan'],
    'pendidikan': ['pendidikan', 'pendidkan', 'pendidkan', 'pendidkan', 'pendidican'],
    'akreditasi': ['akreditasi', 'akreditas', 'akredittasi'],
    'prestasi': ['prestasi', 'prestasi', 'prestasi'],
    
    // Lokasi & Kontak
    'tazkia': ['tazkia', 'tazkiaa', 'tazkya', 'tazki', 'tazkia', 'tazkie', 'tazkiah'],
    'lokasi': ['lokasi', 'lokasi', 'lokasi', 'lokasi', 'lokasi'],
    'alamat': ['alamat', 'alamat', 'alamat', 'alamat', 'alamat'],
    'kontak': ['kontak', 'kontak', 'kontak', 'kontak', 'kontak'],
    'telepon': ['telepon', 'telepon', 'telepon', 'telepon', 'telepon'],
    
    // Ekonomi Syariah & Murabahah
    'murabahah': ['murabahah', 'murobahah', 'murabaha', 'murobaha', 'murabahha', 'murabahaah'],
    'riba': ['riba', 'ribaa', 'ryba', 'ribah', 'reba'],
    'syariah': ['syariah', 'shariah', 'syaria', 'sharia', 'syariyah', 'shariyah'],
    'fatwa': ['fatwa', 'fatwah', 'fathwa', 'fatva', 'fatawa'],
    'halal': ['halal', 'halall', 'halel', 'halil', 'halaal'],
    'haram': ['haram', 'haramm', 'harom', 'harum', 'haraam'],
    'akad': ['akad', 'akaad', 'akid', 'aqad', 'aqid'],
    'dsn-mui': ['dsn-mui', 'dsn mui', 'dsn', 'dsnmu', 'dsn mui'],
    'bank syariah': ['bank syariah', 'bank syaria', 'bank shariah', 'bank syari', 'bank syariyah'],
    'jual beli': ['jual beli', 'jualbeli', 'jual-beli', 'juak beli', 'jual bel'],
    'urban': ['urban', 'urbun', 'urbaan', 'urbann', 'urbaan'],
    'jaminan': ['jaminan', 'jaminan', 'jaminan', 'jaminann', 'jaminan'],
    'pailit': ['pailit', 'pailiit', 'paylit', 'pailitt', 'pailiit'],
    'arbitrase': ['arbitrase', 'arbitrasi', 'arbitrasee', 'arbitrase', 'arbitrase'],
    'nasabah': ['nasabah', 'nasabaah', 'nasabahh', 'nasabah', 'nasabah'],
    'keuntungan': ['keuntungan', 'keuntungann', 'keuntungan', 'keuntungan', 'keuntungan'],

    // ✅ TAMBAHAN TYPO UNTUK SHORT ANSWER
    'lebih lanjut': ['lebih lanjut', 'lbh lanjut', 'lebihlanjut', 'lbh lanjut', 'lebi lanjut'],
    'ingin': ['ingin', 'ingn', 'inggin', 'ingi', 'ingiin'],
    'tahu': ['tahu', 'tau', 'tahu', 'thu', 'thau'],
    'bagaimana': ['bagaimana', 'gimana', 'bagaimna', 'bagaimna', 'bgaimana'],
  },

  // =============================================================================
  // 3. CONTEXTUAL EXPANSIONS - Tambahan query berdasarkan konteks
  // =============================================================================
  contextualExpansions: {
    // Kampus & Institusi
    'feb': ['fakultas ekonomi bisnis syariah', 'digital business', 'islamic finance', 'halal industry', 'accounting auditing'],
    'febs': ['fakultas ekonomi bisnis syariah', 'ekonomi bisnis', 'program studi febs', 'fakultas ekonomi'],
    'humaniora': ['fakultas pendidikan hukum komunikasi', 'islamic family law', 'journalism content creation', 'al quran hadits education', 'commercial law'],
    'fakultas': ['program studi', 'jurusan', 'departemen', 'fakultas universitas tazkia'],
    'universitas': ['kampus tazkia', 'perguruan tinggi', 'stmik tazkia', 'institusi pendidikan'],
    
    // Program Studi & Akademik
    'prodi': ['program studi', 'jurusan', 'daftar program studi', 'program pendidikan'],
    'program studi': ['prodi', 'jurusan', 'daftar program studi', 'program pendidikan'],
    'pendidikan': ['akademik', 'studi', 'belajar', 'kurikulum', 'mata kuliah'],
    'akademik': ['pendidikan', 'studi', 'kurikulum', 'nilai', 'ipk'],
    'kuliah': ['studi', 'pendidikan', 'perkuliahan', 'mahasiswa', 'dosen'],
    'akreditasi': ['akreditasi kampus', 'akreditasi program studi', 'peringkat akreditasi'],
    'prestasi': ['prestasi mahasiswa', 'penghargaan prestasi', 'achievement award'],
    
    // Lokasi & Kontak
    'lokasi': ['lokasi kampus', 'alamat universitas', 'jl ir h djuanda sentul city bogor', 'sentul city bogor'],
    'alamat': ['lokasi kampus', 'alamat universitas', 'jl ir h djuanda sentul city bogor', 'sentul city bogor'],
    'kontak': ['kontak kampus', 'hotline tazkia', '082184800600', '08995499900'],
    'telepon': ['kontak kampus', 'hotline tazkia', '082184800600', '08995499900'],
    'tazkia': ['universitas tazkia', 'stmik tazkia', 'kampus tazkia', 'lokasi tazkia'],
    
    // Ekonomi Syariah & Murabahah
    'murabahah': ['fatwa murabahah dsn-mui', 'jual beli murabahah', 'transaksi murabahah', 'akad murabahah', 'pembiayaan murabahah'],
    'riba': ['larangan riba', 'bahaya riba', 'riba dalam islam', 'hukum riba', 'dosa riba'],
    'syariah': ['ekonomi syariah', 'prinsip syariah', 'hukum syariah', 'perbankan syariah', 'keuangan syariah'],
    'fatwa': ['fatwa dsn-mui', 'fatwa syariah', 'keputusan hukum islam', 'fatwa ulama', 'ketetapan syariah'],
    'halal': ['halal dalam islam', 'makanan halal', 'transaksi halal', 'bisnis halal', 'produk halal'],
    'haram': ['haram dalam islam', 'larangan syariah', 'dosa besar', 'makanan haram', 'transaksi haram'],
    'akad': ['akad syariah', 'kontrak islami', 'perjanjian syariah', 'akad jual beli', 'akad murabahah'],
    'dsn-mui': ['dewan syariah nasional majelis ulama indonesia', 'fatwa dsn', 'keputusan dsn-mui', 'lembaga syariah'],
    'bank syariah': ['produk bank syariah', 'pembiayaan syariah', 'tabungan syariah', 'deposito syariah', 'kredit syariah'],
    'jual beli': ['jual beli syariah', 'transaksi jual beli islami', 'prinsip jual beli', 'akad jual beli'],
    'urban': ['uang muka murabahah', 'down payment syariah', 'advance payment islamic', 'urbun dalam jual beli'],
    'jaminan': ['jaminan dalam murabahah', 'collateral syariah', 'agunan pembiayaan', 'jaminan nasabah'],
    'pailit': ['hukum pailit syariah', 'bangkrut dalam islam', 'penyelesaian utang pailit', 'keringanan pailit'],
    'arbitrase': ['badan arbitrasi syariah nasional', 'penyelesaian sengketa syariah', 'mediasi perbankan syariah'],
    'nasabah': ['hak dan kewajiban nasabah', 'kewajiban nasabah murabahah', 'peran nasabah dalam akad'],
    'menunda bayar': ['konsekuensi menunda bayar', 'hukum menunda pembayaran', 'sanksi telat bayar'],
    'suka sama suka': ['prinsip kerelaan dalam islam', 'suka sama suka dalam transaksi', 'ridha dalam jual beli'],

    // ✅ EKSPANSI UNTUK SHORT ANSWER & PENAWARAN
    'lebih lanjut': [
      'informasi lebih detail', 
      'penjelasan lengkap', 
      'rincian tambahan', 
      'detail informasi',
      'ketentuan lengkap'
    ],
    
    'ingin tahu': [
      'mau mengetahui lebih lanjut',
      'ingin informasi detail',
      'penasaran dengan rincian',
      'ingin belajar lebih dalam'
    ],
    
    'apa itu': [
      'pengertian definisi',
      'arti dan makna',
      'penjelasan konsep',
      'pemahaman dasar'
    ],
    
    'dimana': [
      'lokasi tempat',
      'alamat letak',
      'posisi geografis',
      'denah lokasi'
    ],
    
    'bagaimana': [
      'cara proses',
      'tahapan langkah',
      'mekanisme prosedur',
      'alur kerja'
    ]
  },

  // =============================================================================
  // 4. CONTEXTUAL KEYWORDS - Untuk deteksi konteks query
  // =============================================================================
  contextualKeywords: {
    // Fasilitas Kampus
    'fasilitas': ['fasilitas', 'sarana', 'prasarana', 'infrastruktur'],
    'perpustakaan': ['perpustakaan', 'library', 'buku', 'referensi'],
    'laboratorium': ['laboratorium', 'lab', 'praktikum', 'eksperimen'],
    'asrama': ['asrama', 'boarding', 'dormitory', 'tempat tinggal'],
    'olahraga': ['olahraga', 'sport', 'arena', 'lapangan'],
    
    // Karir & Alumni
    'karir': ['karir', 'kerja', 'pekerjaan', 'profesi'],
    'alumni': ['alumni', 'lulusan', 'mantan mahasiswa', 'graduate'],
    'prospek': ['prospek', 'peluang', 'masa depan', 'opportunity'],
    'lowongan': ['lowongan', 'vacancy', 'rekruitmen', 'hiring'],
    'perusahaan': ['perusahaan', 'company', 'korporasi', 'bisnis'],
    
    // Akademik & Administrasi
    'registrasi': ['registrasi', 'pendaftaran', 'daftar ulang', 'registration'],
    'kurikulum': ['kurikulum', 'syllabus', 'mata kuliah', 'course'],
    'dosen': ['dosen', 'lecturer', 'pengajar', 'guru besar'],
    'jadwal': ['jadwal', 'schedule', 'kalender akademik', 'timetable'],
    'sertifikasi': ['sertifikasi', 'sertifikat', 'certification', 'kualifikasi'],
    
    // Ekonomi Syariah & Hukum Islam
    'hukum': ['hukum', 'fiqh', 'aturan', 'regulasi', 'peraturan'],
    'fiqh': ['fiqh', 'hukum islam', 'yurisprudensi islam', 'fiqih', 'hukum syariah'],
    'muamalah': ['muamalah', 'transaksi', 'bisnis islam', 'ekonomi islam', 'fiqh muamalah'],
    'zakat': ['zakat', 'sedekah', 'infaq', 'zakat mal', 'zakat fitrah'],
    'shadaqah': ['shadaqah', 'sedekah', 'infaq', 'amal', 'derma'],
    'quran': ['quran', 'al quran', 'al-quran', 'kitab suci', 'firman allah'],
    'hadits': ['hadits', 'hadis', 'sunnah', 'perkataan nabi', 'tradisi nabi'],
    'ulama': ['ulama', 'ustadz', 'kyai', 'ahli fiqh', 'cendekiawan muslim'],
    'islamic finance': ['islamic finance', 'keuangan islam', 'fintech syariah', 'ekonomi islam', 'perbankan islam'],
    'arbitrase': ['arbitrase', 'penyelesaian sengketa', 'badan arbitrasi', 'mediasi syariah', 'penyelesaian konflik'],
    'transaksi': ['transaksi', 'deal', 'perjanjian', 'kesepakatan'],
    'pembiayaan': ['pembiayaan', 'financing', 'pendanaan', 'modal'],
    'angsuran': ['angsuran', 'cicilan', 'installment', 'pembayaran berkala'],
    'hutang': ['hutang', 'utang', 'debt', 'piutang'],
    'sanksi': ['sanksi', 'hukuman', 'penalty', 'konsekuensi'],
    'mampu': ['mampu', 'berkemampuan', 'mampu bayar', 'finansial sehat'],
    'tidak mampu': ['tidak mampu', 'kesulitan', 'kesempitan', 'financial distress'],
    'musyawarah': ['musyawarah', 'diskusi', 'perundingan', 'negosiasi'],
    'sengketa': ['sengketa', 'konflik', 'perselisihan', 'perbedaan pendapat'],

    // ✅ KEYWORD UNTUK DETECTION SHORT ANSWER
    'question_type_definition': [
      'apa itu', 'pengertian', 'definisi', 'arti', 'maksud', 'apakah yang dimaksud',
      'jelaskan', 'uraikan', 'terangkan'
    ],
    
    'question_type_location': [
      'dimana', 'di mana', 'lokasi', 'alamat', 'tempat', 'letak',
      'alamatnya', 'lokasinya', 'tempatnya'
    ],
    
    'question_type_procedure': [
      'bagaimana', 'cara', 'proses', 'tahapan', 'langkah', 'mekanisme',
      'alur', 'prosedur', 'tata cara'
    ],
    
    'question_type_program': [
      'program studi', 'prodi', 'jurusan', 'fakultas', 'konsentrasi',
      'spesialisasi', 'peminatan', 'bidang studi'
    ],
    
    'question_type_syariah': [
      'murabahah', 'riba', 'syariah', 'fatwa', 'halal', 'haram',
      'akad', 'dsn-mui', 'bank syariah', 'ekonomi islam'
    ],
    
    // ✅ KEYWORD UNTUK USER ENGAGEMENT (NGGAK PAKAI PROSPECTIVE)
    'user_engaged': [
      'thanks', 'thank you', 'makasih', 'terima kasih', 'keren', 'bagus',
      'helpful', 'mantap', 'oke', 'good', 'nice', 'sip', 'ok banget'
    ]
  },

  // =============================================================================
  // 5. OFFER TEMPLATES - Untuk short answer system
  // =============================================================================
  offerTemplates: {
    definition: [
      "Apakah Anda ingin mengetahui ketentuan penting mengenai {topic} lebih lanjut?",
      "Mau tahu prinsip-prinsip dasar {topic} dalam syariah?",
      "Ingin saya jelaskan praktik penerapan {topic} di perbankan syariah?",
      "Mau belajar lebih dalam tentang {topic}?"
    ],
    
    location: [
      "Apakah perlu informasi detail tentang fasilitas {topic}?",
      "Mau tahu akses transportasi menuju {topic}?",
      "Ingin informasi lengkap tentang jam operasional {topic}?",
      "Mau lihat denah lengkap {topic}?"
    ],
    
    program: [
      "Apakah ingin mengetahui prospek karir lulusan {topic}?",
      "Mau tahu detail kurikulum dan mata kuliah {topic}?",
      "Ingin informasi syarat pendaftaran {topic}?",
      "Mau lihat daftar lengkap program {topic}?"
    ],
    
    procedure: [
      "Apakah perlu langkah-langkah detail {topic}?",
      "Mau tahu dokumen yang diperlukan untuk {topic}?",
      "Ingin informasi timeline proses {topic}?",
      "Mau dapat panduan lengkap {topic}?"
    ],
    
    syariah: [
      "Apakah ingin mengetahui fatwa lengkap mengenai {topic}?",
      "Mau tahu praktik implementasi {topic} di perbankan syariah?",
      "Ingin penjelasan detail prinsip syariah {topic}?",
      "Mau belajar lebih dalam tentang {topic} dalam fiqh?"
    ],
    
    general: [
      "Apakah Anda ingin mengetahui lebih detail tentang {topic}?",
      "Mau saya jelaskan aspek lain dari {topic}?",
      "Ingin informasi lengkap mengenai {topic}?",
      "Mau tahu selengkapnya tentang {topic}?"
    ]
  },

  // =============================================================================
  // 6. FALLBACK TEMPLATES - Untuk language variasi (TANPA PROSPECTIVE)
  // =============================================================================
  fallbackTemplates: {
    formal: [
      "Afwan, informasi tersebut belum tersedia dalam database pengetahuan saya saat ini. Untuk informasi lengkap, silakan hubungi Admin Kampus di 0821-84-800-600 atau kunjungi website resmi www.tazkia.ac.id.",
      "Afwan, saat ini informasi yang Anda tanyakan belum tersedia dalam sistem. Mohon hubungi Admin Kampus di nomor 0821-84-800-600 untuk bantuan lebih lanjut.",
      "Alhamdulillah, saya ingin membantu namun informasi spesifik tersebut sedang tidak tersedia. Silakan langsung konsultasi dengan Admin Kampus di 0821-84-800-600 untuk jawaban yang akurat."
    ],
    
    casual: [
      "Wah, sepertinya informasi ini belum ada di databasenya Kia nih 😊 Tapi jangan khawatir! Langsung aja chat Admin Kampus di 0821-84-800-600, mereka pasti bisa bantu!",
      "Hmm, Kia belum punya info detail tentang ini nih. Tapi coba langsung tanya ke Admin Kampus di 0821-84-800-600, mereka solusinya! 🚀",
      "Nampaknya Kia perlu update database nih untuk pertanyaan ini 😅 Sambil itu, yuk langsung konsultasi dengan Admin Kampus di 0821-84-800-600, dijamin dapat jawaban lengkap!",
      "Waduh, Kia lagi blank nih soal yang satu ini 🤔 Tapi tenang aja, Admin Kampus di 0821-84-800-600 pasti bisa kasih jawaban yang tepat!"
    ]
  }
};