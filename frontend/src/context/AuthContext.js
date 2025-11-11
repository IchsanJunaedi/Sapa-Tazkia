import React, { createContext, useContext, useState, useEffect } from 'react';
// Import instance axios Anda
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
          // --- PERBAIKAN (PENTING) ---
          // Set header default axios SEBELUM membuat panggilan API
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          // --- AKHIR PERBAIKAN ---

          // Sekarang panggilan ini akan berhasil
          const response = await api.get('/auth/me');
          setUser(response.data.user);
        } catch (error) {
          // Token tidak valid/expire
          console.error("Token invalid, logging out");
          // Panggil fungsi logout yang sudah diperbaiki
          logout(); 
        }
      }
      setLoading(false);
    };

    checkLoggedInUser();
  }, []); // Dependency array [] sudah benar


  // --- FUNGSI LOGIN (DIPERBARUI TOTAL) ---
  // Sekarang bisa menangani login(nim, password) DAN login(token)
  const login = async (nimOrToken, password) => {
    setLoading(true);
    try {
      let token;
      let userData;

      if (password) {
        // --- Skenario 1: Login Lokal (NIM & Password) ---
        // Dipanggil dari LoginPage.jsx
        // PERBAIKAN: Menggunakan 'nim' sesuai backend
        const response = await api.post('/auth/login', { nim: nimOrToken, password });
        
        token = response.data.token;
        userData = response.data.user;

      } else {
        // --- Skenario 2: Login Google (Hanya Token) ---
        // Dipanggil dari AuthCallback.jsx
        token = nimOrToken;

        // Set token dulu agar 'me' berhasil
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Ambil data user secara manual
        const response = await api.get('/auth/me');
        userData = response.data.user;
      }

      // --- Logika Umum untuk KEDUA Skenario ---
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);

      return true; // Sukses (untuk LoginPage)

    } catch (error) {
      console.error("Login failed:", error.response?.data?.message || error.message);
      logout(); // Pastikan bersih-bersih jika gagal
      throw error; // Lempar error agar bisa ditangkap di LoginPage
    } finally {
      setLoading(false);
    }
  };
  // --- AKHIR FUNGSI LOGIN BARU ---

  // FUNGSI REGISTER
  const register = async (userData) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', userData);
      
      // Auto-login setelah register
      localStorage.setItem('token', response.data.token);
      // PERBAIKAN: Set header axios juga
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      setUser(response.data.user);

    } catch (error) {
      console.error("Registration failed:", error.response?.data?.message || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // --- FUNGSI LOGOUT (DIPERBARUI) ---
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    // --- PERBAIKAN (PENTING) ---
    // Hapus juga default header axios
    delete api.defaults.headers.common['Authorization'];
    // --- AKHIR PERBAIKAN ---
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
      {!loading && children}
    </AuthContext.Provider>
  );
};

// 4. Buat Hook kustom (useAuth - Tetap sama, sudah benar)
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};