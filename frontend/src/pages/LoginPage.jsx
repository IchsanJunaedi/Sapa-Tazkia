import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// GoogleIcon Component
const GoogleIcon = () => (
  <svg className="w-5 h-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-62.2 62.2C338.5 109.4 300.9 96 248 96c-106.1 0-192 85.9-192 192s85.9 192 192 192c100.9 0 181.1-73.6 188.7-169.1H248v-81.6h239.2c2.7 13.2 4.8 27.2 4.8 42.6z"></path>
  </svg>
);

const LoginPage = () => {
  // State untuk form
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Hooks untuk navigation dan location
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ FIXED: Ambil fungsi login yang benar dari AuthContext
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  // ✅ FIXED: Redirect jika sudah login - dengan pengecekan yang lebih baik
  useEffect(() => {
    console.log('🔍 [LOGIN PAGE] Auth status:', { 
      isAuthenticated, 
      authLoading,
      path: location.pathname 
    });
    
    if (isAuthenticated && !authLoading) {
      console.log('✅ [LOGIN PAGE] User already authenticated, redirecting to chat');
      
      // ✅ FIXED: Gunakan replace: true dan state yang jelas
      navigate('/chat', { 
        replace: true,
        state: { 
          from: 'login',
          isGuest: false 
        }
      });
    }
  }, [isAuthenticated, authLoading, navigate, location]);

  // ✅ FIXED: Check untuk error message dari location state
  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
      console.log('⚠️ [LOGIN PAGE] Error from location state:', location.state.error);
      
      // Clear location state setelah menampilkan error
      window.history.replaceState({}, document.title);
    }
    
    // ✅ FIXED: Check untuk success message (misalnya dari register)
    if (location.state?.success) {
      console.log('✅ [LOGIN PAGE] Success message from location:', location.state.success);
      // Bisa tambahkan toast atau pesan sukses di sini jika needed
    }
  }, [location.state]);

  /**
   * ✅ FIXED: Fungsi untuk menangani login via NIM/Password
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasi input
    if (!nim.trim() || !password.trim()) {
      setError('NIM dan Password harus diisi');
      return;
    }

    // Validasi format NIM (opsional)
    if (nim.trim().length < 5) {
      setError('NIM harus minimal 5 karakter');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔍 [LOGIN PAGE] Attempting login with NIM:', nim);
      
      // ✅ FIXED: Gunakan fungsi login yang benar dari context
      await login(nim, password);
      
      console.log('✅ [LOGIN PAGE] Login successful, redirect should happen automatically');
      
      // ✅ FIXED: Redirect sudah ditangani oleh useEffect di atas
      // Tidak perlu navigate manual di sini
      
    } catch (err) {
      console.error('❌ [LOGIN PAGE] Login failed:', err);
      
      // ✅ FIXED: Error handling yang lebih detail
      let errorMessage = 'Login gagal. Periksa kembali NIM dan Password Anda.';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.code === 'NETWORK_ERROR') {
        errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ✅ FIXED: Fungsi untuk menangani login via Google
   */
  const handleGoogleLogin = () => {
    setError('');
    setIsLoading(true);
    
    console.log('🔍 [LOGIN PAGE] Redirecting to Google OAuth...');
    
    try {
      // Redirect ke backend Google OAuth endpoint
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const redirectUrl = `${apiUrl}/api/auth/google`;
      
      console.log('📍 [LOGIN PAGE] Redirect URL:', redirectUrl);
      window.location.href = redirectUrl;
      
    } catch (err) {
      console.error('❌ [LOGIN PAGE] Google login redirect failed:', err);
      setError('Gagal mengarahkan ke Google Login. Silakan coba lagi.');
      setIsLoading(false);
    }
  };

  /**
   * ✅ FIXED: Fungsi untuk navigasi ke guest mode
   */
  const handleGuestMode = () => {
    console.log('👤 [LOGIN PAGE] Redirecting to guest mode');
    navigate('/chat', { 
      state: { 
        isGuest: true,
        from: 'login-page' 
      }
    });
  };

  // ✅ FIXED: Tampilkan loading spinner selama auth check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-purple-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Memeriksa status login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-purple-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-2">
          <h1 className="text-3xl font-bold text-gray-800">Login Mahasiswa</h1>
          <p className="text-gray-600 mt-2">Sapa Tazkia Chatbot</p>
        </div>

        {/* ✅ FIXED: Guest mode option */}
        <div className="mb-6">
          <button
            onClick={handleGuestMode}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-colors shadow-md mb-2"
          >
            Coba Sebagai Tamu
          </button>
          <p className="text-xs text-gray-500 text-center">
            Coba fitur chat tanpa login
          </p>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300"></span>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500">ATAU</span>
          </div>
        </div>

        {/* Menampilkan pesan error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Form dengan handler dan state */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              NIM
            </label>
            <input
              type="text"
              placeholder="Masukkan NIM Anda"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition-colors"
              value={nim}
              onChange={(e) => setNim(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              placeholder="Masukkan Password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md"
            disabled={isLoading || !nim.trim() || !password.trim()}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Memproses...
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300"></span>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500">ATAU LOGIN DENGAN</span>
          </div>
        </div>

        {/* Google Login Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm"
        >
          <GoogleIcon />
          <span className="ml-3 font-medium">
            {isLoading ? 'Mengarahkan...' : 'Google'}
          </span>
        </button>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Belum punya akun?{' '}
            <button 
              onClick={() => navigate('/register')}
              className="text-orange-500 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 rounded"
              disabled={isLoading}
            >
              Daftar
            </button>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Lupa password? Hubungi administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;