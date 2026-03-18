import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Penerimaan Syarat',
    content:
      'Dengan mengakses atau menggunakan layanan SAPA ("Layanan"), kamu menyatakan telah membaca, memahami, dan menyetujui seluruh syarat dan ketentuan ini ("Syarat"). Jika kamu tidak menyetujui Syarat ini, harap hentikan penggunaan Layanan.',
  },
  {
    title: 'Penggunaan Layanan',
    content:
      'Layanan SAPA hanya boleh digunakan untuk keperluan akademik yang sah. Dengan menggunakan Layanan, kamu setuju untuk tidak: (a) menyalahgunakan Layanan untuk tujuan ilegal atau berbahaya; (b) mencoba meretas, mengubah, atau mengganggu sistem; (c) menggunakan bot atau alat otomatis tanpa izin tertulis; (d) menyamar sebagai orang lain atau institusi.',
  },
  {
    title: 'Akun Pengguna',
    content:
      'Kamu bertanggung jawab penuh atas keamanan akun dan semua aktivitas yang terjadi di bawah akunmu. Jangan bagikan kredensial login kepada siapa pun. Segera laporkan kepada kami jika kamu mencurigai adanya akses tidak sah ke akunmu. Kami berhak menangguhkan atau menghapus akun yang melanggar Syarat ini.',
  },
  {
    title: 'Konten & Kekayaan Intelektual',
    content:
      'Seluruh konten yang disediakan oleh Layanan — termasuk teks, desain, antarmuka, dan kode — adalah milik Tim SAPA dan dilindungi oleh hukum kekayaan intelektual yang berlaku. Jawaban yang dihasilkan AI bersifat informatif dan bukan merupakan nasihat akademik resmi. Pengguna tetap bertanggung jawab atas cara penggunaan konten tersebut.',
  },
  {
    title: 'Privasi & Data',
    content:
      'Pengumpulan dan penggunaan data pribadimu diatur dalam kebijakan privasi kami. Kami hanya mengumpulkan data yang diperlukan untuk menjalankan Layanan dan tidak akan menjualnya kepada pihak ketiga. Dengan menggunakan Layanan, kamu menyetujui pengumpulan dan pemrosesan data sebagaimana dimaksud.',
  },
  {
    title: 'Batasan Tanggung Jawab',
    content:
      'Layanan disediakan "sebagaimana adanya" tanpa jaminan apa pun, baik tersurat maupun tersirat. Tim SAPA tidak bertanggung jawab atas kerugian langsung maupun tidak langsung yang timbul dari penggunaan atau ketidakmampuan menggunakan Layanan. Informasi yang diberikan oleh AI bukan pengganti konsultasi dengan penasihat akademik resmi institusimu.',
  },
  {
    title: 'Perubahan Layanan',
    content:
      'Tim SAPA berhak mengubah, menangguhkan, atau menghentikan Layanan kapan saja. Kami akan berusaha memberikan pemberitahuan yang wajar jika terjadi perubahan signifikan yang memengaruhi penggunaan Layanan.',
  },
  {
    title: 'Kontak',
    content:
      'Jika kamu memiliki pertanyaan tentang Syarat ini atau menemukan masalah dalam penggunaan Layanan, silakan hubungi kami melalui halaman Report a Bug atau hubungi admin institusimu secara langsung.',
  },
];

export default function TermsPoliciesPage() {
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
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Terms & Policies</h1>
        <p className="text-white/30 text-xs mb-10">Terakhir diperbarui: 18 Maret 2026</p>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((sec, idx) => (
            <div key={sec.title}>
              <h2 className="text-base font-semibold mb-2 text-white">
                {idx + 1}. {sec.title}
              </h2>
              <p className="text-sm text-white/70 leading-relaxed">{sec.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
