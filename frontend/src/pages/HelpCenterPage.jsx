import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowLeft } from 'lucide-react';

const FAQ_DATA = [
  {
    category: 'Akun & Login',
    items: [
      {
        q: 'Bagaimana cara login ke SAPA?',
        a: 'Kamu bisa login menggunakan NIM dan password, atau akun Google. Klik tombol "Login" di halaman utama lalu pilih metode yang kamu inginkan.',
      },
      {
        q: 'Apakah saya bisa login dengan Google?',
        a: 'Ya! SAPA mendukung login dengan Google. Pastikan email Google kamu sudah terdaftar di sistem institusi.',
      },
      {
        q: 'Bagaimana jika lupa password?',
        a: 'Hubungi admin institusi untuk reset password. Fitur reset password mandiri sedang dalam pengembangan.',
      },
      {
        q: 'Bagaimana cara menghapus akun saya?',
        a: 'Untuk menghapus akun, silakan hubungi admin institusi. Data akan dihapus sesuai kebijakan privasi kami.',
      },
    ],
  },
  {
    category: 'Chat AI',
    items: [
      {
        q: 'Apa itu SAPA dan bagaimana cara kerjanya?',
        a: 'SAPA adalah asisten akademik berbasis AI yang menjawab pertanyaan mahasiswa menggunakan teknologi RAG. AI mencari informasi dari dokumen akademik yang relevan sebelum menjawab.',
      },
      {
        q: 'Apa itu RAG (Retrieval-Augmented Generation)?',
        a: 'RAG adalah teknologi yang memungkinkan AI mencari informasi dari dokumen yang tersimpan sebelum memberi jawaban. Hasilnya lebih akurat dan relevan dibanding AI generatif biasa.',
      },
      {
        q: 'Berapa batas pesan yang bisa saya kirim?',
        a: 'Setiap pengguna memiliki kuota pesan harian yang diisi ulang otomatis. Kamu bisa melihat sisa kuota di pojok kanan atas halaman chat.',
      },
      {
        q: 'Mengapa jawaban AI kadang berbeda untuk pertanyaan yang sama?',
        a: 'AI menghasilkan jawaban secara probabilistik sehingga variasi kecil adalah hal wajar. Jika jawaban kurang tepat, coba reformulasi pertanyaanmu dengan lebih spesifik.',
      },
    ],
  },
  {
    category: 'Nilai & Transkrip',
    items: [
      {
        q: 'Bagaimana cara melihat nilai saya?',
        a: 'Setelah login, buka menu "Akademik" di sidebar. Di sana kamu bisa melihat IPK, ringkasan nilai, dan detail mata kuliah.',
      },
      {
        q: 'Apakah data nilai saya aman?',
        a: 'Ya. Data nilai hanya bisa diakses oleh kamu setelah login. Kami menggunakan enkripsi dan JWT untuk melindungi data.',
      },
      {
        q: 'Bagaimana cara memperbarui data akademik?',
        a: 'Data akademik diperbarui oleh admin institusi. Jika ada data yang tidak sesuai, hubungi bagian akademik kampusmu.',
      },
    ],
  },
  {
    category: 'Privasi & Keamanan',
    items: [
      {
        q: 'Di mana data saya disimpan?',
        a: 'Data disimpan di server institusi yang aman. Kami tidak menjual atau membagikan data ke pihak ketiga tanpa izin.',
      },
      {
        q: 'Apakah percakapan saya dengan AI disimpan?',
        a: 'Ya, riwayat percakapan disimpan agar kamu bisa melanjutkan sesi sebelumnya. Kamu bisa menghapus percakapan kapan saja dari halaman chat.',
      },
      {
        q: 'Bagaimana SAPA melindungi data pengguna?',
        a: 'Kami menggunakan HTTPS, JWT, Redis session management, dan enkripsi password. Data sensitif tidak pernah disimpan dalam plaintext.',
      },
    ],
  },
];

const AccordionItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-left gap-4 hover:text-white transition-colors"
      >
        <span className="text-sm font-medium text-white/90 leading-snug">{question}</span>
        <ChevronDown
          size={16}
          className={`text-white/40 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="pb-4 text-sm text-white/70 leading-relaxed">{answer}</p>
      )}
    </div>
  );
};

export default function HelpCenterPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg, #0A1560 0%, #1E3BCC 55%, #3D4FE0 100%)' }}
    >
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 md:py-16">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali
        </button>

        {/* Header */}
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Help Center</h1>
        <p className="text-white/50 text-sm mb-10">Temukan jawaban atas pertanyaan kamu di sini.</p>

        {/* Categories */}
        <div className="space-y-8">
          {FAQ_DATA.map((cat) => (
            <div key={cat.category}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
                {cat.category}
              </h2>
              <div className="bg-white/5 border border-white/10 rounded-xl px-5">
                {cat.items.map((item) => (
                  <AccordionItem key={item.q} question={item.q} answer={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <p className="text-white/40 text-sm mb-3">Tidak menemukan jawaban yang kamu cari?</p>
          <button
            onClick={() => navigate('/report-bug')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-colors"
          >
            Laporkan masalah
          </button>
        </div>
      </div>
    </div>
  );
}
