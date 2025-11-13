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

  // ✅ PERBAIKAN: Check logged in user - TANPA panggil /api/auth/me
  useEffect(() => {
    const checkLoggedInUser = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      console.log('🔍 [AUTH CONTEXT] Checking stored auth data:', {
        hasToken: !!storedToken,
        hasUser: !!storedUser
      });
      
      if (storedToken && storedUser) {
        try {
          // Gunakan data dari localStorage saja
          const userData = JSON.parse(storedUser);
          
          setUser(userData);
          setToken(storedToken);
          setIsAuthenticated(true);
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          console.log('✅ [AUTH CONTEXT] User restored from storage:', userData);
        } catch (error) {
          console.error('❌ [AUTH CONTEXT] Error parsing stored user:', error);
          // Clear data yang corrupt
          setAuthToken(null);
          setUser(null);
          localStorage.removeItem('user');
        }
      } else {
        console.log('🔍 [AUTH CONTEXT] No valid auth data found');
        setAuthToken(null);
        setUser(null);
      }
      
      setLoading(false);
    };

    checkLoggedInUser();
  }, []);

  // ✅ PERBAIKAN: Listen untuk event token expired dari axios interceptor
  useEffect(() => {
    const handleTokenExpired = () => {
      console.log('🛑 [AUTH CONTEXT] Token expired event received');
      setAuthToken(null);
      setUser(null);
      localStorage.removeItem('user');
    };

    window.addEventListener('authTokenExpired', handleTokenExpired);
    
    return () => {
      window.removeEventListener('authTokenExpired', handleTokenExpired);
    };
  }, []);

  // ✅ PERBAIKAN: Fungsi Login dengan validasi lengkap
  const login = async (token, userData) => {
    try {
      console.log('🔍 [AUTH CONTEXT] Login function called with:', { 
        token: token,
        tokenLength: token?.length,
        tokenType: typeof token,
        userData: userData,
        userDataType: typeof userData
      });

      // ✅ VALIDASI LENGKAP: Pastikan parameter valid
      if (!token) {
        throw new Error('Token is required');
      }

      if (typeof token !== 'string') {
        throw new Error(`Token must be string, got ${typeof token}: ${token}`);
      }

      if (token.length < 20) {
        console.warn('⚠️ [AUTH CONTEXT] Token might be invalid (too short):', token);
        // Tetap lanjutkan untuk development, tapi beri warning
      }

      if (!userData || typeof userData !== 'object') {
        throw new Error(`User data must be object, got ${typeof userData}: ${userData}`);
      }

      if (!userData.id || !userData.email) {
        throw new Error('User data must contain id and email');
      }

      // Simpan token dan user data
      setAuthToken(token);
      setUser(userData);
      
      // Simpan user data di localStorage untuk persistensi
      localStorage.setItem('user', JSON.stringify(userData));
      
      console.log('✅ [AUTH CONTEXT] Login successful!', {
        user: userData,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 20) + '...'
      });
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] Login failed:', error);
      setAuthToken(null);
      setUser(null);
      localStorage.removeItem('user');
      throw error;
    }
  };

  // ✅ PERBAIKAN: Fungsi Login dengan NIM & Password dengan debug lengkap
  const loginWithCredentials = async (nim, password) => {
    setLoading(true);
    try {
      console.log('🔍 [AUTH CONTEXT] loginWithCredentials called with:', { nim });
      
      // ✅ DEBUG: Sebelum API call
      console.log('🔍 [AUTH CONTEXT] Making API call to /api/auth/login');
      
      const response = await api.post('/api/auth/login', { nim, password });
      
      // ✅ DEBUG: Full response structure
      console.log('🔍 [AUTH CONTEXT] FULL API Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      });
      
      console.log('🔍 [AUTH CONTEXT] Response data structure:', {
        success: response.data.success,
        message: response.data.message,
        tokenExists: !!response.data.token,
        userExists: !!response.data.user,
        tokenType: typeof response.data.token,
        userType: typeof response.data.user
      });
      
      // ✅ PERBAIKAN: Validasi response structure
      if (!response.data.success) {
        throw new Error(response.data.message || 'Login failed: No success flag');
      }
      
      // ✅ PERBAIKAN: Extract data dengan validasi
      const { token, user } = response.data;
      
      console.log('🔍 [AUTH CONTEXT] Extracted data:', {
        token: token,
        tokenLength: token?.length,
        tokenPreview: token ? token.substring(0, 30) + '...' : 'NO TOKEN',
        user: user,
        userKeys: user ? Object.keys(user) : 'NO USER'
      });
      
      // ✅ PERBAIKAN: Validasi token dan user
      if (!token) {
        throw new Error('No token received from server');
      }
      
      if (typeof token !== 'string') {
        throw new Error(`Token is not string: ${typeof token}`);
      }
      
      if (!user) {
        throw new Error('No user data received from server');
      }
      
      if (typeof user !== 'object') {
        throw new Error(`User data is not object: ${typeof user}`);
      }
      
      // ✅ Panggil login function dengan data yang sudah divalidasi
      const result = await login(token, user);
      console.log('✅ [AUTH CONTEXT] loginWithCredentials completed successfully');
      
      return result;
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] loginWithCredentials failed:', error);
      setAuthToken(null);
      setUser(null);
      localStorage.removeItem('user');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fungsi Register dengan debug
  const register = async (userData) => {
    setLoading(true);
    try {
      console.log('🔍 [AUTH CONTEXT] Register called:', userData);
      
      const response = await api.post('/api/auth/register', userData);
      console.log('🔍 [AUTH CONTEXT] Register response:', response.data);
      
      const { token, user } = response.data;
      
      // ✅ Validasi response register
      if (!response.data.success) {
        throw new Error(response.data.message || 'Registration failed');
      }
      
      if (!token || !user) {
        throw new Error('Invalid response: missing token or user data');
      }
      
      const result = await login(token, user);
      return result;
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] Registration failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // ✅ PERBAIKAN: Fungsi untuk update user data
  const updateUser = (updatedUserData) => {
    setUser(prevUser => {
      const newUser = { ...prevUser, ...updatedUserData };
      localStorage.setItem('user', JSON.stringify(newUser));
      return newUser;
    });
  };

  // ✅ PERBAIKAN: Fungsi untuk check auth status
  const checkAuthStatus = async () => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    const isAuthenticated = !!(storedToken && storedUser);
    
    console.log('🔍 [AUTH CONTEXT] Auth check:', { 
      hasToken: !!storedToken, 
      hasUser: !!storedUser,
      isAuthenticated 
    });
    
    return isAuthenticated;
  };

  // Fungsi Logout
  const logout = () => {
    console.log('🔍 [AUTH CONTEXT] Logout called');
    
    // Clear semua data
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('user');
    
    console.log('✅ [AUTH CONTEXT] Logout successful');
    
    // Redirect ke landing page
    window.location.href = '/';
  };

  // Value yang disediakan ke context
  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,           // Untuk external call (harus dengan parameter yang benar)
    loginWithCredentials, // Untuk login dengan NIM/password
    register,
    logout,
    setAuthToken,
    updateUser,
    checkAuthStatus
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