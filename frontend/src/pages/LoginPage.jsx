import React from 'react';
// Mengimpor Link dari react-router-dom untuk navigasi yang benar
import { Link } from 'react-router-dom'; 

const LoginPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-purple-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">Login Mahasiswa</h1>
        <p className="text-gray-600 text-center mb-8">Sapa Tazkia Chatbot</p>
        
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">NIM</label>
            <input
              type="text"
              placeholder="Masukkan NIM Anda"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              placeholder="Masukkan Password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors"
          >
            Login
          </button>
        </form>
        
        <p className="text-center text-sm text-gray-600 mt-6">
          Belum punya akun? 
          {/* Mengganti <a> dengan <Link> dan href="#" dengan to="/register" untuk perbaikan A11y */}
          <Link to="/register" className="text-orange-500 hover:underline ml-1">
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
