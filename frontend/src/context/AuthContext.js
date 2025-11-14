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

  // ✅ PERBAIKAN: Fungsi untuk menyimpan token dan mengupdate header axios
  const setAuthToken = (newToken) => {
    console.log('🔍 [AUTH CONTEXT] setAuthToken called:', {
      hasNewToken: !!newToken,
      tokenType: typeof newToken,
      tokenLength: newToken?.length
    });

    if (newToken && typeof newToken === 'string' && newToken.length > 10) {
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setIsAuthenticated(true);
      // Set header Authorization untuk semua request axios
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      console.log('✅ [AUTH CONTEXT] Token set successfully');
    } else {
      console.log('🔄 [AUTH CONTEXT] Clearing auth data');
      localStorage.removeItem('token');
      setToken(null);
      setIsAuthenticated(false);
      delete api.defaults.headers.common['Authorization'];
    }
  };

  // ✅ PERBAIKAN: Check logged in user - dengan validasi lengkap
  useEffect(() => {
    const checkLoggedInUser = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      console.log('🔍 [AUTH CONTEXT] Checking stored auth data:', {
        hasToken: !!storedToken,
        tokenLength: storedToken?.length,
        hasUser: !!storedUser
      });
      
      if (storedToken && storedUser) {
        try {
          // Validasi token
          if (typeof storedToken !== 'string' || storedToken.length < 20) {
            console.warn('⚠️ [AUTH CONTEXT] Invalid token format, clearing auth');
            throw new Error('Invalid token format');
          }

          // Parse user data
          const userData = JSON.parse(storedUser);
          
          // ✅ PERBAIKAN: Validasi struktur user data
          if (!userData || typeof userData !== 'object') {
            throw new Error('Invalid user data structure');
          }

          // ✅ PERBAIKAN: Pastikan ada field nama yang bisa digunakan
          if (!userData.name && !userData.fullName && !userData.username) {
            console.warn('⚠️ [AUTH CONTEXT] User data missing name fields:', userData);
            // Tetap lanjutkan, tapi beri warning
          }

          setUser(userData);
          setToken(storedToken);
          setIsAuthenticated(true);
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          console.log('✅ [AUTH CONTEXT] User restored from storage:', {
            name: userData.name || userData.fullName || userData.username || 'No Name',
            email: userData.email,
            id: userData.id
          });
        } catch (error) {
          console.error('❌ [AUTH CONTEXT] Error restoring user:', error);
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

  // ✅ PERBAIKAN: Fungsi Login dengan validasi lengkap dan debug
  const login = async (token, userData) => {
    try {
      console.log('🔍 [AUTH CONTEXT] Login function called with:', { 
        tokenLength: token?.length,
        tokenType: typeof token,
        userData: userData
      });

      // ✅ VALIDASI LENGKAP: Pastikan parameter valid
      if (!token) {
        throw new Error('Token is required');
      }

      if (typeof token !== 'string') {
        throw new Error(`Token must be string, got ${typeof token}`);
      }

      if (token.length < 20) {
        console.warn('⚠️ [AUTH CONTEXT] Token might be invalid (too short):', token);
      }

      if (!userData || typeof userData !== 'object') {
        throw new Error(`User data must be object, got ${typeof userData}`);
      }

      // ✅ PERBAIKAN: Log struktur user data untuk debugging
      console.log('🔍 [AUTH CONTEXT] User data structure:', {
        id: userData.id,
        name: userData.name,
        fullName: userData.fullName,
        username: userData.username,
        email: userData.email,
        nim: userData.nim,
        allKeys: Object.keys(userData)
      });

      // Simpan token dan user data
      setAuthToken(token);
      setUser(userData);
      
      // Simpan user data di localStorage untuk persistensi
      localStorage.setItem('user', JSON.stringify(userData));
      
      console.log('✅ [AUTH CONTEXT] Login successful!', {
        userName: userData.name || userData.fullName || userData.username || 'No Name',
        userEmail: userData.email,
        tokenLength: token.length
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
      console.log('🔍 [AUTH CONTEXT] loginWithCredentials called with NIM:', nim);
      
      const response = await api.post('/api/auth/login', { nim, password });
      
      // ✅ DEBUG: Full response structure
      console.log('🔍 [AUTH CONTEXT] Login API Response:', {
        status: response.status,
        data: response.data
      });
      
      // ✅ PERBAIKAN: Validasi response structure
      if (!response.data.success) {
        throw new Error(response.data.message || 'Login failed: No success flag');
      }
      
      const { token, user } = response.data;
      
      console.log('🔍 [AUTH CONTEXT] Extracted login data:', {
        tokenExists: !!token,
        userExists: !!user,
        tokenLength: token?.length,
        userStructure: user ? {
          name: user.name,
          fullName: user.fullName, 
          username: user.username,
          email: user.email,
          nim: user.nim,
          allKeys: Object.keys(user)
        } : 'NO USER'
      });
      
      // ✅ PERBAIKAN: Validasi token dan user
      if (!token) {
        throw new Error('No token received from server');
      }
      
      if (!user) {
        throw new Error('No user data received from server');
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
      
      // ✅ PERBAIKAN: Throw error yang lebih informatif
      if (error.response) {
        throw new Error(error.response.data.message || 'Login failed');
      } else if (error.request) {
        throw new Error('Network error: Cannot connect to server');
      } else {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ PERBAIKAN: Fungsi Register dengan debug lengkap
  const register = async (userData) => {
    setLoading(true);
    try {
      console.log('🔍 [AUTH CONTEXT] Register called:', {
        fullName: userData.fullName,
        nim: userData.nim,
        email: userData.email
      });
      
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
      
      console.log('🔍 [AUTH CONTEXT] Register user data structure:', {
        name: user.name,
        fullName: user.fullName,
        username: user.username,
        email: user.email
      });
      
      const result = await login(token, user);
      return result;
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] Registration failed:', error);
      
      // ✅ PERBAIKAN: Throw error yang lebih informatif
      if (error.response) {
        throw new Error(error.response.data.message || 'Registration failed');
      } else if (error.request) {
        throw new Error('Network error: Cannot connect to server');
      } else {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ PERBAIKAN: Fungsi untuk update user data
  const updateUser = (updatedUserData) => {
    console.log('🔍 [AUTH CONTEXT] updateUser called with:', updatedUserData);
    
    setUser(prevUser => {
      const newUser = { ...prevUser, ...updatedUserData };
      localStorage.setItem('user', JSON.stringify(newUser));
      
      console.log('✅ [AUTH CONTEXT] User updated:', {
        oldName: prevUser?.name || prevUser?.fullName,
        newName: newUser.name || newUser.fullName
      });
      
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
      tokenLength: storedToken?.length,
      hasUser: !!storedUser,
      isAuthenticated 
    });
    
    return isAuthenticated;
  };

  // ✅ PERBAIKAN: Fungsi Logout dengan cleanup lengkap
  const logout = () => {
    console.log('🔍 [AUTH CONTEXT] Logout called', {
      currentUser: user?.name || user?.fullName || 'Unknown'
    });
    
    // Clear semua data
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('user');
    
    // ✅ PERBAIKAN: Clear semua related auth data
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    
    console.log('✅ [AUTH CONTEXT] Logout successful');
    
    // ✅ PERBAIKAN: Gunakan window.location.replace untuk hindari history
    window.location.replace('/');
  };

  // ✅ PERBAIKAN: Value yang disediakan ke context
  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    loginWithCredentials,
    register,
    logout,
    setAuthToken,
    updateUser,
    checkAuthStatus,
    // ✅ PERBAIKAN: Tambahkan helper function untuk mendapatkan nama user
    getUserName: () => user?.name || user?.fullName || user?.username || 'User',
    getUserShortName: () => {
      const fullName = user?.name || user?.fullName || user?.username || 'User';
      return fullName.split(' ')[0];
    }
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