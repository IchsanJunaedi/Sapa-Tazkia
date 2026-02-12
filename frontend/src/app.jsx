import React, { useState, useContext, createContext, useEffect } from 'react';
// --- BARU: Impor untuk React Router ---
import {
  BrowserRouter,
  Routes,
  Route,
  useSearchParams,
  useNavigate
} from 'react-router-dom';

// --- BARU: Import ChatPage ---
import ChatPage from './pages/ChatPage'; // Sesuaikan path dengan struktur project Anda

// --- Mock Axios (api) ---
// (Kode Mock API Anda tetap sama, tidak perlu diubah)
const api = {
  defaults: { headers: { common: {} } },
  post: async (url, data) => {
    console.log("MOCK API POST:", url, data);
    await new Promise(resolve => setTimeout(resolve, 500));
    if (url === '/auth/login' && data.nim === '12345' && data.password === 'password') {
      console.log("Mock API: Login sukses");
      return { data: { token: 'mock-token-123', user: { nim: '12345', name: 'Mahasiswa Mock' } } };
    }
    if (url === '/auth/register') {
      console.log("Mock API: Register sukses");
      return { data: { token: 'mock-token-register', user: { nim: data.nim, name: data.nama || 'User Baru' } } };
    }
    console.error("Mock API: Invalid credentials");
    throw new Error("NIM atau Password salah");
  },
  get: async (url) => {
    console.log("MOCK API GET:", url);
    console.log("With Headers:", api.defaults.headers.common);
    await new Promise(resolve => setTimeout(resolve, 500));
    const token = api.defaults.headers.common['Authorization'];

    // --- PERBAIKAN DI MOCK API ---
    // Menambahkan token dari Google Callback agar 'me' berhasil
    const googleToken = 'ini-adalah-mock-token-dari-google';
    if (url === '/auth/me' && (token === 'Bearer mock-token-123' || token === 'Bearer mock-token-register' || token === `Bearer ${googleToken}`)) {
      // --- AKHIR PERBAIKAN ---
      console.log("Mock API: /me sukses");
      return { data: { user: { nim: '241572010024', name: 'Muhammad Ichsan Junaedi' } } };
    }

    console.error("Mock API: Invalid token");
    throw new Error("Invalid token");
  }
};
// --- End Mock Axios (api) ---

// --- AuthContext ---
// (Kode AuthContext, AuthProvider, dan useAuth Anda tetap sama)
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // ✅ BARU: State untuk status autentikasi

  useEffect(() => {
    const checkLoggedInUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await api.get('/auth/me');
          setUser(response.data.user);
          setIsAuthenticated(true); // ✅ BARU: Set authenticated true
        } catch (error) {
          console.error("Token invalid, logging out");
          logout();
        }
      }
      setLoading(false);
    };
    checkLoggedInUser();
  }, []);

  // --- FUNGSI LOGIN (DARI ANDA - SUDAH BENAR) ---
  const login = async (nimOrToken, passwordOrUser) => {
    setLoading(true);
    try {
      let token;
      let userData;

      if (typeof passwordOrUser === 'string') {
        // --- Skenario 1: Login Lokal (NIM & Password) ---
        const response = await api.post('/auth/login', { nim: nimOrToken, password: passwordOrUser });
        token = response.data.token;
        userData = response.data.user;
      } else {
        // --- Skenario 2: Login Google/Callback (Token & User Object) ---
        token = nimOrToken;
        userData = passwordOrUser; // Ini adalah objek user dari URL

        // Jika backend HANYA kirim token, kita perlu panggil /me
        if (!userData) {
          // Set token dulu agar 'me' berhasil
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await api.get('/auth/me');
          userData = response.data.user;
        }
      }

      // --- Logika Umum untuk KEDUA Skenario ---
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
      setIsAuthenticated(true); // ✅ BARU: Set authenticated true

      return true; // Sukses

    } catch (error) {
      console.error("Login failed:", error.response?.data?.message || error.message);
      logout();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    // (Fungsi register Anda)
    try {
      const response = await api.post('/auth/register', userData);
      const token = response.data.token;
      const userDataFromResponse = response.data.user;

      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userDataFromResponse);
      setIsAuthenticated(true);

      return true;
    } catch (error) {
      console.error("Register failed:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false); // ✅ BARU: Set authenticated false
    delete api.defaults.headers.common['Authorization'];
    window.location.href = '/';
  };

  const value = {
    user,
    loading,
    isAuthenticated, // ✅ BARU: Export isAuthenticated
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <p>Loading user...</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
// --- AKHIR DARI AuthContext ---

// --- GoogleIcon Component ---
const GoogleIcon = () => (
  <svg className="w-5 h-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-62.2 62.2C338.5 109.4 300.9 96 248 96c-106.1 0-192 85.9-192 192s85.9 192 192 192c100.9 0 181.1-73.6 188.7-169.1H248v-81.6h239.2c2.7 13.2 4.8 27.2 4.8 42.6z"></path>
  </svg>
);
// --- End GoogleIcon Component ---

// --- BARU: AuthCallback Component ---
const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    // --- LOGIKA UNTUK MOCK API ---
    const mockToken = 'ini-adalah-mock-token-dari-google';
    const mockUser = { nim: '241572010024', name: 'Muhammad Ichsan Junaedi' };

    const processLogin = async () => {
      const finalToken = token || mockToken;
      const finalUserString = userParam || JSON.stringify(mockUser);

      if (finalToken) {
        try {
          const userObject = JSON.parse(decodeURIComponent(finalUserString));
          await login(finalToken, userObject);
          navigate('/chat'); // ✅ PERBAIKAN: Arahkan ke /chat setelah login sukses
        } catch (err) {
          console.error("Gagal memproses callback:", err);
          setError("Login Google gagal. Mencoba mengurai data user.");
          setTimeout(() => navigate('/'), 3000);
        }
      } else {
        setError("Token tidak ditemukan di callback URL.");
        setTimeout(() => navigate('/'), 3000);
      }
    };

    processLogin();
  }, [login, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <p>Memproses login Anda...</p>
      )}
    </div>
  );
};
// --- AKHIR DARI AuthCallback Component ---

// --- LoginPage Component ---
const LoginPage = () => {
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login, user, logout } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(nim, password);
      // ✅ PERBAIKAN: Setelah login sukses, redirect ke /chat
      window.location.href = '/chat';
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan. Coba lagi nanti.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setError(null);
    console.log("Mengarahkan ke Google Login...");
    window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/auth/google`;
  };

  // Tampilan "Sudah Login" (DIPERBAIKI)
  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-purple-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Anda Sudah Login</h1>
          <p className="text-gray-700 mb-6">Selamat datang, {user.name || user.nim}!</p>
          <button
            onClick={() => window.location.href = '/chat'} // ✅ PERBAIKAN: Tombol ke Chat
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors mb-3"
          >
            Lanjut ke Chat
          </button>
          <button
            onClick={() => logout()}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    )
  }

  // Tampilan Form Login
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-purple-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">Login Mahasiswa</h1>
        <p className="text-gray-600 text-center mb-8">Sapa Tazkia Chatbot</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">NIM</label>
            <input
              type="text"
              placeholder="Masukkan NIM Anda (Coba: 12345)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
              value={nim}
              onChange={(e) => setNim(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              placeholder="Masukkan Password (Coba: password)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-medium transition-colors disabled:bg-gray-400"
            disabled={isLoading}
          >
            {isLoading ? 'Memproses...' : 'Login'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300"></span>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500">ATAU</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <GoogleIcon />
          <span className="ml-3 font-medium">Lanjutkan dengan Google</span>
        </button>

        {/* ✅ PERBAIKAN: Tombol Guest Mode */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300"></span>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500">ATAU</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => window.location.href = '/chat?guest=true'} // ✅ TAMBAHAN: Guest mode
          className="w-full flex items-center justify-center px-4 py-3 border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <span className="font-medium">Coba sebagai Tamu</span>
        </button>

        <p className="text-center text-sm text-gray-600 mt-6">
          Belum punya akun?
          <a href="#register" className="text-orange-500 hover:underline ml-1" onClick={(e) => { e.preventDefault(); alert('Mengarahkan ke halaman Daftar...'); }}>
            Daftar
          </a>
        </p>
      </div>
    </div>
  );
};
// --- End LoginPage Component ---

// --- Main App Component (DIPERBARUI TOTAL) ---
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rute Utama (/) akan menampilkan LoginPage */}
          <Route path="/" element={<LoginPage />} />

          {/* Rute ChatPage */}
          <Route path="/chat" element={<ChatPage />} />

          {/* Rute Auth Callback */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* ✅ TAMBAHKAN: Fallback route untuk handle undefined paths */}
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}