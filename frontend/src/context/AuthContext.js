import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axiosConfig';

// 1. Buat Context
const AuthContext = createContext(null);

// Komponen Loading Sederhana
const AuthLoading = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px'
  }}>
    Loading user data...
  </div>
);

// 2. Buat Provider (Pembungkus)
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Fungsi untuk menyimpan token dan mengupdate header axios
  const setAuthToken = (newToken) => {
    if (newToken) {
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setIsAuthenticated(true);
      // Set header Authorization untuk semua request axios
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } else {
      localStorage.removeItem('token');
      setToken(null);
      setIsAuthenticated(false);
      delete api.defaults.headers.common['Authorization'];
    }
  };

  // Cek apakah user sudah login saat aplikasi pertama kali dimuat
  useEffect(() => {
    const checkLoggedInUser = async () => {
      const storedToken = localStorage.getItem('token');
      
      if (storedToken) {
        try {
          console.log('🔍 [AUTH CONTEXT] Checking user with token:', storedToken.substring(0, 20) + '...');
          
          // Set token untuk request ini
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Panggil endpoint /me untuk verifikasi token
          const response = await api.get('api/auth/me');
          
          console.log('✅ [AUTH CONTEXT] User verified:', response.data.user);
          
          setUser(response.data.user);
          setToken(storedToken);
          setIsAuthenticated(true);
          
        } catch (error) {
          console.error('❌ [AUTH CONTEXT] Token invalid or expired:', error);
          // Token tidak valid, clear semua data
          setAuthToken(null);
          setUser(null);
        }
      } else {
        console.log('🔍 [AUTH CONTEXT] No token found');
      }
      
      setLoading(false);
    };

    checkLoggedInUser();
  }, []);

  // Fungsi Login
  const login = async (token, userData) => {
    try {
      console.log('🔍 [AUTH CONTEXT] Login called with:', { 
        token: token.substring(0, 20) + '...', 
        userData 
      });

      // Simpan token dan user data
      setAuthToken(token);
      setUser(userData);
      
      // Simpan user data di localStorage untuk persistensi
      localStorage.setItem('user', JSON.stringify(userData));
      
      console.log('✅ [AUTH CONTEXT] Login successful');
      
      return true;
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] Login failed:', error);
      setAuthToken(null);
      setUser(null);
      throw error;
    }
  };

  // Fungsi Login dengan NIM & Password (jika masih dibutuhkan)
  const loginWithCredentials = async (nim, password) => {
    setLoading(true);
    try {
      console.log('🔍 [AUTH CONTEXT] Login with credentials:', { nim });
      
      const response = await api.post('api/auth/login', { nim, password });
      const { token, user } = response.data;
      
      await login(token, user);
      
      return true;
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] Credential login failed:', error);
      setAuthToken(null);
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fungsi Register
  const register = async (userData) => {
    setLoading(true);
    try {
      console.log('🔍 [AUTH CONTEXT] Register called:', userData);
      
      const response = await api.post('api/auth/register', userData);
      const { token, user } = response.data;
      
      await login(token, user);
      
      return true;
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] Registration failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fungsi Logout
  const logout = () => {
    console.log('🔍 [AUTH CONTEXT] Logout called');
    
    // Clear semua data
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('user');
    
    // Redirect ke login page
    window.location.href = '/login';
  };

  // Value yang disediakan ke context
  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    loginWithCredentials,
    register,
    logout,
    setAuthToken
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <AuthLoading /> : children}
    </AuthContext.Provider>
  );
};

// 3. Custom Hook untuk menggunakan AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;