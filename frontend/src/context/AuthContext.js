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

// Helper function untuk extract NIM dari email
const extractNIMFromEmail = (email) => {
  if (!email) return '';
  const localPart = email.split('@')[0];
  const nim = localPart.split('.')[0];
  return nim.length === 12 ? nim : '';
};

// 2. Buat Provider (Pembungkus)
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ✅ PERBAIKAN 1: Enhanced shouldCompleteProfile function
  const shouldCompleteProfile = (userData) => {
    if (!userData) {
      console.log('🔍 [AUTH CONTEXT] No user data provided for profile check');
      return true; // Default to true for safety
    }

    console.log('🔍 [AUTH CONTEXT] shouldCompleteProfile check:', {
      hasUser: !!userData,
      fullName: userData.fullName,
      isProfileComplete: userData.isProfileComplete,
      fullNameLength: userData.fullName?.length || 0
    });

    // Jika sudah ada flag complete di database, gunakan itu
    if (userData.isProfileComplete === true) {
      console.log('✅ [AUTH CONTEXT] Profile marked complete in database');
      return false;
    }

    // Check jika user punya nama yang valid
    const hasValidName = userData.fullName && userData.fullName.trim().length > 0;
    if (hasValidName) {
      console.log('✅ [AUTH CONTEXT] User has valid name, no completion needed');
      return false;
    }

    console.log('🔍 [AUTH CONTEXT] User needs profile completion');
    return true;
  };

  // ✅ PERBAIKAN 2: Enhanced needsProfileCompletion function dengan loading state handling
  const needsProfileCompletion = () => {
  if (loading) {
    console.log('🔍 [AUTH CONTEXT] Still loading, deferring profile check');
    return false;
  }

  if (!user) {
    console.log('🔍 [AUTH CONTEXT] No user available for profile completion check', {
      loading: loading,
      user: user,
      token: token
    });
    return true; // ✅ PERUBAHAN: Return true untuk safety default
  }

  console.log('🔍 [AUTH CONTEXT] Profile completion check:', {
    user: {
      id: user.id,
      fullName: user.fullName,
      isProfileComplete: user.isProfileComplete
    },
    fromStorage: localStorage.getItem('needsProfileCompletion')
  });

  // Check dari user data terlebih dahulu (prioritas utama)
  if (user.isProfileComplete) {
    console.log('✅ [AUTH CONTEXT] User profile is complete based on user data');
    localStorage.removeItem('needsProfileCompletion');
    return false;
  }

  // Check jika user punya fullName yang valid
  const hasValidName = user.fullName && user.fullName.trim().length > 0;
  if (hasValidName) {
    console.log('✅ [AUTH CONTEXT] User has valid name, profile complete');
    localStorage.removeItem('needsProfileCompletion');
    return false;
  }

  console.log('🔍 [AUTH CONTEXT] User needs profile completion');
  return true;
};

  // ✅ PERBAIKAN: Fungsi setAuthToken (tetap sama)
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
          if (typeof storedToken !== 'string' || storedToken.length < 20) {
            console.warn('⚠️ [AUTH CONTEXT] Invalid token format, clearing auth');
            throw new Error('Invalid token format');
          }

          const userData = JSON.parse(storedUser);
          
          if (!userData || typeof userData !== 'object') {
            throw new Error('Invalid user data structure');
          }

          setUser(userData);
          setToken(storedToken);
          setIsAuthenticated(true);
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          console.log('✅ [AUTH CONTEXT] User restored from storage:', {
            name: userData.fullName || userData.name || 'No Name',
            email: userData.email,
            id: userData.id,
            isProfileComplete: userData.isProfileComplete,
            nim: userData.nim
          });
        } catch (error) {
          console.error('❌ [AUTH CONTEXT] Error restoring user:', error);
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

  // ✅ PERBAIKAN: Fungsi Login dengan enhanced state management
  const login = async (token, userData) => {
    try {
      console.log('🔍 [AUTH CONTEXT] Login function called with:', { 
        tokenLength: token?.length,
        userData: userData
      });

      if (!token || !userData) {
        throw new Error('Token and user data are required');
      }

      // Simpan token dan user data
      setAuthToken(token);
      setUser(userData);
      
      // Simpan user data di localStorage untuk persistensi
      localStorage.setItem('user', JSON.stringify(userData));
      
      console.log('✅ [AUTH CONTEXT] Login successful!', {
        userName: userData.fullName || userData.name || 'User',
        userEmail: userData.email,
        isProfileComplete: userData.isProfileComplete
      });
      
      // ✅ PERBAIKAN: Gunakan shouldCompleteProfile yang sudah ditingkatkan
      const needsProfileCompletion = shouldCompleteProfile(userData);
      
      if (needsProfileCompletion) {
        console.log('🔍 [AUTH CONTEXT] User needs profile completion, setting flag');
        localStorage.setItem('needsProfileCompletion', 'true');
      } else {
        console.log('🔍 [AUTH CONTEXT] User profile is complete, clearing flag');
        localStorage.removeItem('needsProfileCompletion');
      }
      
      return { 
        success: true, 
        user: userData,
        needsProfileCompletion: needsProfileCompletion
      };
      
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
      
      console.log('🔍 [AUTH CONTEXT] Login API Response:', {
        status: response.status,
        data: response.data
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Login failed: No success flag');
      }
      
      const { token, user } = response.data;
      
      console.log('🔍 [AUTH CONTEXT] Extracted login data:', {
        tokenExists: !!token,
        userExists: !!user,
        tokenLength: token?.length,
        userStructure: user ? {
          fullName: user.fullName, 
          email: user.email,
          nim: user.nim,
          isProfileComplete: user.isProfileComplete,
          authMethod: user.authMethod,
          userType: user.userType,
          allKeys: Object.keys(user)
        } : 'NO USER'
      });
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      if (!user) {
        throw new Error('No user data received from server');
      }
      
      const result = await login(token, user);
      console.log('✅ [AUTH CONTEXT] loginWithCredentials completed successfully');
      
      return result;
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] loginWithCredentials failed:', error);
      setAuthToken(null);
      setUser(null);
      localStorage.removeItem('user');
      
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

  // ✅ BARU: Fungsi Register dengan Email Only
  const registerWithEmail = async (email) => {
    setLoading(true);
    try {
      console.log('🔍 [AUTH CONTEXT] registerWithEmail called with email:', email);
      
      const response = await api.post('/api/auth/register-email', { email });
      
      console.log('🔍 [AUTH CONTEXT] Register with email response:', {
        status: response.status,
        data: response.data
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Email registration failed');
      }
      
      const { token, user, requiresProfileCompletion } = response.data.data;
      
      console.log('🔍 [AUTH CONTEXT] Email registration data:', {
        tokenExists: !!token,
        userExists: !!user,
        requiresProfileCompletion: requiresProfileCompletion,
        userStructure: user
      });
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      if (!user) {
        throw new Error('No user data received from server');
      }
      
      localStorage.setItem('isNewUser', 'true');
      localStorage.setItem('userEmail', email);
      
      const result = await login(token, user);
      
      console.log('✅ [AUTH CONTEXT] registerWithEmail completed successfully');
      
      return {
        ...result,
        requiresProfileCompletion: requiresProfileCompletion || true
      };
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] registerWithEmail failed:', error);
      
      if (error.response) {
        if (error.response.status === 409) {
          throw new Error('Email sudah terdaftar. Silakan login menggunakan NIM Anda.');
        }
        throw new Error(error.response.data.message || 'Email registration failed');
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
  const registerWithCredentials = async (userData) => {
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
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Registration failed');
      }
      
      if (!token || !user) {
        throw new Error('Invalid response: missing token or user data');
      }
      
      console.log('🔍 [AUTH CONTEXT] Register user data structure:', {
        fullName: user.fullName,
        email: user.email,
        nim: user.nim,
        isProfileComplete: user.isProfileComplete
      });
      
      const result = await login(token, user);
      return result;
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] Registration failed:', error);
      
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

  // ✅ BARU: Fungsi untuk handle Google Auth Callback
  const handleGoogleAuthCallback = async (token, userData) => {
    try {
      console.log('🔍 [AUTH CONTEXT] handleGoogleAuthCallback called:', {
        tokenLength: token?.length,
        userData: userData
      });

      let parsedUserData = userData;
      if (typeof userData === 'string') {
        try {
          parsedUserData = JSON.parse(userData);
        } catch (parseError) {
          console.error('❌ [AUTH CONTEXT] Failed to parse user data:', parseError);
          throw new Error('Invalid user data format');
        }
      }

      if (!token || !parsedUserData) {
        throw new Error('Token and user data are required for Google auth');
      }

      const result = await login(token, parsedUserData);

      const isNewUser = shouldCompleteProfile(parsedUserData);

      if (isNewUser) {
        console.log('🔍 [AUTH CONTEXT] New Google user detected, setting flags');
        localStorage.setItem('isNewUser', 'true');
        localStorage.setItem('userEmail', parsedUserData.email);
      }

      console.log('✅ [AUTH CONTEXT] Google auth callback completed successfully');
      
      return {
        ...result,
        isNewUser: isNewUser
      };
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] handleGoogleAuthCallback failed:', error);
      throw error;
    }
  };

  // ✅ PERBAIKAN: Fungsi untuk update user profile completion
  const updateUserProfileCompletion = async (profileData) => {
    try {
      console.log('🔍 [AUTH CONTEXT] updateUserProfileCompletion called with:', profileData);
      
      if (!user) {
        throw new Error('No user found');
      }

      const updatedUser = {
        ...user,
        fullName: profileData.fullName,
        dateOfBirth: profileData.dateOfBirth,
        isProfileComplete: true
      };

      console.log('🔍 [AUTH CONTEXT] Updated user data:', updatedUser);

      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      localStorage.removeItem('isNewUser');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('needsProfileCompletion');

      try {
        await api.patch('/api/auth/update-profile', {
          fullName: profileData.fullName,
          dateOfBirth: profileData.dateOfBirth
        });
        console.log('✅ [AUTH CONTEXT] Profile completion synced with backend');
      } catch (syncError) {
        console.warn('⚠️ [AUTH CONTEXT] Failed to sync profile completion with backend:', syncError);
      }

      console.log('✅ [AUTH CONTEXT] User profile completion updated successfully');
      return { success: true, user: updatedUser };
      
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] updateUserProfileCompletion failed:', error);
      throw error;
    }
  };

  // ✅ PERBAIKAN: Fungsi untuk update user data
  const updateUser = (updatedUserData) => {
    console.log('🔍 [AUTH CONTEXT] updateUser called with:', updatedUserData);
    
    setUser(prevUser => {
      const newUser = { ...prevUser, ...updatedUserData };
      localStorage.setItem('user', JSON.stringify(newUser));
      
      console.log('✅ [AUTH CONTEXT] User updated:', {
        oldName: prevUser?.fullName || prevUser?.name,
        newName: newUser.fullName || newUser.name,
        isProfileComplete: newUser.isProfileComplete
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

  // ✅ BARU: Fungsi untuk check jika user adalah new user
  const isNewUser = () => {
    return localStorage.getItem('isNewUser') === 'true';
  };

  // ✅ PERBAIKAN: Fungsi untuk manually set profile completion status
  const setProfileComplete = () => {
    console.log('🔍 [AUTH CONTEXT] Manually setting profile as complete');
    localStorage.removeItem('needsProfileCompletion');
    localStorage.removeItem('isNewUser');
    
    if (user) {
      const updatedUser = { ...user, isProfileComplete: true };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  // ✅ PERBAIKAN: Fungsi Logout dengan cleanup lengkap
  const logout = () => {
    console.log('🔍 [AUTH CONTEXT] Logout called', {
      currentUser: user?.fullName || user?.name || 'Unknown'
    });
    
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('user');
    
    localStorage.removeItem('token');
    localStorage.removeItem('isNewUser');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('needsProfileCompletion');
    delete api.defaults.headers.common['Authorization'];
    
    console.log('✅ [AUTH CONTEXT] Logout successful');
    
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
    register: registerWithCredentials,
    registerWithCredentials,
    registerWithEmail,
    handleGoogleAuthCallback,
    logout,
    setAuthToken,
    updateUser,
    updateUserProfileCompletion,
    setProfileComplete,
    checkAuthStatus,
    needsProfileCompletion, // ✅ SUDAH DIPERBAIKI
    isNewUser,
    getUserName: () => user?.fullName || user?.name || 'User',
    getUserShortName: () => {
      const fullName = user?.fullName || user?.name || 'User';
      return fullName.split(' ')[0];
    },
    getUserNIM: () => user?.nim || extractNIMFromEmail(user?.email),
    extractNIMFromEmail
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