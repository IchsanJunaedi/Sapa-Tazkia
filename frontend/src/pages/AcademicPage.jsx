import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig'; 
import { 
  BookOpen, 
  Download, 
  User, 
  ChevronLeft,
  GraduationCap,
  Calendar,
} from 'lucide-react';

// ✅ Import Utility PDF yang baru
import { generateTranscriptPDF } from '../utils/pdfGenerator';

const AcademicPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // 1. Fetch Data dari Backend
  useEffect(() => {
    const fetchTranscript = async () => {
      try {
        const response = await api.get('/api/academic/transcript');
        
        if (response.data.success) {
          setData(response.data.data);
        } else {
          setError('Gagal memuat data transkrip.');
        }
      } catch (err) {
        console.error('Error fetching transcript:', err);
        setError('Gagal mengambil data. Pastikan Anda sudah login.');
      } finally {
        setLoading(false);
      }
    };

    fetchTranscript();
  }, []);

  // ✅ 2. Fungsi Generate PDF (SEKARANG SUDAH SINGKAT & BENAR)
  const handleDownloadPDF = () => {
    if (!data) return;
    // Panggil fungsi dari file utils/pdfGenerator.js
    generateTranscriptPDF(data);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-orange-500 font-semibold animate-pulse">Memuat Data Akademik...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="text-red-500 font-bold mb-2">⚠️ {error}</div>
        <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">Kembali ke Dashboard</button>
      </div>
    );
  }

  const { summary, grades } = data;

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Navbar */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center text-gray-600 hover:text-orange-500 transition-colors"
          >
            <ChevronLeft size={20} className="mr-1" /> Dashboard
          </button>
          <h1 className="text-lg font-bold text-gray-800 flex items-center">
            <GraduationCap className="mr-2 text-orange-500" /> Portal Akademik
          </h1>
          <div className="w-24"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 border border-gray-100 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-2xl font-bold mr-4">
              {summary.fullName.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{summary.fullName}</h2>
              <div className="text-gray-500 text-sm mt-1 flex gap-4">
                <span className="flex items-center"><User size={14} className="mr-1"/> {summary.nim}</span>
                <span className="flex items-center"><BookOpen size={14} className="mr-1"/> {summary.programStudi}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 text-center">
             <div className="px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
                <div className="text-xs text-blue-500 font-bold uppercase">IPK</div>
                <div className="text-2xl font-bold text-blue-700">{summary.ipk.toFixed(2)}</div>
             </div>
             <div className="px-4 py-2 bg-green-50 rounded-lg border border-green-100">
                <div className="text-xs text-green-500 font-bold uppercase">SKS</div>
                <div className="text-2xl font-bold text-green-700">{summary.totalSks}</div>
             </div>
          </div>
        </div>

        {/* Tombol Download */}
        <div className="flex justify-end mb-6">
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all shadow hover:shadow-lg"
          >
            <Download size={18} className="mr-2" />
            Download Transkrip PDF
          </button>
        </div>

        {/* List Nilai */}
        <div className="space-y-8">
          {Object.keys(grades).map((semester) => (
            <div key={semester} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center">
                <Calendar size={18} className="mr-2 text-gray-500" />
                <h3 className="font-bold text-gray-800">Semester {semester}</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white border-b">
                    <tr>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Kode</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Mata Kuliah</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase text-center">SKS</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase text-center">Nilai</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase text-center">Bobot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {grades[semester].map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-500">{item.courseCode}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.courseName}</td>
                        <td className="px-6 py-4 text-sm text-center">{item.sks}</td>
                        <td className="px-6 py-4 text-sm text-center font-bold">
                           <span className={`px-2 py-1 rounded text-xs ${
                             item.grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                             item.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                             'bg-yellow-100 text-yellow-700'
                           }`}>
                             {item.grade}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-center text-gray-500">{item.gradePoint.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default AcademicPage;