import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Bug } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function ReportBugPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (title.trim().length < 10) {
      setError('Judul minimal 10 karakter.');
      return;
    }
    if (title.trim().length > 200) {
      setError('Judul maksimal 200 karakter.');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/bug-reports`,
        { title: title.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim laporan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg, #0A1560 0%, #1E3BCC 55%, #3D4FE0 100%)' }}
    >
      <div className="max-w-xl mx-auto px-4 md:px-8 py-10 md:py-16">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali
        </button>

        {!submitted ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <Bug size={22} className="text-white/60" />
              <h1 className="text-2xl md:text-3xl font-bold">Report a Bug</h1>
            </div>
            <p className="text-white/50 text-sm mb-8">Temukan masalah? Beritahu kami.</p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Judul Bug <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Tombol kirim pesan tidak merespons"
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/50 transition-colors"
                />
                <div className="flex justify-between mt-1.5">
                  {error
                    ? <p className="text-red-400 text-xs">{error}</p>
                    : <span />
                  }
                  <span className="text-white/25 text-xs ml-auto">{title.length}/200</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
              >
                {loading ? 'Mengirim...' : 'Kirim Laporan'}
              </button>
            </form>
          </>
        ) : (
          /* Success state */
          <div className="text-center py-12">
            <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Laporan Terkirim!</h2>
            <p className="text-white/50 text-sm mb-8">
              Terima kasih sudah melaporkan masalah ini. Tim kami akan segera menindaklanjutinya.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => { setTitle(''); setSubmitted(false); }}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-colors"
              >
                Kirim laporan lain
              </button>
              <button
                onClick={() => navigate('/chat')}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-sm font-medium transition-colors"
              >
                Kembali ke Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
