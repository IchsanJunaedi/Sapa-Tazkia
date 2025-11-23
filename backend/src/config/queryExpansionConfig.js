// config/queryExpansionConfig.js

module.exports = {
  // =============================================================================
  // 1. SYNONYM MAP - Untuk kata yang sama artinya - ✅ DIPERBARUI
  // =============================================================================
  synonymMap: {
    // ✅ GREETINGS - Dipertahankan
    'halo': ['halo', 'hai', 'hi', 'hello', 'assalamualaikum', 'salam', 'selamat'],
    'hai': ['hai', 'halo', 'hi', 'hello'],
    'assalamualaikum': ['assalamualaikum', 'salam', 'halo', 'hai', 'waalaikumsalam'],
    'salam': ['salam', 'assalamualaikum', 'halo', 'hai'],
    'selamat': ['selamat', 'salam', 'halo'],

    // ✅ BARU: KELOMPOK FAKULTAS (Mapping Singkatan & Istilah Umum)
    'febs': ['febs', 'fakultas ekonomi bisnis syariah', 'ekonomi bisnis', 'feb', 'fakultas ekonomi'],
    'humaniora': ['humaniora', 'fakultas pendidikan hukum komunikasi', 'fphk', 'fakultas hukum', 'fakultas komunikasi'],
    'saintek': ['saintek', 'fakultas sains dan teknologi', 'teknik', 'fst', 'fakultas teknik'],
    'tarbiyah': ['tarbiyah', 'fakultas pendidikan', 'keguruan', 'fakultas tarbiyah'],
    'pascasarjana': ['pascasarjana', 's2', 'magister', 'graduate school', 'sekolah pasca'],

    // ✅ BARU: PROGRAM STUDI: SAINS & TEKNOLOGI
    'teknik informatika': ['teknik informatika', 'ti', 'it', 'informatika', 'ilmu komputer', 'coding', 'programmer', 'software engineer', 'rekayasa perangkat lunak'],
    'sistem informasi': ['sistem informasi', 'si', 'information system', 'manajemen data', 'analis sistem', 'business analyst'],

    // ✅ BARU: PROGRAM STUDI: FEBS (EKONOMI)
    'bisnis digital': ['bisnis digital', 'digital business', 'bisnis online', 'start up', 'wirausaha digital', 'e-commerce'],
    'manajemen haji': ['manajemen haji umroh', 'mhu', 'travel haji', 'biro perjalanan', 'halal tourism', 'pariwisata halal'],
    'akuntansi': ['akuntansi', 'accounting', 'audit', 'pembukuan', 'laporan keuangan', 'aaoifi'],
    'keuangan islam': ['keuangan islam', 'islamic finance', 'keuangan syariah', 'perbankan'],
    'industri halal': ['industri halal', 'halal industry', 'auditor halal', 'jaminan produk halal', 'manajemen halal'],
    'analisis data': ['analisis data', 'data analytics', 'data science', 'big data', 'ai', 'kecerdasan buatan'],

    // ✅ BARU: PROGRAM STUDI: HUMANIORA (DAKWAH & KOMUNIKASI)
    'komunikasi': ['komunikasi', 'ilmu komunikasi', 'ilkom', 'public relation', 'humas', 'pr'],
    'jurnalisme': ['jurnalisme', 'jurnalistik', 'journalism', 'wartawan', 'reporter', 'pers'],
    'konten kreator': ['konten kreator', 'content creator', 'youtuber', 'influencer', 'kreator digital', 'sosmed specialist'],
    'film': ['film', 'perfilman', 'broadcasting', 'penyiaran', 'sutradara', 'video editing', 'sinematografi'],

    // ✅ BARU: PROGRAM STUDI: HUKUM & TARBIYAH
    'hukum keluarga': ['hukum keluarga islam', 'hki', 'ahwal syakhshiyyah', 'hukum perdata islam', 'penghulu', 'kua'],
    'hukum bisnis': ['hukum bisnis', 'hukum ekonomi syariah', 'hes', 'muamalat', 'lawyer bisnis', 'advokat', 'pengacara'],
    'pendidikan agama': ['pendidikan agama islam', 'pai', 'guru agama', 'tarbiyah', 'pendidikan al quran'],
    'edupreneurship': ['edupreneurship', 'kewirausahaan pendidikan', 'manajemen sekolah', 'bisnis pendidikan'],

    // Kampus & Institusi - Dipertahankan
    'feb': ['feb', 'febs', 'fakultas ekonomi bisnis syariah', 'ekonomi bisnis', 'fakultas ekonomi'],
    'fakultas': ['fakultas', 'jurusan', 'program studi', 'departemen'],
    'universitas': ['universitas', 'kampus', 'perguruan tinggi', 'university'],
    'akreditasi': ['akreditasi', 'accreditation', 'penilaian mutu'],
    'prestasi': ['prestasi', 'achievement', 'penghargaan'],
    'kompetisi': ['kompetisi', 'competition', 'lomba', 'kontes'],
    
    // Program Studi & Akademik - Dipertahankan
    'prodi': ['prodi', 'program studi', 'jurusan', 'program pendidikan', 'konsentrasi'],
    'program studi': ['program studi', 'prodi', 'jurusan', 'konsentrasi', 'spesialisasi'],
    'pendidikan': ['pendidikan', 'akademik', 'studi', 'belajar', 'education'],
    'akademik': ['akademik', 'pendidikan', 'studi', 'kurikulum'],
    'kuliah': ['kuliah', 'studi', 'pendidikan', 'belajar'],
    
    // Lokasi & Kontak - Dipertahankan
    'lokasi': ['lokasi', 'alamat', 'tempat', 'dimana', 'address', 'letak'],
    'alamat': ['alamat', 'lokasi', 'tempat', 'address'],
    'kontak': ['kontak', 'hubungi', 'telepon', 'whatsapp', 'hotline', 'call'],
    'telepon': ['telepon', 'hp', 'whatsapp', 'call', 'kontak'],
    'tazkia': ['tazkia', 'universitas tazkia', 'stmik tazkia', 'kampus tazkia'],
    
    // Ekonomi Syariah & Murabahah - Dipertahankan
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

    // KHUSUS MUDHARABAH (FATWA NO 07) - Dipertahankan
    'mudharabah': ['mudharabah', 'mudarabah', 'qiradh', 'muqaradhah', 'bagi hasil', 'kerja sama modal', 'investasi bagi hasil'],
    'qiradh': ['qiradh', 'mudharabah', 'muqaradhah', 'pembiayaan bagi hasil'],
    'shahibul maal': ['shahibul maal', 'sahibul mal', 'pemilik dana', 'penyedia dana', 'investor', 'lks', 'pemodal'],
    'mudharib': ['mudharib', 'mudarib', 'pengelola', 'amil', 'pengusaha', 'nasabah', 'mitra usaha'],
    'nisbah': ['nisbah', 'porsi keuntungan', 'rasio bagi hasil', 'persentase keuntungan', 'proporsi laba', 'prosentasi'],
    'modal': ['modal', 'dana', 'ra\'sul mal', 'kapital', 'aset', 'uang tunai'],
    'kerugian': ['kerugian', 'rugi', 'resiko', 'loss', 'defisit'],
    'produktif': ['produktif', 'menghasilkan', 'menguntungkan', 'bisnis riil'],
    'kelalaian': ['kelalaian', 'lalai', 'wanprestasi', 'menyalahi perjanjian', 'kesalahan disengaja'],
    'lks': ['lks', 'lembaga keuangan syariah', 'bank syariah', 'koperasi syariah', 'baitul maal wat tamwil'],

    // BARU: KHUSUS MUSYARAKAH (FATWA NO 08) - Dipertahankan
    'musyarakah': ['musyarakah', 'kerjasama bagi hasil', 'usaha patungan syariah', 'kemitraan dagang', 'kongsi bisnis', 'syirkah', 'perkongsian'],
    'pembiayaan musyarakah': ['pembiayaan kerjasama', 'pinjaman bagi hasil', 'modal kerjasama', 'dana kemitraan', 'pembiayaan syirkah'],
    'mitra musyarakah': ['mitra', 'partner', 'rekanan', 'teman usaha', 'pihak', 'sharik', 'semua pihak'],
    'semua pihak': ['semua pihak', 'setiap mitra', 'masing-masing pihak', 'para pihak', 'semua partner'],
    'kerja musyarakah': ['kerja', 'usaha', 'pengelolaan', 'tenaga', 'keahlian', 'kontribusi', 'kewajiban kerja'],
    'ijab qabul': ['ijab qabul', 'penawaran penerimaan', 'kesepakatan bersama', 'serah terima akad'],
    'firman allah': ['firman allah', 'ayat al-quran', 'qs.', 'surat', 'dalil quran', 'dasar quran', 'landasan quran'],
    'hadis': ['hadis', 'hadits', 'sunnah', 'riwayat','dalil hadis', 'dasar hadis', 'landasan hadis'],

    //  OPTIMASI UNTUK SHORT ANSWER & PENAWARAN - Dipertahankan
    'lebih lanjut': ['lebih lanjut', 'detail', 'informasi lengkap', 'rincian', 'penjelasan detail', 'selengkapnya'],
    'ketentuan': ['ketentuan', 'syarat', 'aturan', 'prosedur', 'kebijakan', 'ketetapan'],
    'cara': ['cara', 'proses', 'tahapan', 'mekanisme', 'langkah-langkah', 'tata cara'],
    'dimana': ['dimana', 'di mana', 'lokasi', 'tempat', 'alamat', 'letak'],
    'apa itu': ['apa itu', 'pengertian', 'definisi', 'arti', 'maksud', 'penjelasan'],
    'ingin tahu': ['ingin tahu', 'mau tahu', 'penasaran', 'ingin mengetahui', 'ingin belajar'],
    'bagaimana': ['bagaimana', 'cara', 'proses', 'mekanisme', 'tahapan'],
    'bisa': ['bisa', 'dapat', 'mampu', 'memungkinkan', 'boleh'],

    // Konsep Inti Ijarah - Dipertahankan
    'ijarah': ['ijarah', 'sewa menyewa syariah', 'sewa barang syariah', 'penyewaan islami', 'akad sewa', 'ujrah', 'sewa manfaat'],
    'pembiayaan ijarah': ['pembiayaan sewa', 'pinjaman sewa syariah', 'leasing syariah', 'sewa pembiayaan', 'pembiayaan penyewaan'],
    
    // Pihak dalam Akad - Dipertahankan
    'pemberi sewa': ['pemberi sewa', 'pemberi jasa', 'lessor', 'pemilik barang', 'muajjir', 'pihak pertama'],
    'penyewa': ['penyewa', 'pengguna jasa', 'lessee', 'penyewa barang', 'mustajjir', 'nasabah ijarah'],
    
    // Komponen Akad - Dipertahankan
    'manfaat': ['manfaat', 'guna', 'kegunaan', 'faedah', 'utility', 'hak guna'],
    'sewa': ['sewa', 'upah', 'ujrah', 'fee', 'biaya sewa', 'rental', 'pembayaran sewa'],
    'barang sewa': ['barang sewa', 'aset disewa', 'obyek sewa', 'barang yang disewakan', 'alat sewa'],
    
    // Jenis Ijarah - Dipertahankan
    'ijarah barang': ['ijarah barang', 'sewa barang', 'penyewaan aset', 'sewa alat', 'rental barang'],
    'ijarah jasa': ['ijarah jasa', 'sewa jasa', 'upah jasa', 'fee jasa', 'imbalan jasa'],
  },

  // =============================================================================
  // 2. COMMON TYPOS - Untuk koreksi typo otomatis - ✅ DIPERBARUI
  // =============================================================================
  commonTypos: {
    // ✅ BARU: TYPO JURUSAN & FAKULTAS
    'teknik': ['tekhnik', 'teknic', 'technic', 'tekniq'],
    'informatika': ['informatik', 'imformatika', 'informatica', 'informatik'],
    'bisnis': ['bisniss', 'bussiness', 'business', 'bisnes'],
    'digital': ['dijital', 'digitel', 'degital'],
    'manajemen': ['managemen', 'menajemen', 'manajemenn', 'management'],
    'akuntansi': ['akuntasi', 'akutansi', 'accountansi', 'accounting'],
    'syariah': ['sariah', 'syari', 'shariah', 'syariah'],
    'komunikasi': ['komunikasih', 'comunication', 'komuniksai'],
    'jurnalistik': ['jurnalis', 'jurnalist', 'jurnalism'],
    'tarbiyah': ['tarbiah', 'tarbiya', 'tarbiyah'],
    'saintek': ['saintk', 'sainstk', 'sainteks'],
    'psikologi': ['pisikologi', 'piskologi'],

    // GREETINGS - Dipertahankan
    'halo': ['halo', 'halo', 'halow', 'haloh', 'haloo', 'aloh', 'helo'],
    'hai': ['hai', 'hay', 'hei', 'hey', 'haii', 'hayy'],
    'assalamualaikum': ['assalamualaikum', 'asalamualaikum', 'assalamu alaikum', 'salamualaikum', 'assalamualaykum'],
    'salam': ['salam', 'salam', 'salam', 'salam'],

    // Kampus & Institusi - Dipertahankan
    'feb': ['feb', 'febs', 'febz', 'febp', 'febss', 'febsi'],
    'febs': ['febs', 'feb', 'febz', 'febss', 'febsi', 'febis'],
    'humaniora': ['humaniora', 'humanior', 'humaniorra', 'humaniora', 'humanioraa'],
    'fakultas': ['fakultas', 'fakultas', 'fakultas', 'fakultas', 'fakultas'],
    'universitas': ['universitas', 'universitas', 'univeritas', 'universitas', 'univ'],
    
    // Program Studi & Akademik - Dipertahankan
    'prodi': ['prodi', 'prodj', 'prody', 'prod', 'porodi', 'prode', 'prodie'],
    'program': ['program', 'progam', 'progrem', 'porogram', 'programm'],
    'studi': ['studi', 'study', 'studi', 'studi', 'studi'],
    'jurusan': ['jurusan', 'jurusan', 'jurusan', 'jurussan', 'juruzan'],
    'pendidikan': ['pendidikan', 'pendidkan', 'pendidkan', 'pendidkan', 'pendidican'],
    'akreditasi': ['akreditasi', 'akreditas', 'akredittasi'],
    'prestasi': ['prestasi', 'prestasi', 'prestasi'],
    
    // Lokasi & Kontak - Dipertahankan
    'tazkia': ['tazkia', 'tazkiaa', 'tazkya', 'tazki', 'tazkia', 'tazkie', 'tazkiah'],
    'lokasi': ['lokasi', 'lokasi', 'lokasi', 'lokasi', 'lokasi'],
    'alamat': ['alamat', 'alamat', 'alamat', 'alamat', 'alamat'],
    'kontak': ['kontak', 'kontak', 'kontak', 'kontak', 'kontak'],
    'telepon': ['telepon', 'telepon', 'telepon', 'telepon', 'telepon'],
    
    // Ekonomi Syariah & Murabahah - Dipertahankan
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

    // mudharabah - Dipertahankan
    'mudharabah': ['mudharabah', 'mudhorobah', 'mudarabah', 'mudorobah', 'mudharaba', 'mudaraba', 'mudoroba', 'mudharabbah'],
    'qiradh': ['qiradh', 'qirodh', 'kirad', 'kirod', 'qirad', 'qirod'],
    'shahibul maal': ['shahibul maal', 'shohibul maal', 'sahibul maal', 'sohibul maal', 'sahibul mal', 'sohibul mal', 'sahib al-mal'],
    'mudharib': ['mudharib', 'mudhorib', 'mudarib', 'mudorib', 'mudarip'],
    'nisbah': ['nisbah', 'nisba', 'nisbh', 'nisbat', 'ratio'],
    'muqaradhah': ['muqaradhah', 'muqorodhoh', 'muqaradah', 'mukaradah'],
    'ijab qabul': ['ijab qabul', 'ijab kabul', 'ijab kobul', 'ijab qobul'],

    // BARU: TYPO KHUSUS MUSYARAKAH - Dipertahankan
    'musyarakah': ['musyaraka', 'musyarokah', 'musharakah', 'musarakah', 'mysyarakah', 'muyarakah'],
    'syirkah': ['syirkah', 'shirkah', 'syirqah', 'shirqah'],
    'bagi hasil': ['bagihasil', 'bagi-hasil', 'bg hasil', 'bagi hasl'],

    // TAMBAHAN TYPO UNTUK SHORT ANSWER - Dipertahankan
    'lebih lanjut': ['lebih lanjut', 'lbh lanjut', 'lebihlanjut', 'lbh lanjut', 'lebi lanjut'],
    'ingin': ['ingin', 'ingn', 'inggin', 'ingi', 'ingiin'],
    'tahu': ['tahu', 'tau', 'tahu', 'thu', 'thau'],
    'bagaimana': ['bagaimana', 'gimana', 'bagaimna', 'bagaimna', 'bgaimana'],

    // Istilah Khusus Ijarah - Dipertahankan
    'ijarah': ['ijaroh', 'ijara', 'ijorah', 'ijarah', 'ijarah', 'ijarah'],
    'ujrah': ['ujrah', 'ujra', 'ujroh', 'ujrah', 'ujrah'],
    'muajjir': ['muajjir', 'muajir', 'muajjer', 'muajir'],
    'mustajjir': ['mustajjir', 'mustajir', 'mustajer', 'mustajir'],
    
    // Istilah Umum - Dipertahankan
    'sewa': ['sewa', 'sewaa', 'sewa', 'sewa'],
    'manfaat': ['manfaat', 'manfaar', 'manffaat', 'manfaat'],
  },

  // =============================================================================
  // 3. CONTEXTUAL EXPANSIONS - Tambahan query berdasarkan konteks - ✅ DIPERBARUI
  // =============================================================================
  contextualExpansions: {
    // ✅ BARU: INTENT MINAT TEKNOLOGI (Arahkan ke Saintek/Bisnis Digital)
    'coding': [
      'teknik informatika fakultas sains teknologi',
      'sistem informasi manajemen data',
      'pengembangan software aplikasi',
      'bisnis digital technology entrepreneur',
      'ai data analytics machine learning'
    ],
    'it': [
      'teknik informatika', 'sistem informasi', 'teknologi informasi', 'fakultas sains teknologi'
    ],

    // ✅ BARU: INTENT MINAT BISNIS & KEUANGAN (Arahkan ke FEBS)
    'bisnis': [
      'fakultas ekonomi bisnis syariah', 'manajemen bisnis islam', 'kewirausahaan digital',
      'akuntansi audit', 'keuangan fintech', 'hukum bisnis syariah'
    ],
    'bank': [
      'perbankan islam', 'keuangan syariah', 'jurusan akuntansi', 'manajemen bisnis', 'layanan keuangan'
    ],
    'saham': [
      'pasar modal syariah', 'investasi saham', 'manajemen kekayaan islam', 'islamic wealth management'
    ],

    // ✅ BARU: INTENT MINAT KREATIF & MEDIA (Arahkan ke Humaniora/Dakwah)
    'konten': [
      'jurnalisme konten kreator', 'fakultas komunikasi', 'media penyiaran islam', 
      'digital communication', 'public relation'
    ],
    'desain': [
      'multimedia kreatif', 'film media broadcasting', 'komunikasi visual'
    ],
    'film': [
      'film media broadcasting', 'produksi video', 'sinematografi', 'fakultas humaniora'
    ],

    // ✅ BARU: INTENT MINAT HUKUM & SOSIAL (Arahkan ke Humaniora/Hukum)
    'hukum': [
      'hukum ekonomi syariah', 'hukum keluarga islam', 'fakultas syariah', 
      'advokat pengacara hakim', 'legal consultant'
    ],
    'pengacara': [
      'hukum bisnis perusahaan', 'commercial corporate law', 'litigasi syariah'
    ],

    // ✅ BARU: INTENT MINAT PENDIDIKAN (Arahkan ke Tarbiyah)
    'guru': [
      'pendidikan agama islam', 'pendidikan al quran hadits', 'fakultas tarbiyah', 
      'keguruan', 'edupreneurship'
    ],
    
    // ✅ BARU: INTENT LULUSAN/S2
    's2': [
      'program pascasarjana', 'magister ekonomi syariah', 'manajemen bisnis islam s2', 
      'studi lanjut universitas tazkia'
    ],

    // GREETINGS - Dipertahankan
    'halo': [
      'selamat datang di universitas tazkia',
      'assalamualaikum warahmatullahi wabarakatuh', 
      'sapa tazkia virtual assistant',
      'perkenalan kia asisten virtual',
      'informasi umum universitas tazkia'
    ],
    'assalamualaikum': [
      'waalaikumsalam warahmatullahi wabarakatuh',
      'salam pembuka percakapan',
      'virtual assistant tazkia',
      'kia asisten virtual universitas tazkia'
    ],
    'salam': [
      'assalamualaikum warahmatullahi wabarakatuh',
      'salam kenal dari kia',
      'virtual assistant tazkia'
    ],
    'hai': [
      'halo selamat datang',
      'sapa tazkia virtual assistant', 
      'perkenalan kia'
    ],

    // Kampus & Institusi - Dipertahankan
    'feb': ['fakultas ekonomi bisnis syariah', 'digital business', 'islamic finance', 'halal industry', 'accounting auditing'],
    'febs': ['fakultas ekonomi bisnis syariah', 'ekonomi bisnis', 'program studi febs', 'fakultas ekonomi'],
    'humaniora': ['fakultas pendidikan hukum komunikasi', 'islamic family law', 'journalism content creation', 'al quran hadits education', 'commercial law'],
    'fakultas': ['program studi', 'jurusan', 'departemen', 'fakultas universitas tazkia'],
    'universitas': ['kampus tazkia', 'perguruan tinggi', 'stmik tazkia', 'institusi pendidikan'],
    
    // Program Studi & Akademik - Dipertahankan
    'prodi': ['program studi', 'jurusan', 'daftar program studi', 'program pendidikan'],
    'program studi': ['prodi', 'jurusan', 'daftar program studi', 'program pendidikan'],
    'pendidikan': ['akademik', 'studi', 'belajar', 'kurikulum', 'mata kuliah'],
    'akademik': ['pendidikan', 'studi', 'kurikulum', 'nilai', 'ipk'],
    'kuliah': ['studi', 'pendidikan', 'perkuliahan', 'mahasiswa', 'dosen'],
    'akreditasi': ['akreditasi kampus', 'akreditasi program studi', 'peringkat akreditasi'],
    'prestasi': ['prestasi mahasiswa', 'penghargaan prestasi', 'achievement award'],
    
    // Lokasi & Kontak - Dipertahankan
    'lokasi': ['lokasi kampus', 'alamat universitas', 'jl ir h djuanda sentul city bogor', 'sentul city bogor'],
    'alamat': ['lokasi kampus', 'alamat universitas', 'jl ir h djuanda sentul city bogor', 'sentul city bogor'],
    'kontak': ['kontak kampus', 'hotline tazkia', '082184800600', '08995499900'],
    'telepon': ['kontak kampus', 'hotline tazkia', '082184800600', '08995499900'],
    'tazkia': ['universitas tazkia', 'stmik tazkia', 'kampus tazkia', 'lokasi tazkia'],
    
    // Ekonomi Syariah & Murabahah - Dipertahankan
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

    // EKSPANSI UNTUK SHORT ANSWER & PENAWARAN - Dipertahankan
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
    
    // --- EXPANSION KHUSUS MUDHARABAH (NO 7) --- - Dipertahankan
    'mudharabah': [
      'fatwa dsn mui no 07 tentang mudharabah', 
      'syarat rukun mudharabah', 
      'ketentuan bagi hasil mudharabah', 
      'perbedaan mudharabah dan musyarakah', 
      'akad qiradh'
    ],
    
    // --- EXPANSION KHUSUS MUSYARAKAH (NO 8) --- - Dipertahankan
    'musyarakah': [
      'fatwa dsn mui no 08 tentang musyarakah',
      'prinsip bagi hasil dan bagi rugi proporsional',
      'kerjasama dua pihak atau lebih dengan kontribusi dana dan kerja',
      'dalil qs shad ayat 24 tentang syirkah',
      'hadits abu daud tentang allah pihak ketiga dalam syirkah',
      'perbedaan musyarakah dan mudharabah'
    ],

    // --- EXPANSION KHUSUS IJARAH (NO 09) --- - Dipertahankan
    'ijarah': [
      'fatwa dsn mui no 09 tentang ijarah',
      'akad pemindahan hak guna manfaat barang',
      'sewa menyewa dalam syariah islam',
      'perbedaan ijarah dengan jual beli',
      'prinsip sewa manfaat tanpa pemindahan kepemilikan'
    ],

    // --- PENCARIAN TENTANG MODAL --- - Dipertahankan
    'modal': [
      // MUSYARAKAH
      'kewajiban setor modal musyarakah',
      'semua mitra wajib menyetor modal',
      'kontribusi dana masing-masing pihak',
      'bentuk modal yang diterima tunai emas perak',
      // MUDHARABAH
      'modal harus tunai tidak boleh hutang',
      'modal 100% dari lks shahibul maal',
      'penilaian aset modal non tunai',
      'modal mudharabah harus diketahui jumlahnya',
      'penyerahan modal bertahap',
      'ra\'sul mal mudharabah'
    ],
    
    // --- PENCARIAN TENTANG BAGI HASIL --- - Dipertahankan
    'keuntungan': [
      // MUSYARAKAH
      'bagi hasil keuntungan musyarakah',
      'cara pembagian keuntungan mitra', 
      'nisbah bagi hasil usaha patungan',
      'pembagian laba kerjasama syariah',
      'cara hitung bagi hasil musyarakah',
      // MUDHARABAH
      'pembagian keuntungan sesuai nisbah kesepakatan',
      'larangan memastikan nominal keuntungan (fixed return)',
      'keuntungan adalah kelebihan dari modal',
      'proporsi laba bagi hasil',
      'perubahan nisbah harus disepakati',
      'keuntungan mudharabah qiradh'
    ],
    
    'nisbah': [
      'persentase pembagian keuntungan',
      'kesepakatan nisbah di awal akad',
      'proporsi bagi hasil nasabah dan bank'
    ],

    // --- PENCARIAN TENTANG RISIKO/RUGI --- - Dipertahankan
    'kerugian': [
      // MUSYARAKAH
      'pembagian kerugian musyarakah', 
      'siapa yang tanggung rugi usaha patungan',
      'resiko kerugian dalam kerjasama',
      'bagi rugi sesuai porsi modal',
      'kerugian ditanggung semua mitra sesuai modal',
      // MUDHARABAH
      'kerugian finansial ditanggung pemilik dana (LKS)',
      'kerugian bukan tanggung jawab mudharib kecuali lalai',
      'resiko usaha mudharabah',
      'tanggung jawab kerugian akibat wanprestasi',
      'kerugian mengurangi modal'
    ],

    // --- PENCARIAN TENTANG KERJA --- - Dipertahankan
    'kerja': [
      // MUSYARAKAH
      'kontribusi kerja masing-masing mitra',
      'kewajiban usaha semua pihak',
      'pembagian tugas dalam musyarakah',
      'mitra kerja lebih dapat bagian tambahan',
      // MUDHARABAH
      'mudharib bebas mengelola usaha',
      'lks tidak ikut campur teknis manajemen'
    ],

    'jaminan': [
      'hukum jaminan dalam mudharabah',
      'jaminan untuk kelalaian mudharib',
      'agunan pembiayaan mudharabah',
      'pencairan jaminan jika melanggar akad',
      'jaminan pihak ketiga'
    ],

    // --- PENCARIAN TENTANG ATURAN MAIN --- - Dipertahankan
    'usaha': [
      'usaha produktif dan halal',
      'mudharib bebas mengelola usaha',
      'lks tidak ikut campur teknis manajemen',
      'sektor usaha mudharabah',
      'pembatasan jenis usaha (restricted mudharabah)'
    ],
    
    'syarat': [
      'syarat sah mudharabah fatwa no 7',
      'rukun mudharabah',
      'syarat modal dan keuntungan',
      'syarat ijab qabul',
      'kriteria mudharib dan shahibul maal',
      'syarat sah musyarakah fatwa no 8',
      'syarat sah ijarah fatwa no 09'
    ],
    
    'sengketa': [
      'penyelesaian perselisihan lewat badan arbitrasi',
      'musyawarah mufakat',
      'konflik antara lks dan nasabah'
    ],

    // --- PENCARIAN DALIL --- - Dipertahankan
    'dalil': [
      'surat an nisa ayat 29',
      'surat al maidah ayat 1',
      'surat al baqarah ayat 283',
      // BARU: Dalil khusus Musyarakah
      'surat shad ayat 24 tentang syirkah',
      'hadits abu daud pihak ketiga',
      // BARU: Dalil khusus Ijarah
      'surat al zukhruf ayat 32 tentang ijarah',
      'surat al baqarah ayat 233 tentang upah',
      'surat al qashash ayat 26 tentang pekerja',
      'hadits ibn majah bayar upah sebelum keringat kering',
      'hadits abd al razzaq tentang pemberitahuan upah',
      'hadits abu daud tentang sewa dengan emas perak',
      'hadits nabi tentang qiradh',
      'hadits abbas bin abdul muthallib',
      'hadits shuhaib tentang berkah jual beli',
      'kaidah fiqh muamalah'
    ],

    // BARU: EKSPANSI PERTANYAAN UMUM USER IJARAH - Dipertahankan
    'manfaat': [
      'manfaat barang atau jasa dalam ijarah',
      'hak guna tanpa kepemilikan barang',
      'obyek ijarah adalah manfaat bukan barang',
      'spesifikasi manfaat harus jelas'
    ],

    'sewa': [
      'pembayaran sewa atau upah dalam ijarah',
      'ujrah sebagai imbalan manfaat',
      'ketentuan pembayaran sewa syariah',
      'bentuk pembayaran sewa boleh tunai atau jasa'
    ],

    // BARU: EKSPANSI KEWAJIBAN PIHAK IJARAH - Dipertahankan
    'pemberi sewa': [
      'kewajiban pemberi sewa dalam ijarah',
      'menyediakan barang dan menanggung biaya pemeliharaan',
      'jaminan cacat barang dari pemberi sewa',
      'tanggung jawab lessor dalam ijarah'
    ],

    'penyewa': [
      'kewajiban penyewa dalam ijarah',
      'membayar sewa dan menjaga keutuhan barang',
      'biaya pemeliharaan ringan ditanggung penyewa',
      'tanggung jawab mustajjir atas kerusakan barang'
    ],

    // BARU: EKSPANSI PRAKTIS IJARAH - Dipertahankan
    'biaya pemeliharaan': [
      'pembagian biaya pemeliharaan dalam ijarah',
      'biaya besar ditanggung pemberi sewa',
      'biaya ringan ditanggung penyewa',
      'maintenance cost dalam akad sewa syariah'
    ],

    'kerusakan barang': [
      'tanggung jawab kerusakan barang sewa',
      'kerusakan bukan kelalaian bukan tanggung jawab penyewa',
      'jaminan cacat dari pemberi sewa',
      'force majeure dalam ijarah'
    ]
  },

  // =============================================================================
  // 4. CONTEXTUAL KEYWORDS - Untuk deteksi konteks query - ✅ DIPERBARUI
  // =============================================================================
  contextualKeywords: {
    // ✅ BARU: Keywords Spesifik Fakultas (Untuk Trigger Rules)
    'faculty_saintek': [
      'teknik informatika', 'sistem informasi', 'komputer', 'coding', 'software', 
      'it', 'teknologi', 'saintek', 'programer', 'data'
    ],
    'faculty_febs': [
      'ekonomi', 'bisnis', 'akuntansi', 'manajemen', 'keuangan', 'bank', 
      'fintech', 'haji', 'umroh', 'halal', 'febs'
    ],
    'faculty_humaniora': [
      'komunikasi', 'hukum', 'jurnalistik', 'film', 'broadcasting', 'humas', 
      'pr', 'keluarga', 'pidana', 'perdata', 'syariah'
    ],
    'faculty_tarbiyah': [
      'pendidikan', 'guru', 'mengajar', 'tarbiyah', 'quran', 'hadits', 'sekolah'
    ],
    'faculty_pasca': [
      's2', 'magister', 'pascasarjana', 'lanjut studi', 'master'
    ],

    // GREETINGS - Dipertahankan
    'greetings': [
      'halo', 'hai', 'hi', 'hello', 'assalamualaikum', 'salam', 
      'pagi', 'siang', 'sore', 'malam', 'selamat', 'waalaikumsalam'
    ],

    // Fasilitas Kampus - Dipertahankan
    'fasilitas': ['fasilitas', 'sarana', 'prasarana', 'infrastruktur'],
    'perpustakaan': ['perpustakaan', 'library', 'buku', 'referensi'],
    'laboratorium': ['laboratorium', 'lab', 'praktikum', 'eksperimen'],
    'asrama': ['asrama', 'boarding', 'dormitory', 'tempat tinggal'],
    'olahraga': ['olahraga', 'sport', 'arena', 'lapangan'],
    
    // Karir & Alumni - Dipertahankan
    'karir': ['karir', 'kerja', 'pekerjaan', 'profesi'],
    'alumni': ['alumni', 'lulusan', 'mantan mahasiswa', 'graduate'],
    'prospek': ['prospek', 'peluang', 'masa depan', 'opportunity'],
    'lowongan': ['lowongan', 'vacancy', 'rekruitmen', 'hiring'],
    'perusahaan': ['perusahaan', 'company', 'korporasi', 'bisnis'],
    
    // Akademik & Administrasi - Dipertahankan
    'registrasi': ['registrasi', 'pendaftaran', 'daftar ulang', 'registration'],
    'kurikulum': ['kurikulum', 'syllabus', 'mata kuliah', 'course'],
    'dosen': ['dosen', 'lecturer', 'pengajar', 'guru besar'],
    'jadwal': ['jadwal', 'schedule', 'kalender akademik', 'timetable'],
    'sertifikasi': ['sertifikasi', 'sertifikat', 'certification', 'kualifikasi'],
    
    // Ekonomi Syariah & Hukum Islam - Dipertahankan
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

    // ============================================================
    // KHUSUS FATWA NO 07: MUDHARABAH (Expanded Keywords) - Dipertahankan
    // ============================================================

    // Topik 1: Dasar Hukum & Dalil
    'sumber_hukum': [
        'al-quran', 'hadits', 'ijma', 'qiyas', 'kaidah fiqh', 
        'fatwa dsn', 'an-nisa 29', 'al-maidah 1', 'al-baqarah 283', 
        'riwayat thabrani', 'riwayat ibnu majah', 'shuhaib', 'abbas'
    ],
    
    // Topik 2: Mekanisme Akad
    'mekanisme_akad': [
        'modal 100%', 'tunai', 'bukan piutang', 'nisbah', 'persentase', 
        'jangka waktu', 'produktif', 'muqabil', 'ijab qabul', 'tertulis', 
        'kesepakatan', 'sukarela', 'tardhin'
    ],
    
    // Topik 3: Hak & Kewajiban
    'hak_kewajiban': [
        'hak pengawasan', 'kewajiban mengelola', 'tanggung jawab rugi', 
        'hak eksklusif mudharib', 'pembinaan', 'amanah', 'tidak boleh lalai', 
        'wanprestasi', 'pelanggaran'
    ],
    
    // Topik 4: Manajemen Risiko
    'risiko': [
        'kerugian materil', 'kerugian modal', 'kesalahan disengaja', 
        'penyimpangan', 'sengketa', 'arbitrase', 'jaminan', 'agunan', 
        'resiko bisnis', 'force majeure'
    ],

    // Topik 5: Status Harta
    'status_harta': [
        'amanah', 'yad al-amanah', 'titipan', 'modal usaha', 
        'keuntungan bersih', 'aset dinilai', 'piutang'
    ],

    // ============================================================
    // BARU: KHUSUS FATWA NO 08: MUSYARAKAH (Expanded Keywords) - Dipertahankan
    // ============================================================

    'ciri_khas_musyarakah': [
      'semua pihak setor modal', 
      'kerugian proporsional modal',
      'kontribusi dana bilateral', 
      'resiko ditanggung bersama sesuai saham',
      'qs shad ayat 24',
      'hadits pihak ketiga abu daud',
      'semua mitra aktif kerja'
    ],

    'pembeda_musyarakah': [
      'semua setor modal', 'rugi sesuai porsi', 
      'semua pihak kerja', 'kontribusi bersama',
      'semua mitra aktif', 'bagi rugi proporsional'
    ],

    // ============================================================
    // BARU: KHUSUS FATWA NO 09: IJARAH (Expanded Keywords) - Dipertahankan
    // ============================================================

    // Keyword Konsep Dasar Ijarah
    'konsep_ijarah': [
      'sewa manfaat', 'hak guna', 'tanpa kepemilikan', 
      'manfaat barang', 'manfaat jasa', 'ujrah', 'upah'
    ],

    // Keyword Pembeda Ijarah vs Lainnya
    'pembeda_ijarah': [
      'hanya manfaat', 'bukan kepemilikan', 'sewa bukan beli',
      'pemindahan hak guna', 'manfaat sementara'
    ],

    // Keyword Rukun & Syarat
    'rukun_ijarah': [
      'ijab qabul ijarah', 'pemberi sewa', 'penyewa', 
      'manfaat barang', 'manfaat jasa', 'sewa', 'upah'
    ],

    // Keyword Kewajiban Pihak
    'kewajiban_pihak': [
      'menyediakan barang', 'biaya pemeliharaan', 'jaminan cacat',
      'membayar sewa', 'menjaga keutuhan', 'penggunaan sesuai kontrak'
    ],

    // Keyword Obyek Ijarah
    'obyek_ijarah': [
      'manfaat jelas', 'spesifikasi manfaat', 'jangka waktu',
      'dibolehkan syariah', 'bukan haram', 'nyata dilaksanakan'
    ],

    // Keyword Fatwa Spesifik
    'fatwa_09': [
      'fatwa 09', 'dsn mui no 09', 'ijarah 2000',
      'no 09/dsn-mui/iv/2000', '13 april 2000'
    ],

    'pertanyaan_umum': [
      'cara kerja', 'bagi hasil', 'tanggungan rugi', 
      'syarat modal', 'kontribusi', 'resiko',
      'keuntungan', 'kerugian', 'contoh', 'perbedaan',
      // BARU: Pertanyaan spesifik musyarakah
      'usaha patungan', 'kongsi bisnis', 'kerjasama modal',
      // BARU: Pertanyaan spesifik ijarah
      'sewa manfaat', 'hak guna barang', 'biaya pemeliharaan'
    ],

    'pencarian_fatwa': [
      'fatwa 08', 'dsn mui', 'musyarakah',
      'tahun 2000', 'no 08', 'fatwa no 08',
      'fatwa 07', 'mudharabah', 'no 07',
      // BARU: Fatwa ijarah
      'fatwa 09', 'ijarah', 'no 09'
    ],

    // KEYWORD UNTUK DETECTION SHORT ANSWER - Dipertahankan
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
      'akad', 'dsn-mui', 'bank syariah', 'ekonomi islam',
      // BARU: Tambahan untuk musyarakah
      'musyarakah', 'mudharabah', 'bagi hasil', 'syirkah',
      // BARU: Tambahan untuk ijarah
      'ijarah', 'sewa syariah', 'ujrah', 'manfaat barang'
    ],
    
    // KEYWORD UNTUK USER ENGAGEMENT (NGGAK PAKAI PROSPECTIVE) - Dipertahankan
    'user_engaged': [
      'thanks', 'thank you', 'makasih', 'terima kasih', 'keren', 'bagus',
      'helpful', 'mantap', 'oke', 'good', 'nice', 'sip', 'ok banget'
    ]
  },

  // =============================================================================
  // 5. OFFER TEMPLATES - Untuk short answer system - ✅ DIPERBARUI
  // =============================================================================
  offerTemplates: {
    // ✅ BARU: Offer Khusus Akademik
    program: [
      "Apakah Anda ingin melihat kurikulum detail untuk jurusan {topic}?",
      "Mau tahu prospek karir bagi lulusan {topic}?",
      "Ingin informasi persyaratan masuk untuk program {topic}?",
      "Boleh saya jelaskan apa saja yang dipelajari di {topic}?"
    ],
    
    faculty_general: [
      "Kami memiliki Fakultas Ekonomi, Saintek, Humaniora, dan Tarbiyah. Bidang mana yang Anda minati?",
      "Apakah Anda mencari program Sarjana (S1) atau Pascasarjana (S2)?",
      "Ada jurusan spesifik yang sedang Anda cari informasinya?"
    ],

    career_path: [
      "Untuk karir di bidang {topic}, kami memiliki beberapa jurusan yang relevan. Mau saya sebutkan?",
      "Tertarik menjadi {topic}? Universitas Tazkia punya program studi yang cocok untuk itu.",
      "Mau tahu alumni kami yang sukses berkarir di bidang {topic}?"
    ],

    // GREETING - Dipertahankan
    greeting: [
      "Apakah ada yang bisa Kia bantu hari ini?",
      "Mau tanya tentang program studi atau informasi kampus?",
      "Ingin mengetahui lebih lanjut tentang Universitas Tazkia?",
      "Ada yang bisa Kia jelaskan tentang kampus atau program studi?"
    ],
    
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
      "Mau belajar lebih dalam tentang {topic} dalam fiqh?",
      // BARU: Spesifik Musyarakah
      "Ingin tahu perbedaan {topic} dengan mudharabah?",
      "Mau belajar prinsip bagi hasil dan bagi rugi dalam {topic}?"
    ],
    
    general: [
      "Apakah Anda ingin mengetahui lebih detail tentang {topic}?",
      "Mau saya jelaskan aspek lain dari {topic}?",
      "Ingin informasi lengkap mengenai {topic}?",
      "Mau tahu selengkapnya tentang {topic}?"
    ]
  },

  // =============================================================================
  // 6. FALLBACK TEMPLATES - Untuk language variasi (TANPA PROSPECTIVE) - Dipertahankan
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