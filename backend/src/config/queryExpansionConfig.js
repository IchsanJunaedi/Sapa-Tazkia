// config/queryExpansionConfig.js

module.exports = {
  // =============================================================================
  // 1. SYNONYM MAP - Untuk kata yang sama artinya (19 ENTRIES)
  // =============================================================================
  synonymMap: {
    // 1-5: Fakultas & Institusi
    'feb': ['feb', 'febs', 'fakultas ekonomi bisnis syariah', 'ekonomi bisnis', 'fakultas ekonomi'],
    'febs': ['febs', 'feb', 'fakultas ekonomi bisnis syariah', 'ekonomi bisnis', 'fakultas ekonomi'],
    'humaniora': ['humaniora', 'fakultas humaniora', 'fakultas pendidikan hukum komunikasi', 'pendidikan hukum komunikasi'],
    'fakultas': ['fakultas', 'jurusan', 'program studi', 'departemen'],
    'universitas': ['universitas', 'kampus', 'perguruan tinggi', 'university'],
    'akreditasi': ['akreditasi', 'accreditation', 'penilaian mutu'],
    'prestasi': ['prestasi', 'achievement', 'penghargaan'],
    'kompetisi': ['kompetisi', 'competition', 'lomba', 'kontes'],
    
    // 6-10: Program Studi & Akademik
    'prodi': ['prodi', 'program studi', 'jurusan', 'program pendidikan', 'konsentrasi'],
    'program studi': ['program studi', 'prodi', 'jurusan', 'konsentrasi', 'spesialisasi'],
    'pendidikan': ['pendidikan', 'akademik', 'studi', 'belajar', 'education'],
    'akademik': ['akademik', 'pendidikan', 'studi', 'kurikulum'],
    'kuliah': ['kuliah', 'studi', 'pendidikan', 'belajar'],
    
    // 11-15: Lokasi & Kontak
    'lokasi': ['lokasi', 'alamat', 'tempat', 'dimana', 'address', 'letak'],
    'alamat': ['alamat', 'lokasi', 'tempat', 'address'],
    'kontak': ['kontak', 'hubungi', 'telepon', 'whatsapp', 'hotline', 'call'],
    'telepon': ['telepon', 'hp', 'whatsapp', 'call', 'kontak'],
    'tazkia': ['tazkia', 'universitas tazkia', 'stmik tazkia', 'kampus tazkia'],
    
    // 16-19: Lainnya
    'beasiswa': ['beasiswa', 'bantuan biaya', 'financial aid', 'scholarship'],
    'biaya': ['biaya', 'biaya kuliah', 'uang kuliah', 'spp', 'biaya pendidikan'],
    'fasilitas': ['fasilitas', 'sarana', 'prasarana', 'infrastruktur', 'facilities'],
    'karir': ['karir', 'prospek kerja', 'peluang kerja', 'kerja', 'career']
  },

  // =============================================================================
  // 2. COMMON TYPOS - Untuk koreksi typo otomatis (19 ENTRIES)
  // =============================================================================
  commonTypos: {
    // 1-5: Fakultas & Institusi
    'feb': ['feb', 'febs', 'febz', 'febp', 'febss', 'febsi'],
    'febs': ['febs', 'feb', 'febz', 'febss', 'febsi', 'febis'],
    'humaniora': ['humaniora', 'humanior', 'humaniorra', 'humaniora', 'humanioraa'],
    'fakultas': ['fakultas', 'fakultas', 'fakultas', 'fakultas', 'fakultas'],
    'universitas': ['universitas', 'universitas', 'univeritas', 'universitas', 'univ'],
    
    // 6-10: Program Studi & Akademik
    'prodi': ['prodi', 'prodj', 'prody', 'prod', 'porodi', 'prode', 'prodie'],
    'program': ['program', 'progam', 'progrem', 'porogram', 'programm'],
    'studi': ['studi', 'study', 'studi', 'studi', 'studi'],
    'jurusan': ['jurusan', 'jurusan', 'jurusan', 'jurussan', 'juruzan'],
    'pendidikan': ['pendidikan', 'pendidkan', 'pendidkan', 'pendidkan', 'pendidican'],
    'akreditasi': ['akreditasi', 'akreditas', 'akredittasi'],
    'prestasi': ['prestasi', 'prestasi', 'prestasi'],
    
    // 11-15: Lokasi & Kontak
    'tazkia': ['tazkia', 'tazkiaa', 'tazkya', 'tazki', 'tazkia', 'tazkie', 'tazkiah'],
    'lokasi': ['lokasi', 'lokasi', 'lokasi', 'lokasi', 'lokasi'],
    'alamat': ['alamat', 'alamat', 'alamat', 'alamat', 'alamat'],
    'kontak': ['kontak', 'kontak', 'kontak', 'kontak', 'kontak'],
    'telepon': ['telepon', 'telepon', 'telepon', 'telepon', 'telepon'],
    
    // 16-19: Lainnya
    'ekonomi': ['ekonomi', 'ekonmi', 'ekonomi', 'ekonomy', 'ekonemi'],
    'bisnis': ['bisnis', 'bisnis', 'bismis', 'bisnis', 'bisness'],
    'beasiswa': ['beasiswa', 'beasiswa', 'beasiswa', 'beasiswa', 'beasiswa'],
    'karir': ['karir', 'karir', 'karir', 'karir', 'karir']
  },

  // =============================================================================
  // 3. CONTEXTUAL EXPANSIONS - Tambahan query berdasarkan konteks (19 ENTRIES)
  // =============================================================================
  contextualExpansions: {
    // 1-5: Fakultas & Institusi
    'feb': ['fakultas ekonomi bisnis syariah', 'digital business', 'islamic finance', 'halal industry', 'accounting auditing'],
    'febs': ['fakultas ekonomi bisnis syariah', 'ekonomi bisnis', 'program studi febs', 'fakultas ekonomi'],
    'humaniora': ['fakultas pendidikan hukum komunikasi', 'islamic family law', 'journalism content creation', 'al quran hadits education', 'commercial law'],
    'fakultas': ['program studi', 'jurusan', 'departemen', 'fakultas universitas tazkia'],
    'universitas': ['kampus tazkia', 'perguruan tinggi', 'stmik tazkia', 'institusi pendidikan'],
    
    // 6-10: Program Studi & Akademik
    'prodi': ['program studi', 'jurusan', 'daftar program studi', 'program pendidikan'],
    'program studi': ['prodi', 'jurusan', 'daftar program studi', 'program pendidikan'],
    'pendidikan': ['akademik', 'studi', 'belajar', 'kurikulum', 'mata kuliah'],
    'akademik': ['pendidikan', 'studi', 'kurikulum', 'nilai', 'ipk'],
    'kuliah': ['studi', 'pendidikan', 'perkuliahan', 'mahasiswa', 'dosen'],
    'akreditasi': ['akreditasi kampus', 'akreditasi program studi', 'peringkat akreditasi'],
    'prestasi': ['prestasi mahasiswa', 'penghargaan prestasi', 'achievement award'],
    
    // 11-15: Lokasi & Kontak
    'lokasi': ['lokasi kampus', 'alamat universitas', 'jl ir h djuanda sentul city bogor', 'sentul city bogor'],
    'alamat': ['lokasi kampus', 'alamat universitas', 'jl ir h djuanda sentul city bogor', 'sentul city bogor'],
    'kontak': ['kontak kampus', 'hotline tazkia', '082184800600', '08995499900'],
    'telepon': ['kontak kampus', 'hotline tazkia', '082184800600', '08995499900'],
    'tazkia': ['universitas tazkia', 'stmik tazkia', 'kampus tazkia', 'lokasi tazkia'],
    
    // 16-19: Lainnya
    'beasiswa': ['beasiswa', 'biaya kuliah', 'bantuan biaya pendidikan', 'financial aid'],
    'biaya': ['beasiswa', 'biaya kuliah', 'uang kuliah', 'spp', 'biaya pendidikan'],
    'fasilitas': ['perpustakaan', 'laboratorium', 'asrama mahasiswa', 'sport arena', 'ruang kelas'],
    'karir': ['prospek karir', 'peluang kerja', 'profil alumni', 'lowongan kerja', 'masa depan']
  },

  // =============================================================================
  // 4. CONTEXTUAL KEYWORDS - Untuk deteksi konteks query (19 ENTRIES)
  // =============================================================================
  contextualKeywords: {
    // 1-5: Fasilitas Kampus
    'fasilitas': ['fasilitas', 'sarana', 'prasarana', 'infrastruktur'],
    'perpustakaan': ['perpustakaan', 'library', 'buku', 'referensi'],
    'laboratorium': ['laboratorium', 'lab', 'praktikum', 'eksperimen'],
    'asrama': ['asrama', 'boarding', 'dormitory', 'tempat tinggal'],
    'olahraga': ['olahraga', 'sport', 'arena', 'lapangan'],
    
    // 6-10: Karir & Alumni
    'karir': ['karir', 'kerja', 'pekerjaan', 'profesi'],
    'alumni': ['alumni', 'lulusan', 'mantan mahasiswa', 'graduate'],
    'prospek': ['prospek', 'peluang', 'masa depan', 'opportunity'],
    'lowongan': ['lowongan', 'vacancy', 'rekruitmen', 'hiring'],
    'perusahaan': ['perusahaan', 'company', 'korporasi', 'bisnis'],
    
    // 11-15: Akademik & Administrasi
    'registrasi': ['registrasi', 'pendaftaran', 'daftar ulang', 'registration'],
    'kurikulum': ['kurikulum', 'syllabus', 'mata kuliah', 'course'],
    'dosen': ['dosen', 'lecturer', 'pengajar', 'guru besar'],
    'jadwal': ['jadwal', 'schedule', 'kalender akademik', 'timetable'],
    'sertifikasi': ['sertifikasi', 'sertifikat', 'certification', 'kualifikasi'],
    
    // 16-19: Keuangan & Beasiswa
    'uang': ['uang', 'pembayaran', 'payment', 'tuition'],
    'potongan': ['potongan', 'diskon', 'discount', 'keringanan'],
    'keringanan': ['keringanan', 'bantuan', 'assistance', 'subsidi'],
    'sponsor': ['sponsor', 'donatur', 'donor', 'pendanaan']
  }
};