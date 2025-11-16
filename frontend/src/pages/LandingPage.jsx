import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosConfig';
import { Plus, X, ArrowUp } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import Sidebar from '../components/layout/SideBar';

// --- Komponen GradientText ---
const GradientText = ({ children, className = '' }) => {
  return (
    <span
      className={`bg-clip-text text-transparent bg-gradient-to-r from-gray-500 to-gray-600  ${className}`}
      style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
    >
      {children}
    </span>
  );
};

// --- Komponen Button ---
const Button = ({ children, onClick, className, variant = 'default', size = 'md', ...props }) => {
  const baseClasses = 'font-semibold transition-all duration-200 ease-in-out flex items-center justify-center rounded-lg';
  const variantClasses = {
    default: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md',
    secondary: 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50',
  };
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  const finalClasses = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ');
  return (
    <button
      onClick={onClick}
      className={finalClasses}
      {...props}
    >
      {children}
    </button>
  );
};

// --- Komponen GoogleIcon ---
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6 mr-3">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.343c-1.896,3.101-5.466,6.17-11.343,6.17 c-6.958,0-12.632-5.673-12.632-12.632c0-6.958,5.674-12.632,12.632-12.632c3.23,0,6.347,1.385,8.441,3.483l5.882-5.882 C34.004,5.946,29.351,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20 C44,22.659,43.834,21.32,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.309,16.713L11.822,20.3L11.822,20.3C13.298,16.59,17.207,14,21.723,14 c3.41,0,6.619,1.218,8.875,3.447l0.024,0.023 l5.845-5.844C34.004,5.946,29.351,4,24,4C16.326,4,9.66,8.275,6.309,14.713z" />
    <path fill="#4CAF50" d="M24,44c5.205,0,10.222-1.92,13.911-5.385l-6.736-6.495C30.297,33.024,27.265,34.08,24,34.08 c-5.877,0-9.448-3.07-11.344-6.171L6.309,33.287C9.66,39.725,16.326,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20h-0.29c-0.122-0.638-0.344-1.254-0.627-1.851 C41.347,17.385,38.23,16,35,16c-3.265,0-6.297,1.056-8.214,3.003L35.343,28h7.957 C42.834,26.68,44,25.045,44,24C44,22.659,43.834,21.32,43.611,20.083z" />
  </svg>
);

// --- Komponen VerificationForm ---
const VerificationForm = ({ email, onVerify, onResend, onBack, isLoading, error }) => {
  const [code, setCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (code.trim().length >= 4) {
      onVerify(code.trim());
    }
  };

  const handleResend = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setResendLoading(true);
    setResendSuccess(false);
    
    try {
      await onResend();
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch (err) {
      console.error('Resend failed:', err);
    } finally {
      setResendLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && code.trim().length >= 4 && !isLoading) {
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Verifikasi Email</h2>
      <p className="text-sm text-gray-600 mb-6">
        Kami telah mengirim kode verifikasi ke: <strong>{email}</strong>
      </p>

      {resendSuccess && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
          <span className="block sm:inline">✅ Kode verifikasi telah dikirim ulang!</span>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
          <span className="block sm:inline">{error}</span>
          <button 
            type="button"
            onClick={() => error && typeof error === 'object' && error.onClose ? error.onClose() : null}
            className="absolute top-2 right-2 text-red-500 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Masukkan kode verifikasi"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
          disabled={isLoading}
          maxLength={6}
        />
        <p className="text-xs text-gray-500 mt-2">
          Masukkan kode 6 digit yang dikirim ke email Anda
        </p>
      </div>

      <button
        type="submit"
        className={`w-full py-3 rounded-xl font-semibold text-white transition-colors mb-3 ${
          code.trim().length >= 4 && !isLoading ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'
        }`}
        disabled={code.trim().length < 4 || isLoading}
      >
        {isLoading ? 'Memverifikasi...' : 'Verifikasi'}
      </button>

      <div className="flex space-x-3">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading}
          className="flex-1 py-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
        >
          {resendLoading ? 'Mengirim...' : 'Kirim Ulang Kode'}
        </button>
        
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400"
        >
          Kembali
        </button>
      </div>
    </form>
  );
};

// --- Komponen AuthModal ---
const AuthModal = ({ isOpen, onClose, initialStep = 0 }) => {
  const [step, setStep] = useState(initialStep);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const { 
    loginWithCredentials, 
    registerWithEmail, 
    verifyEmailCode, 
    resendVerificationCode,
    pendingVerification,
    pendingEmail,
    clearPendingVerification
  } = useAuth();

  // Reset state ketika modal dibuka
  useEffect(() => {
    if (isOpen) {
      // Jika ada pending verification, langsung ke step verifikasi
      if (pendingVerification && pendingEmail) {
        setStep(1);
        setEmail(pendingEmail);
      } else {
        setStep(initialStep);
        setEmail('');
      }
      setError(null);
      setIsLoading(false);
      setShowSuccess(false);
    }
  }, [isOpen, initialStep, pendingVerification, pendingEmail]);

  // Handle ketika modal ditutup
  const handleClose = () => {
    // Clear pending verification state jika modal ditutup
    if (pendingVerification) {
      clearPendingVerification();
    }
    onClose();
  };

  const handleContinue = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!email) {
      setError('Email atau NIM harus diisi');
      return;
    }

    setIsLoading(true);
    setError('');
    setShowSuccess(false);
    
    try {
      // Check if input is email or NIM
      const isEmail = email.includes('@');
      
      if (isEmail) {
        // Email input - proceed with registration/sign up
        console.log('🔍 [AUTH MODAL] Email detected, proceeding with registration:', email);
        
        // Validasi domain email Tazkia
        const validDomains = [
          '@student.tazkia.ac.id',
          '@student.stmik.tazkia.ac.id', 
          '@tazkia.ac.id'
        ];
        
        const isValidDomain = validDomains.some(domain => email.toLowerCase().includes(domain));
        
        if (!isValidDomain) {
          throw new Error('Silakan gunakan email Tazkia (@student.tazkia.ac.id, @student.stmik.tazkia.ac.id, atau @tazkia.ac.id)');
        }

        // Call register function for email
        const result = await registerWithEmail(email);
        
        console.log('🔍 [AUTH MODAL] Register result:', result);
        
        // Jika memerlukan verifikasi, pindah ke step verifikasi
        if (result.requiresVerification) {
          setStep(1);
          setShowSuccess(false);
        } else {
          // Jika tidak memerlukan verifikasi (langsung berhasil)
          setShowSuccess(true);
          setTimeout(() => {
            handleClose();
          }, 1500);
        }
        
      } else {
        // NIM input - proceed with login
        console.log('🔍 [AUTH MODAL] NIM detected, proceeding with login:', email);
        await loginWithCredentials(email, email); // Using NIM as password for now
        setShowSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1500);
      }
    } catch (err) {
      console.error('❌ [AUTH MODAL] Auth failed:', err);
      setError(err.message || 'Terjadi kesalahan saat autentikasi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (code) => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log('🔍 [AUTH MODAL] Verifying code for email:', email);
      const result = await verifyEmailCode(email, code);
      
      console.log('🔍 [AUTH MODAL] Verification result:', result);
      
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        throw new Error(result.error || 'Verifikasi gagal');
      }
    } catch (err) {
      console.error('❌ [AUTH MODAL] Verification failed:', err);
      setError(err.message || 'Kode verifikasi salah atau telah kedaluwarsa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      console.log('🔍 [AUTH MODAL] Resending code to:', email);
      const result = await resendVerificationCode(email);
      
      if (!result.success) {
        throw new Error(result.error || 'Gagal mengirim ulang kode');
      }
      
      return result;
    } catch (err) {
      console.error('❌ [AUTH MODAL] Resend failed:', err);
      throw err;
    }
  };

  const handleBackToEmail = () => {
    setStep(0);
    setError('');
    clearPendingVerification();
  };

  const handleGoogleLogin = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setIsLoading(true);
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && email && !isLoading) {
      if (step === 0) {
        handleContinue(e);
      }
    }
  };

  const renderContent = () => {
    switch (step) {
      case 0:
        return (
          <form onSubmit={handleContinue} className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Log in or sign up</h2>
            <p className="text-sm text-gray-600 mb-6">
              Dapatkan panduan akademik yang lebih cerdas dari Sapa Tazkia.
            </p>

            {showSuccess && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <span className="block sm:inline">✅ Autentikasi berhasil! Mengarahkan...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <span className="block sm:inline">{error}</span>
                {error.includes('sudah terdaftar') && (
                  <div style={{marginTop: '10px', fontSize: '14px'}}>
                    <button 
                      type="button"
                      onClick={() => {
                        setEmail('');
                        setError('');
                      }}
                      style={{background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', textDecoration: 'underline'}}
                    >
                      Klik di sini untuk masuk dengan NIM
                    </button>
                  </div>
                )}
                <button 
                  type="button"
                  onClick={() => setError(null)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                <GoogleIcon />
                Lanjutkan dengan Google
              </button>
            </div>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">ATAU</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Masukkan Email atau NIM"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-2">
                Untuk email: gunakan email Tazkia (@student.tazkia.ac.id, @student.stmik.tazkia.ac.id, atau @tazkia.ac.id)
              </p>
            </div>

            <button
              type="submit"
              className={`w-full py-3 rounded-xl font-semibold text-white transition-colors mb-4 ${
                email && !isLoading ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={!email || isLoading}
            >
              {isLoading ? 'Memproses...' : 'Lanjutkan'}
            </button>

            <button 
              type="button"
              onClick={handleClose} 
              className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2" 
              disabled={isLoading}
            >
              Tutup
            </button>
          </form>
        );

      case 1:
        return (
          <VerificationForm
            email={email}
            onVerify={handleVerification}
            onResend={handleResendCode}
            onBack={handleBackToEmail}
            isLoading={isLoading}
            error={error}
          />
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm relative transform transition-all duration-300 scale-100">
        <button 
          type="button"
          onClick={handleClose} 
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100"
          disabled={isLoading}
        >
          <X size={24} />
        </button>
        <div className="text-center mt-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

// --- Komponen Utama Landing Page ---
const LandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    user, 
    logout, 
    loading: authLoading,
    isAuthenticated,
    handleGoogleAuthCallback,
    needsProfileCompletion,
    pendingVerification,
    pendingEmail
  } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialModalStep, setInitialModalStep] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [greeting, setGreeting] = useState('');
  
  // State untuk riwayat chat
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);

  // ✅ TAMBAHAN: Auto open modal jika ada pending verification
  useEffect(() => {
    if (pendingVerification && pendingEmail && !isModalOpen) {
      console.log('🔍 [LANDING PAGE] Auto-opening modal for pending verification');
      setInitialModalStep(1);
      setIsModalOpen(true);
    }
  }, [pendingVerification, pendingEmail, isModalOpen]);

  // ✅ TAMBAHAN: Load chat history untuk user yang login
  const loadChatHistory = useCallback(async () => {
    if (!user || !user.id) {
      console.log('🔍 [LANDING PAGE] No user ID, skipping chat history load');
      setChatHistory([]);
      return;
    }

    try {
      console.log('🔍 [LANDING PAGE] Loading chat history for user:', user.id);
      const response = await api.get('/api/ai/conversations');
      console.log('✅ [LANDING PAGE] Chat history loaded:', response.data.conversations);
      setChatHistory(response.data.conversations || []);
    } catch (error) {
      console.error('❌ [LANDING PAGE] Error loading chat history:', error);
      
      if (error.response?.status === 401) {
        console.log('🛑 [LANDING PAGE] 401 Unauthorized - Token invalid');
      } else if (error.response?.status === 404) {
        console.log('🔍 [LANDING PAGE] 404 - No conversations found');
        setChatHistory([]);
      } else {
        console.error('❌ [LANDING PAGE] Other error:', error.response?.data || error.message);
        setChatHistory([]);
      }
    }
  }, [user]);

  // ✅ BARU: Handle auth callback dari URL parameters (Google OAuth)
  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const userData = urlParams.get('user');
      const success = urlParams.get('success');
      const error = urlParams.get('error');

      console.log('🔍 [LANDING PAGE] Auth callback params:', {
        token: !!token,
        userData: !!userData,
        success,
        error
      });

      if (token && userData && success === 'true') {
        try {
          console.log('🔍 [LANDING PAGE] Processing Google auth callback...');
          await handleGoogleAuthCallback(token, userData);
          
          // Clear URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          
          console.log('✅ [LANDING PAGE] Google auth callback processed successfully');
        } catch (error) {
          console.error('❌ [LANDING PAGE] Google auth callback failed:', error);
        }
      } else if (error) {
        console.error('❌ [LANDING PAGE] Auth callback error:', error);
      }
    };

    handleAuthCallback();
  }, [handleGoogleAuthCallback]);

  // ✅ PERBAIKAN: Handle redirect berdasarkan user status
  useEffect(() => {
    console.log('🔍 [LANDING PAGE] Auth effect - User:', user, 'Authenticated:', isAuthenticated, 'Loading:', authLoading);

    // Only proceed if we have user data and not loading
    if (!authLoading && isAuthenticated && user) {
      console.log('🔍 [LANDING PAGE] Checking profile status:', {
        isProfileComplete: user.isProfileComplete,
        fullName: user.fullName,
        needsProfileCompletion: needsProfileCompletion()
      });

      // Check jika user perlu complete profile
      const shouldCompleteProfile = needsProfileCompletion();

      if (shouldCompleteProfile) {
        console.log('🔍 [LANDING PAGE] User needs profile completion, checking current page...');
        
        const currentPath = window.location.pathname;
        const isComingFromAboutYou = location.state?.from === 'profile-completion';
        const isOnAboutYouPage = currentPath === '/about-you' || currentPath.includes('/about-you');
        const isSubmitting = location.state?.isSubmitting;
        
        // Hanya redirect jika BENAR-BENAR belum di AboutYouPage dan tidak berasal dari submission
        if (!isOnAboutYouPage && !isComingFromAboutYou && !isSubmitting) {
          console.log('🔍 [LANDING PAGE] Redirecting to AboutYouPage');
          navigate('/about-you', { 
            state: { 
              from: 'landing-page',
              userEmail: user.email 
            } 
          });
        } else {
          console.log('🔍 [LANDING PAGE] Already on/about to go to AboutYouPage, skipping redirect');
        }
      } else {
        console.log('🔍 [LANDING PAGE] User profile complete, loading chat history');
        loadChatHistory();
      }
    }
  }, [isAuthenticated, user, authLoading, needsProfileCompletion, navigate, loadChatHistory, location.state?.from, location.state?.isSubmitting]);

  // ✅ FUNGSI: Untuk mendapatkan nama user dengan maksimal 2 kata
  const getUserName = useCallback(() => {
    const fullName = user?.fullName || user?.name || user?.username || 'User';
    const words = fullName.split(' ').slice(0, 2);
    return words.join(' ');
  }, [user]);

  // ✅ FIXED: Refresh greeting function
  const refreshGreeting = useCallback(() => {
    const userShortName = getUserName();
    
    const greetingsForUser = [
      `Hi ${userShortName}, Good to see you!`,
      `Welcome back, ${userShortName}!`,
      `Hello ${userShortName}, ready to chat?`,
      `Hi ${userShortName}, how can I help you today?`,
      `Great to have you here, ${userShortName}!`
    ];

    const greetingsForGuest = [
      'Where should we begin?',
      'Hello! How can I assist you today?',
      'Welcome to Sapa Tazkia! How can I help?',
      'Ready to get started? What would you like to know?',
      'Hi there! What brings you here today?'
    ];
    
    const availableGreetings = user ? greetingsForUser : greetingsForGuest;
    const randomGreeting = availableGreetings[Math.floor(Math.random() * availableGreetings.length)];
    setGreeting(randomGreeting);
  }, [user, getUserName]);

  // ✅ FIXED: Effect untuk set greeting awal
  useEffect(() => {
    refreshGreeting();
  }, [refreshGreeting]);

  // ✅ PERBAIKAN: Fungsi openModal yang lebih robust
  const openModal = useCallback((step) => {
    console.log('🔍 [LANDING PAGE] Opening modal with step:', step);
    setInitialModalStep(step);
    setIsModalOpen(true);
  }, []);

  // ✅ PERBAIKAN: Fungsi closeModal yang eksplisit
  const closeModal = useCallback(() => {
    console.log('🔍 [LANDING PAGE] Closing modal manually');
    setIsModalOpen(false);
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  // ✅ TAMBAHAN: Handle delete chat dengan modal confirmation
  const handleDeleteClick = (chatId) => {
    setChatToDelete(chatId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!chatToDelete || !user) {
      setShowDeleteModal(false);
      setChatToDelete(null);
      return;
    }

    setIsDeleting(true);
    
    const previousChatHistory = [...chatHistory];
    setChatHistory(prev => prev.filter(chat => chat.id !== chatToDelete));
    
    if (currentChatId === chatToDelete) {
      setCurrentChatId(null);
    }

    try {
      console.log('🗑️ [LANDING PAGE] Deleting chat:', chatToDelete);
      await api.delete(`/api/ai/conversations/${chatToDelete}`);
      console.log('✅ [LANDING PAGE] Chat deleted successfully');

    } catch (error) {
      console.error('❌ [LANDING PAGE] Error deleting chat:', error);
      
      setChatHistory(previousChatHistory);
      
      if (error.response?.status === 401) {
        console.log('🛑 [LANDING PAGE] 401 Unauthorized');
      } else if (error.response?.status === 404) {
        console.log('🔍 [LANDING PAGE] 404 - Chat not found');
      } else {
        alert('Gagal menghapus chat. Data dikembalikan.');
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setChatToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setChatToDelete(null);
  };

  // ✅ TAMBAHAN: Handle select chat - navigasi ke chat page dengan chat yang dipilih
  const handleSelectChat = (chatId) => {
    console.log('🔍 [LANDING PAGE] Selecting chat:', chatId);
    navigate('/chat', { 
      state: { 
        selectedChatId: chatId 
      } 
    });
  };

  // ✅ FIXED: Fungsi untuk handle pengiriman pesan dengan navigasi yang benar
  const handleSendMessage = () => {
    if (message.trim()) {
      if (user) {
        navigate('/chat', { 
          state: { 
            initialMessage: message.trim(),
            isGuest: false 
          } 
        });
      } else {
        navigate('/chat', { 
          state: { 
            initialMessage: message.trim(),
            isGuest: true 
          }
        });
      }
    }
  };

  // ✅ FIXED: Fungsi untuk handle key press (Enter)
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // ✅ FIXED: Fungsi untuk langsung ke chat sebagai guest
  const handleGuestChat = () => {
    navigate('/chat', { 
      state: { 
        isGuest: true 
      }
    });
  };

  // ✅ FUNGSI: Handle new chat di Landing Page
  const handleNewChat = () => {
    window.location.reload();
  };

  // ✅ FUNGSI: Handle settings click
  const handleSettingsClick = () => {
    console.log('Settings clicked');
  };

  return (
    <div className="min-h-screen flex bg-amber-50 font-sans overflow-hidden">
      {/* ✅ MODAL KONFIRMASI HAPUS */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Hapus Chat?"
        message="Apakah Anda yakin ingin menghapus chat ini?"
        confirmText="Hapus"
        cancelText="Batal"
        isDeleting={isDeleting}
      />

      {/* ✅ UPDATED: Menggunakan komponen Sidebar reusable */}
      <Sidebar
        user={user}
        onLogin={() => openModal(0)}
        onLogout={logout}
        chatHistory={chatHistory}
        onSelectChat={handleSelectChat}
        currentChatId={currentChatId}
        onDeleteChat={handleDeleteClick}
        isDeleting={isDeleting}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        onNewChat={handleNewChat}
        onSettingsClick={handleSettingsClick}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <nav className="flex items-center justify-between p-6 flex-shrink-0">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center focus:outline-none hover:opacity-80 transition-opacity"
            >
              <img 
                src="/logosapatazkia.png" 
                alt="Sapa Tazkia Logo" 
                className="h-8 w-auto hover:scale-105 transition-transform duration-200"
              />
            </button>
          </div>
          
          <div className="flex items-center space-x-3">
            {authLoading ? (
              <span className="text-gray-500">Loading...</span>
            ) : user ? (
              null
            ) : (
              <>
                <Button
                  variant="primary"
                  size="md"
                  className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200/50 rounded-lg"
                  onClick={() => openModal(0)}
                >
                  SIGN IN
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200/50 rounded-lg"
                  onClick={handleGuestChat}
                >
                  TRY AS GUEST
                </Button>
              </>
            )}
          </div>
        </nav>

        {/* Hero Section - FIXED */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 overflow-y-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-6 max-w-4xl">
              <GradientText>{greeting}</GradientText>
            </h1>
          </div>

          <div className="w-full max-w-2xl">
            <div className="relative flex items-center p-2 bg-white border border-gray-300 rounded-full shadow-xl">
              <button className="p-2 mr-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
                <Plus size={20} />
              </button>
              <input
                type="text"
                placeholder="Message Sapa Tazkia"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-2 py-2 text-lg text-gray-700 placeholder-gray-500 focus:outline-none bg-white"
              />
              <button
                className="p-3 bg-blue-500 text-white hover:bg-blue-600 rounded-full transition-colors shadow-md ml-2"
                aria-label="Send Message"
                onClick={handleSendMessage}
                disabled={!message.trim()}
              >
                <ArrowUp size={20} />
              </button>
            </div>
            
            {/* Guest mode info */}
            <div className="mt-4 text-center">
              <p className="text-gray-500 text-sm">
                {user ? 'AI can make mistakes. Cross-check academic information with official sources.' : 'AI can make mistakes. Cross-check academic information with official sources.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Auth Modal dengan form verifikasi */}
      <AuthModal
        isOpen={isModalOpen}
        onClose={closeModal}
        initialStep={initialModalStep}
      />
    </div>
  );
};

export default LandingPage;