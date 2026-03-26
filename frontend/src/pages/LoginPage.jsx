import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';
import Swal from 'sweetalert2';

// ─── GoogleIcon ───────────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6 mr-3">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.343c-1.896,3.101-5.466,6.17-11.343,6.17 c-6.958,0-12.632-5.673-12.632-12.632c0-6.958,5.674-12.632,12.632-12.632c3.23,0,6.347,1.385,8.441,3.483l5.882-5.882 C34.004,5.946,29.351,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20 C44,22.659,43.834,21.32,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.309,16.713L11.822,20.3C13.298,16.59,17.207,14,21.723,14 c3.41,0,6.619,1.218,8.875,3.447l5.845-5.844C34.004,5.946,29.351,4,24,4C16.326,4,9.66,8.275,6.309,14.713z" />
    <path fill="#4CAF50" d="M24,44c5.205,0,10.222-1.92,13.911-5.385l-6.736-6.495C30.297,33.024,27.265,34.08,24,34.08 c-5.877,0-9.448-3.07-11.344-6.171L6.309,33.287C9.66,39.725,16.326,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083L42,20h-0.29c-0.122-0.638-0.344-1.254-0.627-1.851 C41.347,17.385,38.23,16,35,16c-3.265,0-6.297,1.056-8.214,3.003L35.343,28h7.957 C42.834,26.68,44,25.045,44,24C44,22.659,43.834,21.32,43.611,20.083z" />
  </svg>
);

// ─── VerificationForm ─────────────────────────────────────────────────────────

const VerificationForm = ({ email, onVerify, onResend, onBack, isLoading, error }) => {
  const [code, setCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (code.trim().length >= 4) onVerify(code.trim());
  };

  const handleResend = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
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

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-[0.15em] text-indigo-400 uppercase mb-2">Verifikasi</p>
        <h2 className="text-[26px] font-black text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
          Cek email kamu
        </h2>
        <p className="text-sm text-white/40 mt-2 leading-relaxed">
          Kode dikirim ke <span className="text-white/70 font-medium">{email}</span>
        </p>
      </div>

      {resendSuccess && (
        <div className="px-4 py-3 rounded-xl mb-4 text-sm text-green-300 flex items-center gap-2"
          style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <span>✓</span> Kode verifikasi telah dikirim ulang!
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl mb-4 text-sm text-red-300"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}

      <div className="mb-5">
        <input
          type="text"
          placeholder="Masukkan kode 6 digit"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="auth-input w-full px-4 py-[14px] text-white rounded-xl text-[15px] transition-all duration-200 focus:outline-none text-center tracking-[0.3em] font-semibold"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          disabled={isLoading}
          maxLength={6}
        />
        <p className="text-[11px] text-white/25 mt-2 text-center">Berlaku selama 10 menit</p>
      </div>

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

// ─── LoginPage ────────────────────────────────────────────────────────────────

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState(0);
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
    clearPendingVerification,
    isAuthenticated,
    loading: authLoading,
    user,
  } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      if (user?.userType === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/chat', { replace: true });
      }
    }
  }, [isAuthenticated, authLoading, navigate, user]);

  // If pending verification exists, jump to step 1
  useEffect(() => {
    if (pendingVerification && pendingEmail) {
      setStep(1);
      setEmail(pendingEmail);
    }
  }, [pendingVerification, pendingEmail]);

  // Propagate location state error
  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleContinue = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!email) { setError('Email atau NIM harus diisi'); return; }

    setIsLoading(true);
    setError('');
    setShowSuccess(false);

    try {
      const isEmail = email.includes('@');

      if (isEmail) {
        const validDomains = [
          '@student.tazkia.ac.id',
          '@student.stmik.tazkia.ac.id',
          '@tazkia.ac.id',
        ];
        const isValidDomain = validDomains.some(d => email.toLowerCase().includes(d));
        if (!isValidDomain) {
          throw new Error('Silakan gunakan email Tazkia (@student.tazkia.ac.id, @student.stmik.tazkia.ac.id, atau @tazkia.ac.id)');
        }

        const result = await registerWithEmail(email);
        if (result.requiresVerification) {
          setStep(1);
        } else {
          setShowSuccess(true);
          setTimeout(() => navigate('/chat', { replace: true }), 1500);
        }
      } else {
        await loginWithCredentials(email, email);
        setShowSuccess(true);
        setTimeout(() => navigate('/chat', { replace: true }), 1500);
      }
    } catch (err) {
      const msg = err.message || 'Terjadi kesalahan saat autentikasi';
      setError(msg);

      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('sudah terdaftar')) {
        Swal.fire({
          title: 'Email Sudah Terdaftar!',
          text: 'Sepertinya kamu sudah pernah mendaftar dengan email ini.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#111827',
          cancelButtonColor: '#d33',
          confirmButtonText: 'Login Saja',
          cancelButtonText: 'Gunakan Email Lain',
          background: '#fff',
          customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl px-4 py-2', cancelButton: 'rounded-xl px-4 py-2' },
        }).then((result) => {
          if (result.isConfirmed) { setError(''); }
          else { setEmail(''); setError(''); }
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
      const result = await verifyEmailCode(email, code);
      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => navigate('/chat', { replace: true }), 1500);
      } else {
        throw new Error(result.error || 'Verifikasi gagal');
      }
    } catch (err) {
      setError(err.message || 'Kode verifikasi salah atau telah kedaluwarsa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    const result = await resendVerificationCode(email);
    if (!result.success) throw new Error(result.error || 'Gagal mengirim ulang kode');
    return result;
  };

  const handleBackToEmail = () => {
    setStep(0);
    setError('');
    clearPendingVerification();
  };

  const handleGoogleLogin = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setIsLoading(true);
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    window.location.href = `${API_URL}/auth/google`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderContent = () => {
    if (step === 1) {
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
    }

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
            className="auth-input w-full px-4 py-[14px] text-white rounded-xl text-[15px] transition-all duration-200 focus:outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            disabled={isLoading}
          />
          <p className="text-[11px] text-white/25 mt-2 leading-relaxed">
            Gunakan email kampus Tazkia atau NIM Anda
          </p>
        </div>

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

        <button
          type="button"
          onClick={handleBack}
          disabled={isLoading}
          className="w-full mt-4 text-[13px] text-white/25 hover:text-white/50 transition-colors py-1"
        >
          Kembali
        </button>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div
        className="auth-modal-card w-full relative overflow-hidden"
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

        {/* Close / back button */}
        <button
          type="button"
          onClick={handleBack}
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

        {/* Footer brand */}
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
        .auth-input::placeholder { color: rgba(255,255,255,0.28); }
        .auth-input:focus {
          border-color: rgba(99,102,241,0.6) !important;
          background: rgba(255,255,255,0.09) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
        }
        .auth-input:disabled { opacity: 0.4; }
      `}</style>
    </div>
  );
};

export default LoginPage;
