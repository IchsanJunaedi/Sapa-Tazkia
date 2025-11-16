import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axiosConfig';

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

  // Initialize input refs
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  // Get email from location state or localStorage
  useEffect(() => {
    const locationEmail = location.state?.email;
    const storedEmail = localStorage.getItem('userEmail');
    
    if (locationEmail) {
      setEmail(locationEmail);
      console.log('🔍 [VERIFY EMAIL] Email from location state:', locationEmail);
    } else if (storedEmail) {
      setEmail(storedEmail);
      console.log('🔍 [VERIFY EMAIL] Email from localStorage:', storedEmail);
    } else {
      console.log('❌ [VERIFY EMAIL] No email found, redirecting to login');
      navigate('/login', { 
        state: { error: 'Sesi verifikasi telah berakhir. Silakan daftar ulang.' }
      });
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
   * Verify the email with the code
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
        
        // Save token and user data
        const { token, user, requiresProfileCompletion } = response.data;
        
        if (token && user) {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          
          // Clear temporary storage
          localStorage.removeItem('userEmail');
          localStorage.removeItem('isNewUser');
          
          console.log('🔍 [VERIFY EMAIL] User data after verification:', {
            user,
            requiresProfileCompletion
          });

          // Redirect based on profile completion status
          setTimeout(() => {
            if (requiresProfileCompletion || !user.isProfileComplete) {
              console.log('🔍 [VERIFY EMAIL] Redirecting to AboutYouPage');
              navigate('/about-you', { 
                state: { 
                  from: 'email-verification',
                  userData: user
                }
              });
            } else {
              console.log('🔍 [VERIFY EMAIL] Redirecting to chat');
              navigate('/chat', { 
                state: { 
                  from: 'email-verification',
                  welcome: true
                }
              });
            }
          }, 1500);
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
   * Navigate back to registration
   */
  const handleBackToRegistration = () => {
    localStorage.removeItem('userEmail');
    navigate('/login', { 
      state: { showEmailRegistration: true }
    });
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