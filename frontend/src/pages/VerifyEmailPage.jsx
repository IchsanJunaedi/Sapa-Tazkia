import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';

const VerifyEmailPage = () => {
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = useRef([]);
  const { login } = useAuth();

  // Initialize input refs
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  // ✅ PERBAIKAN: Get email from multiple sources including Google OAuth
  useEffect(() => {
    const locationEmail = location.state?.email;
    const storedEmail = localStorage.getItem('userEmail');
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');
    const oauthUserData = location.state?.userData;
    
    let finalEmail = '';
    let finalUserData = null;
    
    console.log('🔍 [VERIFY EMAIL] Checking email sources:', {
      locationEmail,
      storedEmail,
      pendingEmail,
      oauthUserData: !!oauthUserData
    });

    // Priority order for email sources
    if (locationEmail) {
      finalEmail = locationEmail;
      console.log('🔍 [VERIFY EMAIL] Email from location state:', locationEmail);
    } else if (pendingEmail) {
      finalEmail = pendingEmail;
      console.log('🔍 [VERIFY EMAIL] Email from pending verification:', pendingEmail);
    } else if (storedEmail) {
      finalEmail = storedEmail;
      console.log('🔍 [VERIFY EMAIL] Email from localStorage:', storedEmail);
    } else if (oauthUserData?.email) {
      finalEmail = oauthUserData.email;
      finalUserData = oauthUserData;
      console.log('🔍 [VERIFY EMAIL] Email from OAuth user data:', oauthUserData.email);
    } else {
      console.log('❌ [VERIFY EMAIL] No email found, redirecting to login');
      navigate('/login', { 
        state: { error: 'Sesi verifikasi telah berakhir. Silakan daftar ulang.' }
      });
      return;
    }
    
    setEmail(finalEmail);
    
    // ✅ PERBAIKAN: Simpan user data jika dari OAuth untuk digunakan setelah verifikasi
    if (finalUserData) {
      localStorage.setItem('verificationUserData', JSON.stringify(finalUserData));
      console.log('✅ [VERIFY EMAIL] OAuth user data saved for post-verification');
    }
  }, [location, navigate]);

  // Handle countdown timer
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  /**
   * Handle input change for verification code
   */
  const handleInputChange = (index, value) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newCode.every(digit => digit !== '') && index === 5) {
      handleVerification();
    }
  };

  /**
   * Handle key events for better UX
   */
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      // Move to previous input on backspace
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  /**
   * Handle paste event
   */
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const numbers = pastedData.replace(/\D/g, '').slice(0, 6).split('');
    
    if (numbers.length === 6) {
      const newCode = [...verificationCode];
      numbers.forEach((num, index) => {
        newCode[index] = num;
      });
      setVerificationCode(newCode);
      setError('');
      
      // Focus last input
      inputRefs.current[5]?.focus();
    }
  };

  /**
   * ✅ PERBAIKAN: Verify the email with the code - Handle Google OAuth case
   */
  const handleVerification = async () => {
    const code = verificationCode.join('');
    
    if (code.length !== 6) {
      setError('Kode verifikasi harus 6 digit');
      return;
    }

    if (!email) {
      setError('Email tidak ditemukan. Silakan daftar ulang.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔍 [VERIFY EMAIL] Verifying code for email:', email);
      
      const response = await api.post('/api/auth/verify-email', {
        email,
        code
      });

      console.log('✅ [VERIFY EMAIL] Verification successful:', response.data);

      if (response.data.success) {
        setSuccess('Email berhasil diverifikasi!');
        
        // ✅ PERBAIKAN: Handle both API response data AND Google OAuth stored data
        const { token, user, requiresProfileCompletion } = response.data;
        
        // ✅ PERBAIKAN: Cek jika ada OAuth data yang tersimpan
        const oauthToken = localStorage.getItem('verificationToken');
        const oauthUserData = localStorage.getItem('verificationUserData');
        
        const finalToken = token || oauthToken;
        let finalUser = user;
        
        // ✅ Jika dari Google OAuth, gunakan data yang disimpan
        if (!finalUser && oauthUserData) {
          try {
            finalUser = JSON.parse(oauthUserData);
            // Update status verifikasi untuk user OAuth
            finalUser.isEmailVerified = true;
            console.log('✅ [VERIFY EMAIL] Using OAuth user data with verified status');
          } catch (e) {
            console.error('❌ [VERIFY EMAIL] Error parsing OAuth user data:', e);
          }
        }

        if (finalToken && finalUser) {
          // ✅ PERBAIKAN: Simpan token dan user data
          localStorage.setItem('token', finalToken);
          localStorage.setItem('user', JSON.stringify(finalUser));
          
          // ✅ PERBAIKAN: Login ke AuthContext untuk konsistensi state
          try {
            await login(finalToken, finalUser);
            console.log('✅ [VERIFY EMAIL] User logged in to AuthContext');
          } catch (loginError) {
            console.error('❌ [VERIFY EMAIL] AuthContext login failed:', loginError);
            // Continue anyway since we have localStorage
          }
          
          // ✅ PERBAIKAN: Clear semua temporary storage
          localStorage.removeItem('userEmail');
          localStorage.removeItem('isNewUser');
          localStorage.removeItem('pendingVerificationEmail');
          localStorage.removeItem('verificationUserData');
          localStorage.removeItem('verificationToken');
          
          console.log('🔍 [VERIFY EMAIL] User data after verification:', {
            user: finalUser,
            requiresProfileCompletion,
            isEmailVerified: finalUser.isEmailVerified,
            isProfileComplete: finalUser.isProfileComplete
          });

          // ✅ PERBAIKAN: Redirect logic yang lebih baik
          setTimeout(() => {
            // Prioritaskan profile completion jika diperlukan
            const needsProfileCompletion = requiresProfileCompletion || 
                                         !finalUser.isProfileComplete || 
                                         !finalUser.fullName ||
                                         finalUser.fullName.trim().length === 0;
            
            console.log('🔍 [VERIFY EMAIL] Redirect decision:', {
              needsProfileCompletion,
              requiresProfileCompletion,
              isProfileComplete: finalUser.isProfileComplete,
              hasFullName: !!finalUser.fullName && finalUser.fullName.trim().length > 0
            });

            if (needsProfileCompletion) {
              console.log('🔍 [VERIFY EMAIL] Profile incomplete - Redirecting to AboutYouPage');
              navigate('/about-you', { 
                state: { 
                  from: 'email-verification',
                  userData: finalUser
                }
              });
            } else {
              console.log('🔍 [VERIFY EMAIL] All complete - Redirecting to landing page');
              navigate('/', { 
                state: { 
                  from: 'email-verification',
                  welcome: true
                }
              });
            }
          }, 1500);
        } else {
          throw new Error('Invalid verification response: missing token or user data');
        }
      } else {
        setError(response.data.message || 'Verifikasi gagal');
      }
    } catch (error) {
      console.error('❌ [VERIFY EMAIL] Verification failed:', error);
      
      let errorMessage = 'Verifikasi gagal. Silakan coba lagi.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
        
        // Clear code on invalid verification
        if (errorMessage.includes('tidak valid') || errorMessage.includes('kadaluarsa')) {
          setVerificationCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      } else if (error.request) {
        errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resend verification code
   */
  const handleResendCode = async () => {
    if (!email) {
      setError('Email tidak ditemukan');
      return;
    }

    if (countdown > 0) {
      setError(`Tunggu ${countdown} detik sebelum mengirim ulang`);
      return;
    }

    setIsResending(true);
    setError('');

    try {
      console.log('🔍 [VERIFY EMAIL] Resending code to:', email);
      
      const response = await api.post('/api/auth/resend-verification', { email });

      if (response.data.success) {
        setSuccess('Kode verifikasi baru telah dikirim ke email Anda');
        setCountdown(60); // 60 seconds cooldown
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setError(response.data.message || 'Gagal mengirim ulang kode');
      }
    } catch (error) {
      console.error('❌ [VERIFY EMAIL] Resend failed:', error);
      
      let errorMessage = 'Gagal mengirim ulang kode. Silakan coba lagi.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.request) {
        errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      }
      
      setError(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  /**
   * ✅ PERBAIKAN: Navigate back dengan handle Google OAuth case
   */
  const handleBackToRegistration = () => {
    // Clear semua temporary storage
    localStorage.removeItem('userEmail');
    localStorage.removeItem('isNewUser');
    localStorage.removeItem('pendingVerificationEmail');
    localStorage.removeItem('verificationUserData');
    localStorage.removeItem('verificationToken');
    
    // Redirect berdasarkan source
    if (location.state?.from === 'oauth-callback') {
      navigate('/login', { 
        state: { 
          message: 'Verifikasi dibatalkan. Silakan coba login kembali.' 
        }
      });
    } else {
      navigate('/login', { 
        state: { showEmailRegistration: true }
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={handleBackToRegistration}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-6"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke Pendaftaran
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Verifikasi Email</h1>
          <p className="text-gray-600 mb-2">
            Masukkan kode verifikasi 6 digit yang dikirim ke
          </p>
          <p className="text-blue-600 font-medium">{email}</p>
          
          {/* ✅ PERBAIKAN: Tampilkan source verification */}
          {location.state?.from === 'oauth-callback' && (
            <p className="text-xs text-green-600 mt-2">
              ✅ Verifikasi untuk akun Google OAuth
            </p>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4" role="alert">
            <span className="block sm:inline">{success}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Verification Code Inputs */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
            Kode Verifikasi
          </label>
          <div className="flex justify-center space-x-2 mb-4">
            {verificationCode.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                maxLength="1"
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                disabled={isLoading}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            ))}
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            Kode akan otomatis terverifikasi ketika semua digit terisi
          </p>
        </div>

        {/* Verify Button */}
        <button
          onClick={handleVerification}
          disabled={isLoading || verificationCode.some(digit => digit === '')}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md mb-4"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Memverifikasi...
            </span>
          ) : (
            'Verifikasi Email'
          )}
        </button>

        {/* Resend Code Section */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            Tidak menerima kode?
          </p>
          <button
            onClick={handleResendCode}
            disabled={isResending || countdown > 0}
            className="text-blue-500 hover:text-blue-600 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {isResending ? (
              <span className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                Mengirim...
              </span>
            ) : countdown > 0 ? (
              `Kirim ulang (${countdown}s)`
            ) : (
              'Kirim ulang kode verifikasi'
            )}
          </button>
        </div>

        {/* Help Information */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">Tips:</h3>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>• Cek folder spam jika tidak menemukan email</li>
            <li>• Kode verifikasi kadaluarsa dalam 10 menit</li>
            <li>• Pastikan email yang dimasukkan sudah benar</li>
            <li>• Hubungi support jika mengalami kendala</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;