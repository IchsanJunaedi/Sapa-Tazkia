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

  // Ambil fungsi login dari AuthContext
  const { loginWithCredentials, isAuthenticated } = useAuth();

  // Redirect jika sudah login
  useEffect(() => {
    console.log('🔍 [LOGIN PAGE] Auth status:', isAuthenticated);
    if (isAuthenticated) {
      console.log('✅ [LOGIN PAGE] User already authenticated, redirecting to chat');
      navigate('/chat', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Check untuk error message dari location state
  useEffect(() => {
    if (location.state?.error) {
      setError(location.state.error);
      // Clear location state setelah menampilkan error
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  /**
   * Fungsi untuk menangani login via NIM/Password
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasi input
    if (!nim.trim() || !password.trim()) {
      setError('NIM dan Password harus diisi');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔍 [LOGIN PAGE] Attempting login with NIM:', nim);
      
      await loginWithCredentials(nim, password);
      
      console.log('✅ [LOGIN PAGE] Login successful, redirecting...');
      
      // Redirect akan ditangani oleh useEffect di atas
      // atau oleh AuthContext setelah login berhasil
      
    } catch (err) {
      console.error('❌ [LOGIN PAGE] Login failed:', err);
      setError(err.response?.data?.message || err.message || 'Login gagal. Periksa kembali NIM dan Password Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fungsi untuk menangani login via Google
   */
  const handleGoogleLogin = () => {
    setError('');
    setIsLoading(true);
    
    console.log('🔍 [LOGIN PAGE] Redirecting to Google OAuth...');
    
    // Redirect ke backend Google OAuth endpoint
    // Backend akan handle redirect ke Google dan kemudian kembali ke /auth/callback
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    window.location.href = `${apiUrl}/api/auth/google`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-purple-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">Login Mahasiswa</h1>
        <p className="text-gray-600 text-center mb-8">Sapa Tazkia Chatbot</p>

        {/* Menampilkan pesan error */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Form dengan handler dan state */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">NIM</label>
            <input
              type="text"
              placeholder="Masukkan NIM Anda"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none transition-colors"
              value={nim}
              onChange={(e) => setNim(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              placeholder="Masukkan Password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Memproses...' : 'Login'}
          </button>
        </form>

        {/* Separator */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300"></span>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500">ATAU</span>
          </div>
        </div>

        {/* Google Login Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          <span className="ml-3 font-medium">
            {isLoading ? 'Mengarahkan...' : 'Lanjutkan dengan Google'}
          </span>
        </button>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Belum punya akun?{' '}
          <button 
            onClick={() => navigate('/register')}
            className="text-orange-500 hover:underline font-medium"
          >
            Daftar
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;