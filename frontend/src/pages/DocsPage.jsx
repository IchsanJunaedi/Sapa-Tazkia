import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, BookOpen, HelpCircle, Shield, Users, Mail,
  ChevronDown, ChevronRight, Zap, MessageSquare,
  ArrowRight, Brain, Database, Lock, RefreshCw, AlertTriangle,
  FileText, ExternalLink, Star, Hash,
} from 'lucide-react';

// ─── FAQ Data (mirrored from HelpCenterPage) ────────────────────────────────

const FAQ_DATA = [
  {
    category: 'Akun & Login',
    icon: <Lock size={15} />,
    items: [
      { q: 'Bagaimana cara login ke SAPA?', a: 'Kamu bisa login menggunakan NIM dan password, atau akun Google. Klik tombol "Login" di halaman utama lalu pilih metode yang kamu inginkan.' },
      { q: 'Apakah saya bisa login dengan Google?', a: 'Ya! SAPA mendukung login dengan Google. Pastikan email Google kamu sudah terdaftar di sistem institusi.' },
      { q: 'Bagaimana jika lupa password?', a: 'Hubungi admin institusi untuk reset password. Fitur reset password mandiri sedang dalam pengembangan.' },
      { q: 'Bagaimana cara menghapus akun saya?', a: 'Untuk menghapus akun, silakan hubungi admin institusi. Data akan dihapus sesuai kebijakan privasi kami.' },
    ],
  },
  {
    category: 'Chat AI',
    icon: <MessageSquare size={15} />,
    items: [
      { q: 'Apa itu SAPA dan bagaimana cara kerjanya?', a: 'SAPA adalah asisten akademik berbasis AI yang menjawab pertanyaan mahasiswa menggunakan teknologi RAG. AI mencari informasi dari dokumen akademik yang relevan sebelum menjawab.' },
      { q: 'Apa itu RAG (Retrieval-Augmented Generation)?', a: 'RAG adalah teknologi yang memungkinkan AI mencari informasi dari dokumen yang tersimpan sebelum memberi jawaban. Hasilnya lebih akurat dan relevan dibanding AI generatif biasa.' },
      { q: 'Berapa batas pesan yang bisa saya kirim?', a: 'Setiap pengguna memiliki kuota pesan harian yang diisi ulang otomatis. Kamu bisa melihat sisa kuota di pojok kanan atas halaman chat.' },
      { q: 'Mengapa jawaban AI kadang berbeda untuk pertanyaan yang sama?', a: 'AI menghasilkan jawaban secara probabilistik sehingga variasi kecil adalah hal wajar. Jika jawaban kurang tepat, coba reformulasi pertanyaanmu dengan lebih spesifik.' },
    ],
  },
  {
    category: 'Nilai & Transkrip',
    icon: <FileText size={15} />,
    items: [
      { q: 'Bagaimana cara melihat nilai saya?', a: 'Setelah login, buka menu "Akademik" di sidebar. Di sana kamu bisa melihat IPK, ringkasan nilai, dan detail mata kuliah.' },
      { q: 'Apakah data nilai saya aman?', a: 'Ya. Data nilai hanya bisa diakses oleh kamu setelah login. Kami menggunakan enkripsi dan JWT untuk melindungi data.' },
      { q: 'Bagaimana cara memperbarui data akademik?', a: 'Data akademik diperbarui oleh admin institusi. Jika ada data yang tidak sesuai, hubungi bagian akademik kampusmu.' },
    ],
  },
  {
    category: 'Privasi & Keamanan',
    icon: <Shield size={15} />,
    items: [
      { q: 'Di mana data saya disimpan?', a: 'Data disimpan di server institusi yang aman. Kami tidak menjual atau membagikan data ke pihak ketiga tanpa izin.' },
      { q: 'Apakah percakapan saya dengan AI disimpan?', a: 'Ya, riwayat percakapan disimpan agar kamu bisa melanjutkan sesi sebelumnya. Kamu bisa menghapus percakapan kapan saja dari halaman chat.' },
      { q: 'Bagaimana SAPA melindungi data pengguna?', a: 'Kami menggunakan HTTPS, JWT, Redis session management, dan enkripsi password. Data sensitif tidak pernah disimpan dalam plaintext.' },
    ],
  },
];

// ─── Terms Data (mirrored from TermsPoliciesPage) ────────────────────────────

const TERMS_SECTIONS = [
  { title: 'Penerimaan Syarat', content: 'Dengan mengakses atau menggunakan layanan SAPA ("Layanan"), kamu menyatakan telah membaca, memahami, dan menyetujui seluruh syarat dan ketentuan ini ("Syarat"). Jika kamu tidak menyetujui Syarat ini, harap hentikan penggunaan Layanan.' },
  { title: 'Penggunaan Layanan', content: 'Layanan SAPA hanya boleh digunakan untuk keperluan akademik yang sah. Dengan menggunakan Layanan, kamu setuju untuk tidak: (a) menyalahgunakan Layanan untuk tujuan ilegal atau berbahaya; (b) mencoba meretas, mengubah, atau mengganggu sistem; (c) menggunakan bot atau alat otomatis tanpa izin tertulis; (d) menyamar sebagai orang lain atau institusi.' },
  { title: 'Akun Pengguna', content: 'Kamu bertanggung jawab penuh atas keamanan akun dan semua aktivitas yang terjadi di bawah akunmu. Jangan bagikan kredensial login kepada siapa pun. Segera laporkan kepada kami jika kamu mencurigai adanya akses tidak sah ke akunmu. Kami berhak menangguhkan atau menghapus akun yang melanggar Syarat ini.' },
  { title: 'Konten & Kekayaan Intelektual', content: 'Seluruh konten yang disediakan oleh Layanan — termasuk teks, desain, antarmuka, dan kode — adalah milik Tim SAPA dan dilindungi oleh hukum kekayaan intelektual yang berlaku. Jawaban yang dihasilkan AI bersifat informatif dan bukan merupakan nasihat akademik resmi. Pengguna tetap bertanggung jawab atas cara penggunaan konten tersebut.' },
  { title: 'Privasi & Data', content: 'Pengumpulan dan penggunaan data pribadimu diatur dalam kebijakan privasi kami. Kami hanya mengumpulkan data yang diperlukan untuk menjalankan Layanan dan tidak akan menjualnya kepada pihak ketiga. Dengan menggunakan Layanan, kamu menyetujui pengumpulan dan pemrosesan data sebagaimana dimaksud.' },
  { title: 'Batasan Tanggung Jawab', content: 'Layanan disediakan "sebagaimana adanya" tanpa jaminan apa pun, baik tersurat maupun tersirat. Tim SAPA tidak bertanggung jawab atas kerugian langsung maupun tidak langsung yang timbul dari penggunaan atau ketidakmampuan menggunakan Layanan. Informasi yang diberikan oleh AI bukan pengganti konsultasi dengan penasihat akademik resmi institusimu.' },
  { title: 'Perubahan Layanan', content: 'Tim SAPA berhak mengubah, menangguhkan, atau menghentikan Layanan kapan saja. Kami akan berusaha memberikan pemberitahuan yang wajar jika terjadi perubahan signifikan yang memengaruhi penggunaan Layanan.' },
  { title: 'Kontak', content: 'Jika kamu memiliki pertanyaan tentang Syarat ini atau menemukan masalah dalam penggunaan Layanan, silakan hubungi kami melalui halaman Report a Bug atau hubungi admin institusimu secara langsung.' },
];

// ─── Sidebar Config ──────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'Panduan',
    items: [
      { id: 'home', label: 'Beranda Docs', icon: <BookOpen size={14} /> },
      { id: 'fitur', label: 'Pelajari Fitur', icon: <Star size={14} /> },
      { id: 'cara-kerja', label: 'Cara Kerja', icon: <Brain size={14} /> },
    ],
  },
  {
    label: 'Dukungan',
    items: [
      { id: 'help', label: 'Help Center', icon: <HelpCircle size={14} /> },
      { id: 'contact', label: 'Contact', icon: <Mail size={14} /> },
    ],
  },
  {
    label: 'Informasi',
    items: [
      { id: 'terms', label: 'Terms & Policies', icon: <Shield size={14} /> },
      { id: 'team', label: 'Team Dev', icon: <Users size={14} /> },
    ],
  },
];

// ─── Accordion Item ──────────────────────────────────────────────────────────

const AccordionItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/8 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-4 text-left gap-4 hover:text-white transition-colors"
      >
        <span className="text-sm font-display font-medium text-white/85 leading-snug">{question}</span>
        <ChevronDown size={15} className={`text-white/35 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-sm font-display font-light text-white/60 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Content Sections ────────────────────────────────────────────────────────

const HomeContent = ({ onNavigate }) => (
  <div className="space-y-12">
    {/* Hero */}
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-display text-white/50">
        <Hash size={11} /> Dokumentasi v1.0
      </div>
      <h1 className="text-3xl md:text-4xl font-display font-medium text-white leading-tight">
        Pusat Bantuan &<br />
        <span className="text-white/45">Dokumentasi Sapa Tazkia</span>
      </h1>
      <p className="text-sm font-display font-light text-white/55 max-w-xl leading-relaxed">
        Temukan panduan lengkap, jawaban atas pertanyaan umum, informasi fitur, dan cara kerja sistem SAPA — asisten akademik berbasis AI untuk mahasiswa STMIK Tazkia.
      </p>
    </div>

    {/* Search */}
    <div className="relative max-w-xl">
      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
      <input
        type="text"
        placeholder="Cari dokumentasi..."
        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-20 py-3.5 text-sm font-display text-white placeholder-white/25 outline-none focus:border-white/25 focus:bg-white/8 transition-all"
        readOnly
        onClick={() => {}}
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-display text-white/25 border border-white/15 rounded-md px-1.5 py-0.5 pointer-events-none">
        ⌘K
      </span>
    </div>

    {/* Quick links */}
    <div className="flex flex-wrap gap-3">
      <button
        onClick={() => onNavigate('cara-kerja')}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-display font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all"
      >
        <Zap size={14} className="text-white/50" /> Mulai Chatbot
      </button>
      <button
        onClick={() => onNavigate('fitur')}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-display font-medium text-white/80 hover:bg-white/10 hover:text-white transition-all"
      >
        <BookOpen size={14} className="text-white/50" /> Lihat Panduan
      </button>
    </div>

    {/* Grid cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[
        {
          id: 'fitur',
          icon: <Star size={22} className="text-white/60" />,
          title: 'Pelajari Fitur',
          desc: 'Eksplorasi semua kemampuan SAPA — dari chat AI, manajemen nilai, hingga analitik akademik.',
        },
        {
          id: 'help',
          icon: <HelpCircle size={22} className="text-white/60" />,
          title: 'Help Center',
          desc: 'Jawaban atas pertanyaan umum seputar akun, chat AI, transkrip, dan privasi data.',
        },
        {
          id: 'cara-kerja',
          icon: <Brain size={22} className="text-white/60" />,
          title: 'Cara Kerja',
          desc: 'Pahami arsitektur RAG dan bagaimana SAPA memproses pertanyaanmu secara cerdas.',
        },
        {
          id: 'terms',
          icon: <Shield size={22} className="text-white/60" />,
          title: 'Terms & Policies',
          desc: 'Baca syarat layanan, kebijakan privasi, dan hak serta kewajiban pengguna SAPA.',
        },
      ].map(card => (
        <button
          key={card.id}
          onClick={() => onNavigate(card.id)}
          className="group text-left p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/7 hover:border-white/15 transition-all"
        >
          <div className="mb-3">{card.icon}</div>
          <h3 className="text-sm font-display font-medium text-white mb-1.5 group-hover:text-white transition-colors">{card.title}</h3>
          <p className="text-xs font-display font-light text-white/45 leading-relaxed">{card.desc}</p>
          <div className="mt-3 flex items-center gap-1 text-xs font-display text-white/30 group-hover:text-white/55 transition-colors">
            Baca selengkapnya <ArrowRight size={11} />
          </div>
        </button>
      ))}
    </div>
  </div>
);

const FiturContent = () => (
  <div className="space-y-10">
    <div>
      <p className="text-xs font-display text-white/35 uppercase tracking-widest mb-3">Panduan</p>
      <h1 className="text-2xl md:text-3xl font-display font-medium text-white mb-3">Pelajari Fitur</h1>
      <p className="text-sm font-display font-light text-white/55 leading-relaxed max-w-xl">Semua kemampuan yang tersedia di SAPA untuk mendukung perjalanan akademik kamu.</p>
    </div>
    {[
      { icon: <MessageSquare size={18} />, title: 'Chat AI Akademik', desc: 'Tanya apa saja seputar perkuliahan — jadwal, materi, dosen, atau kebijakan kampus. AI menjawab berdasarkan dokumen akademik resmi menggunakan teknologi RAG.', badge: 'Tersedia' },
      { icon: <FileText size={18} />, title: 'Manajemen Nilai & Transkrip', desc: 'Lihat IPK, ringkasan nilai per semester, dan detail mata kuliah yang sudah kamu ambil. Data diambil langsung dari sistem akademik institusi.', badge: 'Tersedia' },
      { icon: <RefreshCw size={18} />, title: 'Riwayat Percakapan', desc: 'Semua sesi chat tersimpan otomatis. Kamu bisa melanjutkan percakapan sebelumnya kapan saja dari perangkat mana pun.', badge: 'Tersedia' },
      { icon: <Database size={18} />, title: 'Ingest Dokumen', desc: 'Admin dapat mengunggah dokumen akademik (silabus, peraturan, panduan) ke vector database. SAPA akan otomatis mengindeks dan menggunakannya sebagai referensi.', badge: 'Admin only' },
      { icon: <Zap size={18} />, title: 'Rate Limiting Cerdas', desc: 'Sistem kuota pesan per pengguna dengan token bucket algorithm. Tamu mendapat kuota terbatas, pengguna terautentikasi mendapat lebih banyak.', badge: 'Tersedia' },
      { icon: <AlertTriangle size={18} />, title: 'Laporan Bug', desc: 'Temukan masalah? Kamu bisa langsung melaporkannya dari dalam aplikasi melalui halaman Report a Bug.', badge: 'Tersedia' },
    ].map((f, i) => (
      <div key={i} className="flex gap-4 p-5 rounded-2xl bg-white/4 border border-white/8">
        <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-white/55 shrink-0">{f.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-sm font-display font-medium text-white">{f.title}</h3>
            <span className="text-[10px] font-display px-2 py-0.5 rounded-full bg-white/8 text-white/40 border border-white/10">{f.badge}</span>
          </div>
          <p className="text-xs font-display font-light text-white/55 leading-relaxed">{f.desc}</p>
        </div>
      </div>
    ))}
  </div>
);

const CaraKerjaContent = () => (
  <div className="space-y-10">
    <div>
      <p className="text-xs font-display text-white/35 uppercase tracking-widest mb-3">Panduan</p>
      <h1 className="text-2xl md:text-3xl font-display font-medium text-white mb-3">Cara Kerja</h1>
      <p className="text-sm font-display font-light text-white/55 leading-relaxed max-w-xl">Memahami arsitektur dan pipeline di balik SAPA.</p>
    </div>

    {/* RAG Pipeline */}
    <div className="space-y-4">
      <h2 className="text-base font-display font-medium text-white/90">Pipeline RAG</h2>
      <p className="text-sm font-display font-light text-white/55 leading-relaxed">
        SAPA menggunakan arsitektur RAG (Retrieval-Augmented Generation) untuk menghasilkan jawaban yang akurat dan relevan berdasarkan dokumen akademik.
      </p>
      <div className="space-y-3">
        {[
          { step: '01', title: 'Ingesti Dokumen', desc: 'Admin mengunggah dokumen akademik. Sistem meng-embed setiap chunk menggunakan OpenAI text-embedding-3-small dan menyimpannya di Qdrant vector database.' },
          { step: '02', title: 'Query Pengguna', desc: 'Pertanyaan pengguna di-embed menjadi vektor, lalu dilakukan cosine similarity search di Qdrant untuk menemukan chunk dokumen paling relevan.' },
          { step: '03', title: 'Augmented Generation', desc: 'Chunk relevan + pertanyaan asli dikirim ke GPT-4o-mini sebagai konteks. Model menghasilkan jawaban yang grounded pada dokumen, bukan sekadar generasi bebas.' },
          { step: '04', title: 'Response ke Pengguna', desc: 'Jawaban dikembalikan ke frontend secara streaming. Riwayat percakapan disimpan di MySQL untuk sesi berikutnya.' },
        ].map(s => (
          <div key={s.step} className="flex gap-4 p-4 rounded-xl bg-white/4 border border-white/8">
            <span className="text-xs font-display font-medium text-white/25 w-6 shrink-0 mt-0.5">{s.step}</span>
            <div>
              <h4 className="text-sm font-display font-medium text-white mb-1">{s.title}</h4>
              <p className="text-xs font-display font-light text-white/50 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Auth Flow */}
    <div className="space-y-4">
      <h2 className="text-base font-display font-medium text-white/90">Alur Autentikasi</h2>
      <div className="p-5 rounded-2xl bg-white/4 border border-white/8 space-y-3">
        {[
          'Pengguna login via NIM+password atau Google OAuth (Passport.js)',
          'Server memvalidasi kredensial dan menerbitkan JWT token',
          'Frontend menyimpan JWT di AuthContext dan mengirimnya sebagai Bearer token',
          'authMiddleware.js memvalidasi setiap request ke route yang dilindungi',
        ].map((step, i) => (
          <div key={i} className="flex gap-3 text-sm font-display font-light text-white/60">
            <ChevronRight size={14} className="text-white/25 shrink-0 mt-0.5" />
            {step}
          </div>
        ))}
      </div>
    </div>

    {/* Tech Stack */}
    <div className="space-y-4">
      <h2 className="text-base font-display font-medium text-white/90">Tech Stack</h2>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Backend', value: 'Node.js / Express' },
          { label: 'Frontend', value: 'React 19 + Tailwind' },
          { label: 'Database', value: 'MySQL via Prisma' },
          { label: 'Vector DB', value: 'Qdrant' },
          { label: 'Cache', value: 'Redis' },
          { label: 'AI Model', value: 'GPT-4o-mini' },
        ].map(t => (
          <div key={t.label} className="p-3.5 rounded-xl bg-white/4 border border-white/8">
            <p className="text-[10px] font-display text-white/30 uppercase tracking-widest mb-1">{t.label}</p>
            <p className="text-sm font-display font-medium text-white/75">{t.value}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const HelpContent = () => (
  <div className="space-y-10">
    <div>
      <p className="text-xs font-display text-white/35 uppercase tracking-widest mb-3">Dukungan</p>
      <h1 className="text-2xl md:text-3xl font-display font-medium text-white mb-3">Help Center</h1>
      <p className="text-sm font-display font-light text-white/55 leading-relaxed">Temukan jawaban atas pertanyaan umum seputar SAPA.</p>
    </div>
    <div className="space-y-6">
      {FAQ_DATA.map(cat => (
        <div key={cat.category}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-white/35">{cat.icon}</span>
            <h2 className="text-xs font-display font-medium uppercase tracking-widest text-white/35">{cat.category}</h2>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-2xl px-5">
            {cat.items.map(item => (
              <AccordionItem key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      ))}
    </div>
    <div className="p-5 rounded-2xl bg-white/4 border border-white/8 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <p className="text-sm font-display font-medium text-white mb-1">Tidak menemukan jawaban?</p>
        <p className="text-xs font-display font-light text-white/45">Laporkan masalah atau hubungi tim kami langsung.</p>
      </div>
      <Link to="/report-bug" className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 border border-white/10 text-sm font-display text-white/80 hover:bg-white/12 transition-colors">
        Laporkan Masalah <ExternalLink size={13} />
      </Link>
    </div>
  </div>
);

const ContactContent = () => (
  <div className="space-y-10">
    <div>
      <p className="text-xs font-display text-white/35 uppercase tracking-widest mb-3">Dukungan</p>
      <h1 className="text-2xl md:text-3xl font-display font-medium text-white mb-3">Contact</h1>
      <p className="text-sm font-display font-light text-white/55 leading-relaxed">Ada pertanyaan atau masalah? Hubungi kami melalui salah satu saluran di bawah ini.</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[
        { icon: <Mail size={20} />, title: 'Email', value: 'sapatazkia@stmik-tazkia.ac.id', desc: 'Respon dalam 1–2 hari kerja' },
        { icon: <MessageSquare size={20} />, title: 'Report Bug', value: 'Formulir dalam aplikasi', desc: 'Untuk laporan bug teknis' },
        { icon: <Users size={20} />, title: 'Admin Kampus', value: 'Bagian Akademik STMIK Tazkia', desc: 'Untuk masalah data akademik' },
        { icon: <FileText size={20} />, title: 'Dokumentasi', value: 'docs.sapa.tazkia.ac.id', desc: 'Panduan lengkap di sini' },
      ].map(c => (
        <div key={c.title} className="p-5 rounded-2xl bg-white/4 border border-white/8">
          <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center text-white/50 mb-3">{c.icon}</div>
          <h3 className="text-sm font-display font-medium text-white mb-1">{c.title}</h3>
          <p className="text-sm font-display text-white/65 mb-1">{c.value}</p>
          <p className="text-xs font-display font-light text-white/35">{c.desc}</p>
        </div>
      ))}
    </div>
    <div className="p-5 rounded-2xl border border-white/8 bg-white/4">
      <h3 className="text-sm font-display font-medium text-white mb-2">Jam Layanan</h3>
      <div className="space-y-1.5 text-sm font-display font-light text-white/55">
        <p>Senin – Jumat: 08.00 – 16.00 WIB</p>
        <p>Sabtu: 08.00 – 12.00 WIB</p>
        <p className="text-white/30 text-xs mt-2">Di luar jam layanan, gunakan formulir Report Bug untuk pelaporan darurat.</p>
      </div>
    </div>
  </div>
);

const TermsContent = () => (
  <div className="space-y-10">
    <div>
      <p className="text-xs font-display text-white/35 uppercase tracking-widest mb-3">Informasi</p>
      <h1 className="text-2xl md:text-3xl font-display font-medium text-white mb-1">Terms & Policies</h1>
      <p className="text-xs font-display text-white/25 mb-4">Terakhir diperbarui: 18 Maret 2026</p>
      <p className="text-sm font-display font-light text-white/55 leading-relaxed">Syarat penggunaan layanan SAPA — harap dibaca sebelum menggunakan aplikasi.</p>
    </div>
    <div className="space-y-6">
      {TERMS_SECTIONS.map((sec, idx) => (
        <div key={sec.title} className="p-5 rounded-2xl bg-white/4 border border-white/8">
          <h2 className="text-sm font-display font-medium text-white mb-2">{idx + 1}. {sec.title}</h2>
          <p className="text-sm font-display font-light text-white/60 leading-relaxed">{sec.content}</p>
        </div>
      ))}
    </div>
  </div>
);

const TeamContent = () => (
  <div className="space-y-10">
    <div>
      <p className="text-xs font-display text-white/35 uppercase tracking-widest mb-3">Informasi</p>
      <h1 className="text-2xl md:text-3xl font-display font-medium text-white mb-3">Team Dev</h1>
      <p className="text-sm font-display font-light text-white/55 leading-relaxed">Tim pengembang di balik SAPA — asisten akademik berbasis AI untuk STMIK Tazkia.</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[
        { initials: 'FZ', name: 'Fariz Zulfikar', role: 'Fullstack Engineer', desc: 'Backend architecture, RAG pipeline, API design' },
        { initials: 'ST', name: 'Tim STMIK Tazkia', role: 'Product Owner', desc: 'Requirement, academic data, stakeholder management' },
      ].map(m => (
        <div key={m.name} className="p-5 rounded-2xl bg-white/4 border border-white/8 flex gap-4">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-display font-medium text-white/60 shrink-0">{m.initials}</div>
          <div>
            <h3 className="text-sm font-display font-medium text-white mb-0.5">{m.name}</h3>
            <p className="text-xs font-display text-white/45 mb-1.5">{m.role}</p>
            <p className="text-xs font-display font-light text-white/35 leading-relaxed">{m.desc}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="p-5 rounded-2xl bg-white/4 border border-white/8">
      <h3 className="text-sm font-display font-medium text-white mb-3">Teknologi yang Digunakan</h3>
      <div className="flex flex-wrap gap-2">
        {['React 19', 'Node.js', 'Express', 'Prisma', 'MySQL', 'Redis', 'Qdrant', 'OpenAI API', 'Tailwind CSS', 'Framer Motion', 'Docker', 'JWT'].map(t => (
          <span key={t} className="text-xs font-display px-2.5 py-1 rounded-full bg-white/6 border border-white/10 text-white/50">{t}</span>
        ))}
      </div>
    </div>
    <div className="p-5 rounded-2xl bg-white/4 border border-white/8">
      <h3 className="text-sm font-display font-medium text-white mb-2">Open Source & Kontribusi</h3>
      <p className="text-xs font-display font-light text-white/50 leading-relaxed">
        SAPA dikembangkan sebagai proyek riset akademik di STMIK Tazkia. Untuk pertanyaan teknis atau kolaborasi, silakan hubungi tim melalui halaman Contact.
      </p>
    </div>
  </div>
);

// ─── Content Map ─────────────────────────────────────────────────────────────

const CONTENT_MAP = {
  home: HomeContent,
  fitur: FiturContent,
  'cara-kerja': CaraKerjaContent,
  help: HelpContent,
  contact: ContactContent,
  terms: TermsContent,
  team: TeamContent,
};

// ─── Main DocsPage ────────────────────────────────────────────────────────────

export default function DocsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeId, setActiveId] = useState('home');
  const contentRef = useRef(null);

  // Parse ?section= from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (section && CONTENT_MAP[section]) setActiveId(section);
  }, [location.search]);

  const handleNavigate = (id) => {
    setActiveId(id);
    if (contentRef.current) contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    navigate(`/docs?section=${id}`, { replace: true });
  };

  const ActiveContent = CONTENT_MAP[activeId] || HomeContent;

  return (
    <div className="flex min-h-screen bg-[#000] text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-64 bg-[#000] border-r border-white/8 z-40 flex flex-col">
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className="flex items-center px-5 py-5 border-b border-white/8">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 hover:opacity-70 transition-opacity">
              <img src="/a2.png" alt="Sapa Tazkia" className="w-6 h-6 object-contain" />
              <span className="text-sm font-display font-medium text-white/80">Sapa Tazkia</span>
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] font-display font-medium uppercase tracking-widest text-white/25 px-2 mb-2">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-display transition-all text-left ${
                        activeId === item.id
                          ? 'bg-white/10 text-white'
                          : 'text-white/45 hover:text-white/80 hover:bg-white/5'
                      }`}
                    >
                      <span className={activeId === item.id ? 'text-white/70' : 'text-white/25'}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="px-4 py-4 border-t border-white/8">
            <Link
              to="/chat"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/8 border border-white/10 text-xs font-display font-medium text-white/65 hover:bg-white/12 hover:text-white/85 transition-all"
            >
              <MessageSquare size={13} /> Buka Chat
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top bar (breadcrumb) */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3.5 bg-[#000]/90 border-b border-white/8 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-xs font-display text-white/30">
            <button onClick={() => handleNavigate('home')} className="hover:text-white/60 transition-colors">Docs</button>
            {activeId !== 'home' && (
              <>
                <ChevronRight size={11} />
                <span className="text-white/55">
                  {NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeId)?.label}
                </span>
              </>
            )}
          </div>
          <div className="ml-auto">
            <Link to="/" className="text-xs font-display text-white/30 hover:text-white/60 transition-colors">
              ← Beranda
            </Link>
          </div>
        </header>

        {/* Scrollable content */}
        <main ref={contentRef} className="flex-1 overflow-y-auto px-5 md:px-10 py-10 max-w-3xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <ActiveContent onNavigate={handleNavigate} />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="px-5 md:px-10 py-6 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs font-display text-white/25">© 2026 SAPA Tazkia — STMIK Tazkia</p>
          <div className="flex items-center gap-4">
            <button onClick={() => handleNavigate('terms')} className="text-xs font-display text-white/25 hover:text-white/50 transition-colors">Terms</button>
            <button onClick={() => handleNavigate('contact')} className="text-xs font-display text-white/25 hover:text-white/50 transition-colors">Contact</button>
            <Link to="/report-bug" className="text-xs font-display text-white/25 hover:text-white/50 transition-colors">Report Bug</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
