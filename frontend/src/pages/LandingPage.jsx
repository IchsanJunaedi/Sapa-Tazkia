import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosConfig';
import { Plus, X, ArrowUp, Menu } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import Sidebar from '../components/layout/SideBar';
import Swal from 'sweetalert2'; // ✅ TAMBAHAN: Import SweetAlert2

// --- Komponen GradientText ---
const GradientText = ({ children, className = '' }) => {
  return (
    <span
      className={`bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200 ${className}`}
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
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-[0.15em] text-indigo-400 uppercase mb-2">Verifikasi</p>
        <h2 className="text-[26px] font-black text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
          Cek email kamu
        </h2>
        <p className="text-sm text-white/40 mt-2 leading-relaxed">
          Kode dikirim ke{' '}
          <span className="text-white/70 font-medium">{email}</span>
        </p>
      </div>

      {resendSuccess && (
        <div className="px-4 py-3 rounded-xl mb-4 text-sm text-green-300 flex items-center gap-2"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <span>✓</span> Kode verifikasi telah dikirim ulang!
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl mb-4 text-sm text-red-300 relative"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
          <button
            type="button"
            onClick={() => error && typeof error === 'object' && error.onClose ? error.onClose() : null}
            className="absolute top-2.5 right-2.5 text-red-400/60 hover:text-red-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* OTP input */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="Masukkan kode 6 digit"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyPress={handleKeyPress}
          className="auth-input w-full px-4 py-[14px] text-white rounded-xl text-[15px] transition-all duration-200 focus:outline-none text-center tracking-[0.3em] font-semibold"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          disabled={isLoading}
          maxLength={6}
        />
        <p className="text-[11px] text-white/25 mt-2 text-center">
          Berlaku selama 10 menit
        </p>
      </div>

      {/* Verify button */}
      <button
        type="submit"
        disabled={code.trim().length < 4 || isLoading}
        className={`w-full py-[14px] rounded-xl font-semibold text-white text-[15px] transition-all duration-300 ${
          code.trim().length >= 4 && !isLoading
            ? 'bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-blue-500 hover:scale-[1.02] active:scale-[0.99]'
            : 'cursor-not-allowed'
        }`}
        style={code.trim().length < 4 || isLoading ? { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.25)' } : {}}
      >
        {isLoading ? 'Memverifikasi...' : 'Verifikasi'}
      </button>

      {/* Secondary actions */}
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendLoading}
          className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-all duration-200 text-indigo-400 hover:text-indigo-300 disabled:text-white/20"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          {resendLoading ? 'Mengirim...' : 'Kirim Ulang'}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-all duration-200 text-white/35 hover:text-white/60 disabled:text-white/15"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
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
      const errorMessage = err.message || 'Terjadi kesalahan saat autentikasi';
      setError(errorMessage);

      // ✅ TAMBAHAN: POP UP SWEETALERT jika email sudah terdaftar
      if (
        errorMessage.toLowerCase().includes('already registered') ||
        errorMessage.toLowerCase().includes('sudah terdaftar')
      ) {
        Swal.fire({
          title: 'Email Sudah Terdaftar!',
          text: 'Sepertinya kamu sudah pernah mendaftar dengan email ini.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#111827', // Warna dark grey sesuai tema (gray-900)
          cancelButtonColor: '#d33',
          confirmButtonText: 'Login Saja',
          cancelButtonText: 'Gunakan Email Lain',
          background: '#fff',
          borderRadius: '1rem',
          customClass: {
            popup: 'rounded-2xl',
            confirmButton: 'rounded-xl px-4 py-2',
            cancelButton: 'rounded-xl px-4 py-2'
          }
        }).then((result) => {
          if (result.isConfirmed) {
            // Jika user memilih Login, hilangkan pesan error agar bersih
            setError('');
          } else {
            // Jika user memilih email lain, kosongkan form
            setEmail('');
            setError('');
          }
        });
      }

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
    window.location.href = `${API_URL}/auth/google`;
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
          <form onSubmit={handleContinue}>
            {/* Header */}
            <div className="mb-7">
              <p className="text-xs font-semibold tracking-[0.15em] text-indigo-400 uppercase mb-2">Selamat datang</p>
              <h2 className="text-[26px] font-black text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Log in or sign up
              </h2>
              <p className="text-[13px] text-white/40 mt-2 leading-relaxed">
                Panduan akademik lebih cerdas dengan Sapa Tazkia.
              </p>
            </div>

            {showSuccess && (
              <div className="px-4 py-3 rounded-xl mb-5 text-sm text-green-300 flex items-center gap-2"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <span>✓</span> Autentikasi berhasil! Mengarahkan...
              </div>
            )}

            {error && (
              <div className="px-4 py-3 rounded-xl mb-5 text-sm text-red-300 relative"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                {error}
                {error.includes('sudah terdaftar') && (
                  <button
                    type="button"
                    onClick={() => { setEmail(''); setError(''); }}
                    className="block mt-2 text-indigo-400 hover:text-indigo-300 underline text-xs transition-colors"
                  >
                    Masuk dengan NIM
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="absolute top-2.5 right-2.5 text-red-400/60 hover:text-red-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-[13px] flex items-center justify-center rounded-xl font-medium text-white text-[14px] transition-all duration-200 hover:bg-white/10 mb-5"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <GoogleIcon />
              Lanjutkan dengan Google
            </button>

            {/* Divider */}
            <div className="flex items-center mb-5">
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
              <span className="mx-4 text-[11px] font-semibold text-white/25 tracking-[0.12em]">ATAU</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
            </div>

            {/* Email / NIM input */}
            <div className="mb-1">
              <input
                type="text"
                placeholder="Email atau NIM"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                className="auth-input w-full px-4 py-[14px] text-white rounded-xl text-[15px] transition-all duration-200 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                disabled={isLoading}
              />
              <p className="text-[11px] text-white/25 mt-2 leading-relaxed">
                Gunakan email kampus Tazkia atau NIM Anda
              </p>
            </div>

            {/* Continue button */}
            <button
              type="submit"
              disabled={!email || isLoading}
              className={`w-full py-[14px] rounded-xl font-semibold text-[15px] text-white transition-all duration-300 mt-5 ${
                email && !isLoading
                  ? 'bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-blue-500 hover:shadow-indigo-400/50 hover:scale-[1.02] active:scale-[0.99]'
                  : 'cursor-not-allowed'
              }`}
              style={!email || isLoading ? { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.25)' } : {}}
            >
              {isLoading ? 'Memproses...' : 'Lanjutkan'}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full mt-4 text-[13px] text-white/25 hover:text-white/50 transition-colors py-1"
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2, 6, 40, 0.55)' }}
    >
      <div
        className="auth-modal-card w-full relative overflow-hidden"
        style={{
          maxWidth: '400px',
          background: 'rgba(10, 18, 70, 0.65)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.06)'
        }}
      >
        {/* Top accent stripe */}
        <div className="h-[3px] w-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-400" />

        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          disabled={isLoading}
          className="absolute top-5 right-5 p-1.5 rounded-full transition-all duration-200 text-white/30 hover:text-white/70"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <X size={16} />
        </button>

        {/* Form content */}
        <div className="px-8 py-7">
          {renderContent()}
        </div>

        {/* Footer brand line */}
        <div className="px-8 pb-6 pt-0">
          <p className="text-[11px] text-white/15 text-center tracking-wide">
            STMIK TAZKIA · Sapa AI © 2025
          </p>
        </div>
      </div>

      <style>{`
        .auth-modal-card {
          animation: authModalIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes authModalIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        .auth-input::placeholder {
          color: rgba(255,255,255,0.28);
        }
        .auth-input:focus {
          border-color: rgba(99,102,241,0.6) !important;
          background: rgba(255,255,255,0.09) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .auth-input:disabled {
          opacity: 0.4;
        }
      `}</style>
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

  // ✅ PERBAIKAN: Ubah default state menjadi true agar sidebar terbuka saat load
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [message, setMessage] = useState('');
  const [greeting, setGreeting] = useState('');

  // State untuk riwayat chat
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);

  // ✅ MOBILE: State untuk mobile sidebar overlay
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
      const response = await api.get('/ai/conversations');
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

      // ✅ BARU: Handle auth_error untuk invalid domain (Gmail login attempt)
      const authError = urlParams.get('auth_error');
      const errorMessage = urlParams.get('message');
      const failedEmail = urlParams.get('email');

      console.log('🔍 [LANDING PAGE] Auth callback params:', {
        token: !!token,
        userData: !!userData,
        success,
        error,
        authError,
        failedEmail
      });

      // ✅ BARU: Tampilkan SweetAlert2 untuk invalid domain error
      if (authError === 'invalid_domain') {
        console.log('🚫 [LANDING PAGE] Invalid domain detected:', failedEmail);

        // Clear URL parameters first
        window.history.replaceState({}, document.title, window.location.pathname);

        // ✅ REDESIGN v2: Glassmorphism + Pill Button + Modern Icon
        Swal.fire({
          iconHtml: `
            <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
            </div>
          `,
          title: 'Oops! Email Tidak Valid',
          html: `
            <div style="text-align: center; padding: 8px 0;">
              <p style="font-size: 15px; color: #64748b; margin-bottom: 16px;">
                <strong style="color: #1e293b;">${failedEmail || 'Email kamu'}</strong> bukan email kampus
              </p>
              
              <div style="background: rgba(255,255,255,0.7); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); border-radius: 16px; padding: 16px; margin: 16px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                <p style="font-size: 12px; color: #94a3b8; margin-bottom: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Gunakan email kampus</p>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <span style="background: rgba(255,255,255,0.9); backdrop-filter: blur(4px); padding: 10px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: #1e293b; border: 1px solid rgba(0,0,0,0.06);">@student.tazkia.ac.id</span>
                  <span style="background: rgba(255,255,255,0.9); backdrop-filter: blur(4px); padding: 10px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: #1e293b; border: 1px solid rgba(0,0,0,0.06);">@tazkia.ac.id</span>
                  <span style="background: rgba(255,255,255,0.9); backdrop-filter: blur(4px); padding: 10px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: #1e293b; border: 1px solid rgba(0,0,0,0.06);">@student.stmik.tazkia.ac.id</span>
                </div>
              </div>
            </div>
          `,
          confirmButtonText: 'Coba Lagi',
          showCancelButton: false,
          allowOutsideClick: true,
          backdrop: 'rgba(15, 23, 42, 0.6)',
          background: 'rgba(255, 255, 255, 0.95)',
          customClass: {
            popup: 'swal-glassmorphism',
            icon: 'swal-custom-icon'
          },
          didOpen: () => {
            // Glassmorphism untuk popup
            const popup = document.querySelector('.swal2-popup');
            if (popup) {
              popup.style.backdropFilter = 'blur(16px)';
              popup.style.webkitBackdropFilter = 'blur(16px)';
              popup.style.borderRadius = '24px';
              popup.style.border = '1px solid rgba(255,255,255,0.2)';
              popup.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
            }
            // Hide default icon container
            const iconContainer = document.querySelector('.swal2-icon');
            if (iconContainer) {
              iconContainer.style.border = 'none';
              iconContainer.style.margin = '20px auto 0';
            }
            // Custom styling untuk title
            const title = document.querySelector('.swal2-title');
            if (title) {
              title.style.fontSize = '22px';
              title.style.fontWeight = '700';
              title.style.color = '#0f172a';
              title.style.marginTop = '8px';
            }
            // Pill button dengan gradient
            const btn = document.querySelector('.swal2-confirm');
            if (btn) {
              btn.style.borderRadius = '999px';
              btn.style.padding = '14px 40px';
              btn.style.fontSize = '14px';
              btn.style.fontWeight = '600';
              btn.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
              btn.style.border = 'none';
              btn.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.3)';
              btn.style.transition = 'all 0.2s ease';
            }
          }
        }).then((result) => {
          if (result.isConfirmed) {
            // Buka modal login ketika user klik "Coba Lagi"
            setIsModalOpen(true);
          }
        });

        return; // Stop processing, error already handled
      }

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

        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleAuthCallback();
  }, [handleGoogleAuthCallback]);

  // ✅ PERBAIKAN: Handle redirect berdasarkan user status - DIPERBAIKI
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
            },
            replace: true // ✅ DITAMBAHKAN: replace: true untuk mencegah redirect loop
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
      `Assalamu'alaikum, ${userShortName}!`,
      `Ahlan wa sahlan, ${userShortName}!`,
      `Bismillah, ${userShortName}! Apa yang bisa kita kerjakan hari ini?`,
      `Assalamu'alaikum wa rahmatullah, ${userShortName}! Senang berjumpa dengan Anda.`,
      `Marhaban, ${userShortName}!`,
    ];

    const greetingsForGuest = [
      `Assalamu'alaikum! Selamat datang di Sapa Tazkia. Ada yang bisa kami bantu?`,
      `Ahlan wa sahlan! Di mana sebaiknya kita mulai perbincangan ini?`,
      `Bismillah, mari kita mulai! Apa yang ingin Anda ketahui hari ini?`,
      `Assalamu'alaikum. Senang Anda berkunjung! Apa yang membawa Anda ke sini hari ini?`,
      `Marhaban! Kami siap membantu. Silakan beritahu kami kebutuhan Anda.`,
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
      await api.delete(`/ai/conversations/${chatToDelete}`);
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

  // ✅ PERBAIKAN: Handle select chat - navigasi ke chat page dengan chat yang dipilih - DIPERBAIKI
  const handleSelectChat = (chatId) => {
    console.log('🔍 [LANDING PAGE] Selecting chat:', chatId);
    navigate('/chat', {
      state: {
        selectedChatId: chatId
      }
    });
  };

  // ✅ PERBAIKAN BESAR: Fungsi untuk handle pengiriman pesan dengan navigasi yang benar - DIPERBAIKI
  const handleSendMessage = () => {
    if (message.trim()) {
      console.log('🔍 [LANDING PAGE] Sending message to chat page:', message.trim());

      // ✅ PERBAIKAN: Clear input field immediately
      const messageToSend = message.trim();
      setMessage('');

      // Simpan state navigation dengan benar
      const navigationState = {
        initialMessage: messageToSend,
        isGuest: !user,
        timestamp: Date.now(), // Untuk memastikan state selalu fresh
        fromLandingPage: true // ✅ TAMBAHAN: Flag khusus untuk identifikasi dari landing page
      };

      // Navigate ke chat page dengan state
      navigate('/chat', {
        state: navigationState,
        replace: false // Biarkan replace: false agar user bisa kembali ke landing page
      });
    }
  };

  // ✅ FIXED: Fungsi untuk handle key press (Enter)
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // ✅ PERBAIKAN: Fungsi untuk langsung ke chat sebagai guest - DIPERBAIKI
  const handleGuestChat = () => {
    console.log('🔍 [LANDING PAGE] Starting guest chat');
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
    <div className="min-h-screen flex font-sans overflow-hidden" style={{ background: 'linear-gradient(135deg, #0A1560 0%, #1E3BCC 55%, #3D4FE0 100%)' }}>
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
        isMobileSidebarOpen={isMobileSidebarOpen}
        onCloseMobileSidebar={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <nav className="flex items-center justify-between p-3 sm:p-4 md:p-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Hamburger Menu - Mobile Only */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 rounded-lg text-white/80 hover:bg-white/10 transition-colors md:hidden"
              title="Open Menu"
            >
              <Menu size={24} />
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center focus:outline-none hover:opacity-80 transition-opacity"
            >
              <img
                src="/a2.png"
                alt="Sapa Tazkia Logo"
                className="h-8 w-auto hover:scale-105 transition-transform duration-200"
              />
            </button>
          </div>

          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            {authLoading ? (
              <span className="text-white/50">Loading...</span>
            ) : user ? (
              null
            ) : (
              <>
                <button
                  className="text-white text-xs sm:text-sm font-semibold px-5 py-2 rounded-full transition-all duration-300 bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/40 hover:from-indigo-400 hover:to-blue-500 hover:shadow-indigo-400/60 hover:scale-105 active:scale-95"
                  onClick={() => openModal(0)}
                >
                  SIGN IN
                </button>
                <button
                  className="text-white text-xs sm:text-sm font-semibold px-5 py-2 rounded-full transition-all duration-300 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 hover:scale-105 active:scale-95"
                  onClick={handleGuestChat}
                >
                  TRY AS GUEST
                </button>
              </>
            )}
          </div>
        </nav>

        {/* Hero Section - FIXED */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-10 sm:pb-20 overflow-y-auto">
          <div className="text-center mb-12">
            <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-center mb-4 sm:mb-6 max-w-4xl break-words leading-tight">
              <GradientText>{greeting}</GradientText>
            </h2>
          </div>

          <div className="w-full max-w-2xl">
            <div className="relative flex items-center p-2 rounded-full backdrop-blur-lg border border-white/25 bg-white/10">
              <button className="p-2 mr-2 bg-white/10 text-white hover:bg-white/20 rounded-full transition-colors">
                <Plus size={20} />
              </button>
              <input
                type="text"
                placeholder="Message Sapa Tazkia"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-2 py-2 text-lg text-white placeholder-white/50 focus:outline-none bg-transparent"
              />
              <button
                className={`p-3 rounded-full transition-all duration-300 ml-2 flex items-center justify-center text-white ${
                  message.trim()
                    ? 'bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/50 hover:from-indigo-400 hover:to-blue-500 hover:shadow-indigo-400/70 hover:scale-105 active:scale-95'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                }`}
                aria-label="Send Message"
                onClick={handleSendMessage}
                disabled={!message.trim()}
              >
                <ArrowUp size={20} />
              </button>
            </div>

            {/* Guest mode info */}
            <div className="mt-4 text-center">
              <p
                className="text-white/60 text-sm"
                style={{ textShadow: '0 0 18px rgba(255,255,255,0.35), 0 0 36px rgba(255,255,255,0.12)' }}
              >
                AI can make mistakes. Cross-check academic information with official sources.
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
      <SEOContent />
    </div>
  );
};

// --- SEO Content & E-E-A-T Section ---
const SEOContent = () => (
  <section
    aria-label="Tentang Sapa-Tazkia"
    className="bg-white border-t border-gray-100 py-16 px-6"
  >
    <div className="max-w-4xl mx-auto">
      {/* H1 — hanya satu per halaman, wajib untuk SEO */}
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
        Sapa-Tazkia: AI Chatbot Akademik STMIK Tazkia
      </h1>

      {/* Deskripsi utama dengan keyword density natural */}
      <p className="text-gray-700 text-lg leading-relaxed mb-4">
        <strong>Sapa-Tazkia</strong> adalah asisten kecerdasan buatan (AI) berbasis{' '}
        <em>Retrieval-Augmented Generation (RAG)</em> yang dirancang khusus untuk
        mendukung kegiatan akademik mahasiswa{' '}
        <strong>STMIK Tazkia</strong>. Platform chatbot ini memungkinkan Anda
        mendapatkan informasi tentang jadwal kuliah, nilai akademik, dan materi
        perkuliahan secara instan dan akurat.
      </p>

      <p className="text-gray-700 leading-relaxed mb-4">
        Dengan memanfaatkan teknologi AI terkini dan basis data pengetahuan kampus,
        Sapa-Tazkia hadir sebagai solusi digitalisasi layanan pendidikan yang cerdas.
        Chatbot ini memahami konteks pertanyaan dalam bahasa Indonesia dan memberikan
        jawaban yang relevan sesuai dengan kurikulum dan regulasi{' '}
        <strong>STMIK Tazkia</strong>.
      </p>

      <p className="text-gray-700 leading-relaxed mb-10">
        Sapa-Tazkia merupakan wujud nyata penerapan <strong>teknologi AI</strong> dalam
        dunia pendidikan tinggi Indonesia — menggabungkan inovasi, aksesibilitas, dan
        kualitas layanan akademik dalam satu platform terintegrasi.
      </p>

      {/* Fitur Utama */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {[
          {
            title: 'Tanya Jawab Akademik',
            desc: 'Jawab pertanyaan seputar jadwal, nilai, dan mata kuliah menggunakan basis pengetahuan kampus secara real-time.',
          },
          {
            title: 'Berbasis RAG & AI',
            desc: 'Menggunakan Retrieval-Augmented Generation untuk jawaban yang akurat dan relevan, bukan sekadar template.',
          },
          {
            title: 'Akses Multi-Platform',
            desc: 'Tersedia di browser desktop maupun mobile. Login dengan NIM atau akun Google kampus Anda.',
          },
        ].map((f) => (
          <div key={f.title} className="bg-orange-50 rounded-xl p-5">
            <h2 className="font-semibold text-gray-900 mb-2">{f.title}</h2>
            <p className="text-gray-600 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* E-E-A-T: Tentang Tim & Kredibilitas */}
      <div className="bg-gray-50 rounded-2xl p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Tentang Pengembang
        </h2>
        <p className="text-gray-700 leading-relaxed mb-3">
          Sapa-Tazkia dikembangkan oleh tim mahasiswa Program Studi Teknik
          Informatika <strong>STMIK Tazkia</strong> sebagai proyek riset terapan
          di bidang kecerdasan buatan dan sistem informasi akademik. Proyek ini
          dibimbing oleh dosen dan staf IT STMIK Tazkia untuk memastikan kualitas,
          keamanan, dan relevansi terhadap kebutuhan civitas akademika.
        </p>
        <p className="text-gray-700 leading-relaxed">
          Kami berkomitmen untuk terus meningkatkan kemampuan AI ini berdasarkan
          feedback dari mahasiswa dan kebutuhan nyata lingkungan kampus.
        </p>
      </div>

      {/* Footer / Kontak */}
      <footer className="border-t border-gray-200 pt-8 text-sm text-gray-500">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-700 mb-1">Sapa-Tazkia</p>
            <p>AI Chatbot Akademik — STMIK Tazkia</p>
            <p>Bogor, Jawa Barat, Indonesia</p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Kontak</p>
            <p>Email: <a href="mailto:info@stmik-tazkia.ac.id" className="text-orange-500 hover:underline">info@stmik-tazkia.ac.id</a></p>
            <p>Website: <a href="https://stmik-tazkia.ac.id" className="text-orange-500 hover:underline" target="_blank" rel="noopener noreferrer">stmik-tazkia.ac.id</a></p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Legal</p>
            <p>© {new Date().getFullYear()} STMIK Tazkia.</p>
            <p>Hak cipta dilindungi undang-undang.</p>
          </div>
        </div>
      </footer>
    </div>
  </section>
);

export default LandingPage;