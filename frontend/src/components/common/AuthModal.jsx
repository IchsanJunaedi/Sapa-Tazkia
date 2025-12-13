import React, { useState, useEffect } from 'react';
import { X, Mail, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axiosConfig';
import Swal from 'sweetalert2'; // ✅ 1. Import SweetAlert2

// Komponen ikon Google
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6 mr-3">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.343c-1.896,3.101-5.466,6.17-11.343,6.17 c-6.958,0-12.632-5.673-12.632-12.632c0-6.958,5.674-12.632,12.632-12.632c3.23,0,6.347,1.385,8.441,3.483l5.882-5.882 C34.004,5.946,29.351,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20 C44,22.659,43.834,21.32,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.309,16.713L11.822,20.3L11.822,20.3C13.298,16.59,17.207,14,21.723,14c3.41,0,6.619,1.218,8.875,3.447l0.024,0.023 l5.845-5.844C34.004,5.946,29.351,4,24,4C16.326,4,9.66,8.275,6.309,14.713z"/>
    <path fill="#4CAF50" d="M24,44c5.205,0,10.222-1.92,13.911-5.385l-6.736-6.495C30.297,33.024,27.265,34.08,24,34.08 c-5.877,0-9.448-3.07-11.344-6.171L6.309,33.287C9.66,39.725,16.326,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20h-0.29c-0.122-0.638-0.344-1.254-0.627-1.851 C41.347,17.385,38.23,16,35,16c-3.265,0-6.297,1.056-8.214,3.003L35.343,28h7.957 C42.834,26.68,44,25.045,44,24C44,22.659,43.834,21.32,43.611,20.083z"/>
  </svg>
);

// Komponen Verification Form
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

  const navigate = useNavigate();

  // Reset state saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      // Jika ada pending verification, langsung ke step verifikasi
      if (pendingVerification && pendingEmail) {
        setStep(2);
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

  // ✅ PERBAIKAN: Handle Continue dengan redirect ke AboutYouPage dan POPUP
  const handleContinue = async (e) => {
    // ✅ 2. Cegah Refresh Halaman
    if (e) e.preventDefault(); 

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
          setStep(2);
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

      // ✅ 3. LOGIKA POP UP SWEETALERT2
      if (
        errorMessage.toLowerCase().includes('already registered') || 
        errorMessage.toLowerCase().includes('sudah terdaftar')
      ) {
        Swal.fire({
          title: 'Email Sudah Terdaftar!',
          text: 'Sepertinya kamu sudah pernah mendaftar dengan email ini.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#111827', // Sesuai tema tombol kamu (gray-900)
          cancelButtonColor: '#d33',
          confirmButtonText: 'Login Saja',
          cancelButtonText: 'Gunakan Email Lain',
          background: '#fff',
          borderRadius: '1rem',
          customClass: {
            popup: 'rounded-2xl', // Agar lebih rounded dan modern
            confirmButton: 'rounded-xl px-4 py-2',
            cancelButton: 'rounded-xl px-4 py-2'
          }
        }).then((result) => {
          if (result.isConfirmed) {
            // User memilih Login Saja: Reset error agar bersih
            setError('');
          } else {
            // User memilih Gunakan Email Lain: Kosongkan field
            setEmail('');
            setError('');
          }
        });
      }

    } finally {
      setIsLoading(false);
    }
  };

  // ✅ PERBAIKAN: Handle Verification dengan redirect ke AboutYouPage
  const handleVerification = async (code) => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log('🔍 [AUTH MODAL] Verifying code for email:', email);
      const result = await verifyEmailCode(email, code);
      
      console.log('🔍 [AUTH MODAL] Verification result:', result);
      
      if (result.success) {
        // ✅ PERBAIKAN: Check jika user perlu complete profile
        const needsProfileCompletion = result.requiresProfileCompletion || 
                                     !result.user.isProfileComplete ||
                                     !result.user.fullName ||
                                     result.user.fullName.trim() === '';
        
        console.log('🔍 [AUTH MODAL] Profile completion check:', {
          requiresProfileCompletion: result.requiresProfileCompletion,
          isProfileComplete: result.user.isProfileComplete,
          fullName: result.user.fullName,
          needsProfileCompletion: needsProfileCompletion
        });
        
        if (needsProfileCompletion) {
          console.log('🔍 [AUTH MODAL] New user detected, redirecting to AboutYouPage');
          // Redirect ke AboutYouPage untuk new user
          handleClose(); // Tutup modal dulu
          navigate('/about-you', {
            state: {
              from: 'email-verification',
              userEmail: email,
              isNewUser: true
            }
          });
        } else {
          console.log('🔍 [AUTH MODAL] Returning user, closing modal');
          // Returning user - tutup modal saja
          setShowSuccess(true);
          setTimeout(() => {
            handleClose();
          }, 1500);
        }
        
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

  // Fungsi untuk guest chat
  const handleGuestChat = () => {
    navigate('/chat', { 
      state: { 
        isGuest: true 
      }
    });
  };

  // Fungsi handleGoogleLogin
  const handleGoogleLogin = () => {
    setIsLoading(true);
    console.log("Mengarahkan ke Google Login...");
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && email && !isLoading) {
      if (step === 0) {
        handleContinue(e); // ✅ Pastikan 'e' dikirim di sini juga
      }
    }
  };

  // Render content berdasarkan step
  const renderContent = () => {
    switch (step) {
      case 0: // Login dengan NIM atau Email
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Masuk ke Akun Anda</h2>
            <p className="text-sm text-gray-600 mb-6">Dapatkan panduan akademik yang lebih cerdas dari Sapa Tazkia.</p>

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
              </div>
            )}

            <div className="space-y-3">
              <button
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
              onClick={handleContinue}
              disabled={!email || isLoading}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-colors mb-4 ${
                (email && !isLoading) ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? 'Memproses...' : 'Lanjutkan'}
            </button>

            {/* Tombol Guest Chat */}
            <button
              onClick={handleGuestChat}
              className="w-full py-3 flex items-center justify-center border border-blue-300 bg-blue-50 rounded-xl font-medium text-blue-600 hover:bg-blue-100 transition-colors mb-4"
              disabled={isLoading}
            >
              <MessageSquare size={20} className="mr-2" />
              Coba sebagai Guest
            </button>

            <button onClick={handleClose} className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2" disabled={isLoading}>
              Tutup
            </button>
          </>
        );

      case 2: // Verification Step
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm relative transform transition-all duration-300 scale-100">
        <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100" disabled={isLoading}>
          <X size={24} />
        </button>
        <div className="text-center mt-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;