import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TentangPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Satoshi', sans-serif" }}>
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Kembali
        </button>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 md:px-8 py-12">
        {/* H1 */}
        <h1 className="text-3xl font-bold text-black mb-2 text-center">
          Sapa Tazkia
        </h1>
        <p className="text-center text-gray-500 text-sm mb-10">
          AI Chatbot Akademik — Universitas Tazkia
        </p>

        {/* Deskripsi */}
        <p className="text-black text-base leading-relaxed mb-4">
          <strong>Sapa Tazkia</strong> adalah asisten kecerdasan buatan (AI) berbasis{' '}
          <em>Retrieval-Augmented Generation (RAG)</em> yang dirancang khusus untuk mendukung
          kegiatan akademik mahasiswa <strong>Universitas Tazkia</strong>. Platform chatbot ini
          memungkinkan kamu mendapatkan informasi tentang jadwal kuliah, nilai akademik, dan
          materi perkuliahan secara instan dan akurat.
        </p>

        <p className="text-black text-base leading-relaxed mb-4">
          Dengan memanfaatkan teknologi AI terkini dan basis data pengetahuan kampus,
          Sapa Tazkia hadir sebagai solusi digitalisasi layanan pendidikan yang cerdas.
          Chatbot ini memahami konteks pertanyaan dalam bahasa Indonesia dan memberikan
          jawaban yang relevan sesuai kurikulum dan regulasi <strong>Universitas Tazkia</strong>.
        </p>

        <p className="text-black text-base leading-relaxed mb-12">
          Sapa Tazkia merupakan wujud nyata penerapan <strong>teknologi AI</strong> dalam
          dunia pendidikan tinggi Indonesia — menggabungkan inovasi, aksesibilitas, dan
          kualitas layanan akademik dalam satu platform terintegrasi.
        </p>

        {/* Fitur Utama */}
        <h2 className="text-xl font-bold text-black mb-5">Fitur Utama</h2>
        <div className="grid md:grid-cols-3 gap-5 mb-14">
          {[
            {
              title: 'Tanya Jawab Akademik',
              desc: 'Jawab pertanyaan seputar jadwal, nilai, dan mata kuliah menggunakan basis pengetahuan kampus secara real-time.',
            },
            {
              title: 'Berbasis RAG & AI',
              desc: 'Menggunakan Retrieval-Augmented Generation untuk jawaban yang akurat dan relevan, bukan sekadar template.',
            },
            {
              title: 'Akses Multi-Platform',
              desc: 'Tersedia di browser desktop maupun mobile. Login dengan NIM atau akun Google kampus kamu.',
            },
          ].map((f) => (
            <div key={f.title} className="border border-gray-200 rounded-xl p-5">
              <h3 className="font-bold text-black mb-2 text-sm">{f.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Tentang Pengembang */}
        <div className="bg-gray-50 rounded-2xl p-8 mb-10">
          <h2 className="text-xl font-bold text-black mb-3">Tentang Pengembang</h2>
          <p className="text-black leading-relaxed mb-3 text-sm">
            Sapa Tazkia dikembangkan oleh tim mahasiswa Program Studi Sistem Informasi{' '}
            <strong>STMIK Tazkia</strong> sebagai proyek riset terapan di bidang kecerdasan
            buatan dan sistem informasi akademik. Proyek ini dibimbing oleh dosen dan staf IT
            STMIK Tazkia untuk memastikan kualitas, keamanan, dan relevansi terhadap
            kebutuhan civitas akademika.
          </p>
          <p className="text-black leading-relaxed text-sm">
            Kami berkomitmen untuk terus meningkatkan kemampuan AI ini berdasarkan feedback
            dari mahasiswa dan kebutuhan nyata lingkungan kampus.
          </p>
        </div>

        {/* Footer / Kontak */}
        <div className="border-t border-gray-200 pt-8">
          <div className="flex flex-col md:flex-row justify-between gap-6 text-sm">
            <div>
              <p className="font-bold text-black mb-1">Sapa Tazkia</p>
              <p className="text-gray-500">AI Chatbot Akademik — STMIK Tazkia</p>
              <p className="text-gray-500">Bogor, Jawa Barat, Indonesia</p>
            </div>
            <div>
              <p className="font-bold text-black mb-1">Kontak</p>
              <p className="text-gray-500">
                Email:{' '}
                <a href="mailto:sapa@stmik.tazkia.ac.id" className="text-blue-600 hover:underline">
                  sapa@stmik.tazkia.ac.id
                </a>
              </p>
              <p className="text-gray-500">
                Website:{' '}
                <a
                  href="https://sapa.tazkia.ac.id"
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  stmik-tazkia.ac.id
                </a>
              </p>
            </div>
            <div>
              <p className="font-bold text-black mb-1">Legal</p>
              <p className="text-gray-500">© {new Date().getFullYear()} STMIK Tazkia.</p>
              <p className="text-gray-500">Hak cipta dilindungi undang-undang.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
