import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
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

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  useEffect(() => {
    const locationEmail = location.state?.email;
    const storedEmail = localStorage.getItem('userEmail');
    const pendingEmail = localStorage.getItem('pendingVerificationEmail');
    const oauthUserData = location.state?.userData;

    let finalEmail = '';
    let finalUserData = null;

    if (locationEmail) {
      finalEmail = locationEmail;
    } else if (pendingEmail) {
      finalEmail = pendingEmail;
    } else if (storedEmail) {
      finalEmail = storedEmail;
    } else if (oauthUserData?.email) {
      finalEmail = oauthUserData.email;
      finalUserData = oauthUserData;
    } else {
      navigate('/login', {
        state: { error: 'Sesi verifikasi telah berakhir. Silakan daftar ulang.' }
      });
      return;
    }

    setEmail(finalEmail);

    if (finalUserData) {
      localStorage.setItem('verificationUserData', JSON.stringify(finalUserData));
    }
  }, [location, navigate]);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleInputChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every(digit => digit !== '') && index === 5) {
      handleVerification(newCode);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const numbers = pastedData.replace(/\D/g, '').slice(0, 6).split('');

    if (numbers.length === 6) {
      setVerificationCode(numbers);
      setError('');
      inputRefs.current[5]?.focus();
      // Trigger verification after paste
      setTimeout(() => handleVerification(numbers), 50);
    }
  };

  const handleVerification = async (codeArr) => {
    const code = (codeArr || verificationCode).join('');

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
      const response = await api.post('/auth/verify-email', { email, code });

      if (response.data.success) {
        setSuccess('Email berhasil diverifikasi!');

        const { token, user, requiresProfileCompletion } = response.data;

        const oauthToken = localStorage.getItem('verificationToken');
        const oauthUserDataRaw = localStorage.getItem('verificationUserData');

        const finalToken = token || oauthToken;
        let finalUser = user;

        if (!finalUser && oauthUserDataRaw) {
          try {
            finalUser = JSON.parse(oauthUserDataRaw);
            finalUser.isEmailVerified = true;
          } catch (e) {
            console.error('Error parsing OAuth user data:', e);
          }
        }

        if (finalToken && finalUser) {
          localStorage.setItem('token', finalToken);
          localStorage.setItem('user', JSON.stringify(finalUser));

          try {
            await login(finalToken, finalUser);
          } catch (loginError) {
            console.error('AuthContext login failed:', loginError);
          }

          localStorage.removeItem('userEmail');
          localStorage.removeItem('isNewUser');
          localStorage.removeItem('pendingVerificationEmail');
          localStorage.removeItem('verificationUserData');
          localStorage.removeItem('verificationToken');

          setTimeout(() => {
            const needsProfileCompletion = requiresProfileCompletion ||
              !finalUser.isProfileComplete ||
              !finalUser.fullName ||
              finalUser.fullName.trim().length === 0;

            if (needsProfileCompletion) {
              navigate('/about-you', { state: { from: 'email-verification', userData: finalUser } });
            } else {
              navigate('/', { state: { from: 'email-verification', welcome: true } });
            }
          }, 1500);
        } else {
          throw new Error('Response tidak valid: token atau data pengguna hilang');
        }
      } else {
        setError(response.data.message || 'Verifikasi gagal');
      }
    } catch (err) {
      let errorMessage = 'Verifikasi gagal. Silakan coba lagi.';

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
        if (errorMessage.includes('tidak valid') || errorMessage.includes('kadaluarsa')) {
          setVerificationCode(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      } else if (err.request) {
        errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) { setError('Email tidak ditemukan'); return; }
    if (countdown > 0) return;

    setIsResending(true);
    setError('');

    try {
      const response = await api.post('/auth/resend-verification', { email });

      if (response.data.success) {
        setSuccess('Kode verifikasi baru telah dikirim!');
        setCountdown(60);
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(response.data.message || 'Gagal mengirim ulang kode');
      }
    } catch (err) {
      let errorMessage = 'Gagal mengirim ulang kode. Silakan coba lagi.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.request) {
        errorMessage = 'Tidak dapat terhubung ke server.';
      }
      setError(errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  const handleBack = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('isNewUser');
    localStorage.removeItem('pendingVerificationEmail');
    localStorage.removeItem('verificationUserData');
    localStorage.removeItem('verificationToken');

    if (location.state?.from === 'oauth-callback') {
      navigate('/login', { state: { message: 'Verifikasi dibatalkan. Silakan coba login kembali.' } });
    } else {
      navigate('/login', { state: { showEmailRegistration: true } });
    }
  };

  const isComplete = verificationCode.every(d => d !== '');

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="verify-card w-full relative overflow-hidden"
        style={{
          maxWidth: '400px',
          background: 'rgba(10, 18, 70, 0.65)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.06)',
        }}
      >
        {/* Top accent stripe */}
        <div className="h-[3px] w-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-400" />

        {/* Close button */}
        <button
          type="button"
          onClick={handleBack}
          className="absolute top-5 right-5 p-1.5 rounded-full transition-all duration-200 text-white/30 hover:text-white/70"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <X size={16} />
        </button>

        <div className="px-8 py-7">
          {/* Header */}
          <div className="mb-7">
            <p className="text-xs font-semibold tracking-[0.15em] text-indigo-400 uppercase mb-2">Verifikasi Email</p>
            <h2 className="text-[26px] font-black text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
              Cek email kamu
            </h2>
            <p className="text-[13px] text-white/40 mt-2 leading-relaxed">
              Kode 6 digit dikirim ke{' '}
              <span className="text-white/70 font-medium">{email}</span>
            </p>
          </div>

          {/* Success */}
          {success && (
            <div
              className="px-4 py-3 rounded-xl mb-5 text-sm text-green-300 flex items-center gap-2"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
            >
              <span>✓</span> {success}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="px-4 py-3 rounded-xl mb-5 text-sm text-red-300 relative"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              {error}
              <button
                type="button"
                onClick={() => setError('')}
                className="absolute top-2.5 right-2.5 text-red-400/60 hover:text-red-300 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* OTP Inputs */}
          <div className="mb-6">
            <div className="flex justify-center gap-2.5 mb-3">
              {verificationCode.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={isLoading}
                  className="otp-input w-11 h-12 text-center text-lg font-bold text-white rounded-xl transition-all duration-200 focus:outline-none"
                  style={{
                    background: digit ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.06)',
                    border: digit
                      ? '1px solid rgba(99,102,241,0.6)'
                      : '1px solid rgba(255,255,255,0.1)',
                  }}
                />
              ))}
            </div>
            <p className="text-[11px] text-white/25 text-center">
              Berlaku selama 10 menit · terisi otomatis saat lengkap
            </p>
          </div>

          {/* Verify Button */}
          <button
            type="button"
            onClick={() => handleVerification()}
            disabled={isLoading || !isComplete}
            className={`w-full py-[14px] rounded-xl font-semibold text-white text-[15px] transition-all duration-300 ${
              isComplete && !isLoading
                ? 'bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30 hover:from-indigo-400 hover:to-blue-500 hover:scale-[1.02] active:scale-[0.99]'
                : 'cursor-not-allowed'
            }`}
            style={!isComplete || isLoading ? { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.25)' } : {}}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Memverifikasi...
              </span>
            ) : (
              'Verifikasi Email'
            )}
          </button>

          {/* Resend */}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={isResending || countdown > 0}
              className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-all duration-200 text-indigo-400 hover:text-indigo-300 disabled:text-white/20"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              {isResending ? 'Mengirim...' : countdown > 0 ? `Kirim ulang (${countdown}s)` : 'Kirim Ulang'}
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-2.5 text-sm rounded-xl font-medium transition-all duration-200 text-white/35 hover:text-white/60"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Kembali
            </button>
          </div>

          {/* Tips */}
          <div
            className="mt-5 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p className="text-[11px] text-white/25 leading-relaxed">
              Tidak menerima email? Cek folder <span className="text-white/40">spam</span> atau klik kirim ulang setelah 60 detik.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 pt-0">
          <p className="text-[11px] text-white/15 text-center tracking-wide">
            STMIK TAZKIA · Sapa AI © 2025
          </p>
        </div>
      </div>

      <style>{`
        .verify-card {
          animation: cardIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        .otp-input::placeholder { color: rgba(255,255,255,0.15); }
        .otp-input:focus {
          border-color: rgba(99,102,241,0.7) !important;
          background: rgba(99,102,241,0.15) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .otp-input:disabled { opacity: 0.4; }
      `}</style>
    </div>
  );
};

export default VerifyEmailPage;
