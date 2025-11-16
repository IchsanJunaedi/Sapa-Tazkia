import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Calendar, User, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

const AboutYouPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    user, 
    updateUserProfileCompletion, 
    isAuthenticated,
    loading: authLoading
  } = useAuth();
  
  const [formData, setFormData] = useState({
    fullName: '',
    dateOfBirth: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect jika user belum login atau sudah complete profile
  useEffect(() => {
    console.log('🔍 [ABOUT YOU] Auth check:', {
      isAuthenticated,
      user,
      authLoading,
      userProfileComplete: user?.isProfileComplete,
      currentPath: window.location.pathname
    });

    if (!authLoading) {
      if (!isAuthenticated || !user) {
        console.log('🔍 [ABOUT YOU] User not authenticated, redirecting to home');
        navigate('/');
        return;
      }

      // ✅ PERBAIKAN: Check jika user SUDAH complete profile dengan logika yang lebih baik
      const hasValidName = user.fullName && 
                          user.fullName !== 'User' && 
                          user.fullName.length >= 2;
      
      const isProfileComplete = user.isProfileComplete && hasValidName;

      if (isProfileComplete) {
        console.log('🔍 [ABOUT YOU] User already has complete profile, checking if should redirect to landing page');
        
        // ✅ PERBAIKAN: Only redirect if we're not in the middle of form submission
        const fromState = location.state?.from;
        const isSubmitting = location.state?.isSubmitting;
        
        if (fromState !== 'profile-completion' && !isSubmitting) {
          console.log('🔍 [ABOUT YOU] Redirecting to landing page - profile already complete');
          navigate('/', { replace: true });
        } else {
          console.log('🔍 [ABOUT YOU] Came from profile completion or submitting, staying on page');
        }
      } else {
        console.log('🔍 [ABOUT YOU] User needs profile completion, staying on page');
        // User needs to complete profile, stay on this page
      }
    }
  }, [isAuthenticated, user, authLoading, navigate, location]);

  // ✅ PERBAIKAN: Pre-fill data dengan logic yang lebih baik
  useEffect(() => {
    if (user) {
      console.log('🔍 [ABOUT YOU] User data for pre-fill:', {
        fullName: user.fullName,
        isProfileComplete: user.isProfileComplete,
        email: user.email
      });

      // Pre-fill form hanya jika nama valid dan belum complete
      const hasValidName = user.fullName && 
                          user.fullName !== 'User' && 
                          user.fullName.length >= 2;

      if (hasValidName && !user.isProfileComplete) {
        console.log('🔍 [ABOUT YOU] Pre-filling form with existing name:', user.fullName);
        setFormData(prev => ({
          ...prev,
          fullName: user.fullName
        }));
      } else if (!hasValidName) {
        console.log('🔍 [ABOUT YOU] User has invalid name, showing empty form');
        // Biarkan form kosong untuk diisi user
      }
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasi input
    if (!formData.fullName.trim()) {
      setError('Nama lengkap harus diisi');
      return;
    }

    if (formData.fullName.trim().length < 2) {
      setError('Nama lengkap harus minimal 2 karakter');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('🔍 [ABOUT YOU] Starting profile completion process...');
      console.log('📝 [ABOUT YOU] Form data to submit:', formData);

      // Update user profile completion status
      const result = await updateUserProfileCompletion({
        fullName: formData.fullName.trim(),
        dateOfBirth: formData.dateOfBirth || null
      });

      console.log('✅ [ABOUT YOU] updateUserProfileCompletion result:', result);

      // ✅ PERBAIKAN: Verifikasi data tersimpan di localStorage
      const storedUser = localStorage.getItem('user');
      console.log('🔍 [ABOUT YOU] Stored user data after update:', {
        storedUser: storedUser ? JSON.parse(storedUser) : 'No data',
        hasStoredUser: !!storedUser
      });

      setSuccess('Profil berhasil dilengkapi! Mengarahkan ke halaman utama...');
      
      console.log('✅ [ABOUT YOU] Profile completion successful, redirecting to LANDING PAGE');
      
      // ✅ PERBAIKAN: Redirect ke LANDING PAGE dengan delay untuk memastikan state terupdate
      setTimeout(() => {
        // Clear semua flags profile completion
        localStorage.removeItem('needsProfileCompletion');
        localStorage.removeItem('isNewUser');
        
        console.log('🔍 [ABOUT YOU] Before redirect - checking final state:', {
          user: user,
          localStorageUser: localStorage.getItem('user'),
          needsProfileCompletion: localStorage.getItem('needsProfileCompletion')
        });
        
        navigate('/', { 
          replace: true,
          state: { 
            from: 'profile-completion',
            welcome: true
          }
        });
      }, 2000); // ✅ Increased delay to ensure state is updated

    } catch (err) {
      console.error('❌ [ABOUT YOU] Profile completion error:', err);
      setError(err.message || 'Terjadi kesalahan saat menyimpan profil. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1); // Go back to previous page
  };

  const handleSkip = () => {
    console.log('🔍 [ABOUT YOU] User skipping profile completion');
    // ✅ PERBAIKAN: Juga clear flags ketika skip
    localStorage.removeItem('needsProfileCompletion');
    localStorage.removeItem('isNewUser');
    
    navigate('/', { 
      state: { from: 'profile-skipped' }
    });
  };

  // Show loading while checking auth status
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="w-full py-6 px-8 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center">
          <button 
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            disabled={isLoading}
          >
            <ArrowLeft size={20} className="mr-2" />
            Kembali
          </button>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">ST</span>
              </div>
              <span className="text-lg font-bold text-gray-900">Sapa Tazkia</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Header Section */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Lengkapi Profil Anda
              </h1>
              <p className="text-gray-600 text-sm">
                Informasi dasar untuk pengalaman yang lebih personal
              </p>
            </div>

            {/* User Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">Email:</span>
                  <span className="text-sm text-blue-900">{user?.email}</span>
                </div>
                {/* Tampilkan NIM jika ada */}
                {user?.nim && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800">NIM:</span>
                    <span className="text-sm font-bold text-blue-900">{user.nim}</span>
                  </div>
                )}
                <p className="text-xs text-blue-600 mt-1">
                  Data Anda aman dan terlindungi
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-800 text-sm font-medium">Terjadi Kesalahan</p>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-green-800 text-sm font-medium">Berhasil!</p>
                  <p className="text-green-700 text-sm mt-1">{success}</p>
                </div>
              </div>
            )}

            {/* Profile Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name Input */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Lengkap *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Masukkan nama lengkap Anda"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-500 transition-colors"
                    disabled={isLoading}
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Gunakan nama lengkap asli Anda
                </p>
              </div>

              {/* Birth Date Input */}
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Lahir
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 transition-colors"
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Opsional - untuk pengalaman yang lebih personal
                </p>
              </div>

              {/* Privacy Notice */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600">
                  Informasi Anda digunakan untuk personalisasi pengalaman chat. 
                  Kami menghargai privasi Anda dan tidak akan membagikan data kepada pihak ketiga.
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !formData.fullName.trim()}
                className={`w-full py-3 px-4 border border-transparent rounded-xl text-sm font-medium text-white transition-all duration-200 ${
                  isLoading || !formData.fullName.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 hover:bg-gray-800 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Menyimpan...
                  </div>
                ) : (
                  'Lanjutkan ke Halaman Utama'
                )}
              </button>
            </form>

            {/* Skip Option */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleSkip}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
                disabled={isLoading}
              >
                Lewati untuk sekarang
              </button>
            </div>

            {/* Help Text */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Butuh bantuan?{' '}
                <button 
                  type="button"
                  className="text-blue-600 hover:underline font-medium focus:outline-none"
                  onClick={() => window.location.href = 'mailto:support@tazkia.ac.id'}
                  disabled={isLoading}
                >
                  Hubungi support
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AboutYouPage;