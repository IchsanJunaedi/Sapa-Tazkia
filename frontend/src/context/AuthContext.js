import React, { createContext, useContext, useState, useEffect } from 'react';
// Import instance axios yang baru saja kita buat
import api from 'api/axiosConfig';

// 1. Buat Context
const AuthContext = createContext(null);

// 2. Buat Provider (Pembungkus)
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Mulai dengan loading

  // Cek apakah ada token di localStorage saat aplikasi pertama kali dimuat
  useEffect(() => {
    const checkLoggedInUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Jika ada token, coba ambil data user
          // Asumsi Anda punya endpoint /auth/me atau /auth/profile
          const response = await api.get('/auth/me'); 
          setUser(response.data.user);
        } catch (error) {
          // Token tidak valid/expire
          console.error("Token invalid, logging out");
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    checkLoggedInUser();
  }, []);

  // FUNGSI LOGIN
  const login = async (email, password) => {
    setLoading(true);
    try {
      // Panggil API login di backend Anda
      const response = await api.post('/auth/login', { email, password });
      
      // Simpan token ke localStorage
      localStorage.setItem('token', response.data.token);
      
      // Simpan data user ke state
      setUser(response.data.user);
      
    } catch (error) {
      console.error("Login failed:", error.response?.data?.message || error.message);
      // Lempar error agar bisa ditangkap di AuthModal
      throw error; 
    } finally {
      setLoading(false);
    }
  };

  // FUNGSI REGISTER
  const register = async (userData) => {
    // userData berisi { fullName, nim, email, password }
    setLoading(true);
    try {
      // Panggil API register di backend Anda
      // Backend Anda harus diatur untuk menerima data ini
      const response = await api.post('/auth/register', userData);

      // Setelah register, backend mungkin langsung mengembalikan token
      // atau mungkin meminta user login. Asumsi: langsung login.
      
      // Simpan token
      localStorage.setItem('token', response.data.token);
      
      // Simpan user
      setUser(response.data.user);
      
      // Anda bisa juga tidak auto-login, tapi minta user
      // ke halaman "Verifikasi" atau "Login"
      // Untuk saat ini, kita anggap auto-login.

    } catch (error) {
      console.error("Registration failed:", error.response?.data?.message || error.message);
      // Lempar error
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // FUNGSI LOGOUT
  const logout = () => {
    // Hapus token dari localStorage
    localStorage.removeItem('token');
    // Hapus user dari state
    setUser(null);
  };

  // 3. Sediakan value ke children
  const value = {
    user,
    loading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Kita tampilkan children (aplikasi Anda) hanya jika
        proses pengecekan token awal (loading) sudah selesai
      */}
      {!loading && children}
    </AuthContext.Provider>
  );
};

// 4. Buat Hook kustom (useAuth)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};