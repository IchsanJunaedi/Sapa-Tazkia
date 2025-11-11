import React, { useState, useContext, createContext, useEffect } from 'react';

// --- Mock Axios (api) ---
// Di aplikasi nyata, ini akan ada di file terpisah (mis: api/axiosConfig.js)
// Kita buat tiruan 'api' agar AuthProvider baru Anda bisa berjalan.
// PERHATIAN: Mock API ini hanya akan berhasil jika 
// NIM = '12345' dan Password = 'password'
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
    // Mensimulasikan kegagalan
    console.error("Mock API: Invalid credentials");
    throw new Error("NIM atau Password salah");
  },
  
  get: async (url) => {
    console.log("MOCK API GET:", url);
    console.log("With Headers:", api.defaults.headers.common);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const token = api.defaults.headers.common['Authorization'];
    
    if (url === '/auth/me' && (token === 'Bearer mock-token-123' || token === 'Bearer mock-token-register' || token === 'Bearer ini-adalah-jwt-token-dari-backend')) {
      console.log("Mock API: /me sukses");
      return { data: { user: { nim: '12345', name: 'Mahasiswa Mock' } } };
    }
    
    // Mensimulasikan token tidak valid
    console.error("Mock API: Invalid token");
    throw new Error("Invalid token");
  }
};
// --- End Mock Axios (api) ---


// --- INI KODE ANDA (AuthContext) ---
// Saya pindahkan ke sini, menggantikan mock yang lama.
// Saya hapus 'export' agar bisa digunakan di file yang sama.

// 1. Buat Context
const AuthContext = createContext(null);

// 2. Buat Provider (Pembungkus)
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Mulai dengan loading

  // Cek apakah ada token di localStorage saat aplikasi pertama kali dimuat
  useEffect(() => {
    const checkLoggedInUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Set header default axios SEBELUM membuat panggilan API
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          // Sekarang panggilan ini akan berhasil (menggunakan mock api)
          const response = await api.get('/auth/me'); 
          setUser(response.data.user);
        } catch (error) {
          // Token tidak valid/expire
          console.error("Token invalid, logging out");
          // Panggil fungsi logout yang sudah diperbaiki
          logout(); 
        }
      }
      setLoading(false);
    };

    checkLoggedInUser();
  }, []); // Dependency array [] sudah benar


  // --- FUNGSI LOGIN (DIPERBARUI TOTAL - DARI ANDA) ---
  const login = async (nimOrToken, password) => {
    setLoading(true);
    try {
      let token;
      let userData;

      if (password) {
        // --- Skenario 1: Login Lokal (NIM & Password) ---
        // Dipanggil dari LoginPage.jsx
        // PERHATIAN: Ini memanggil MOCK API di atas.
        // Ganti 'api' dengan 'api' asli Anda saat siap.
        const response = await api.post('/auth/login', { nim: nimOrToken, password });
        
        token = response.data.token;
        userData = response.data.user;

      } else {
        // --- Skenario 2: Login Google (Hanya Token) ---
        // Dipanggil dari AuthCallback.jsx
        token = nimOrToken;

        // Set token dulu agar 'me' berhasil
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Ambil data user secara manual
        const response = await api.get('/auth/me');
        userData = response.data.user;
      }

      // --- Logika Umum untuk KEDUA Skenario ---
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);

      return true; // Sukses (untuk LoginPage)

    } catch (error) {
      console.error("Login failed:", error.response?.data?.message || error.message);
      logout(); // Pastikan bersih-bersih jika gagal
      throw error; // Lempar error agar bisa ditangkap di LoginPage
    } finally {
      setLoading(false);
    }
  };
  // --- AKHIR FUNGSI LOGIN BARU ---

  // FUNGSI REGISTER (Tetap sama, sudah benar - DARI ANDA)
  const register = async (userData) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', userData);
      // Auto-login setelah register
      localStorage.setItem('token', response.data.token);
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      setUser(response.data.user);
    } catch (error) {
      console.error("Registration failed:", error.response?.data?.message || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // --- FUNGSI LOGOUT (DIPERBARUI - DARI ANDA) ---
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    // Hapus juga default header axios
    delete api.defaults.headers.common['Authorization'];
  };

  // 3. Sediakan value ke children
  const value = {
    user,
    loading,
    login,
    register,
    logout, // Tambahkan logout ke context value
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

// 4. Buat Hook kustom (useAuth - DARI ANDA)
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
// --- AKHIR DARI KODE ANDA ---


// --- GoogleIcon Component ---
const GoogleIcon = () => (
  <svg className="w-5 h-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-62.2 62.2C338.5 109.4 300.9 96 248 96c-106.1 0-192 85.9-192 192s85.9 192 192 192c100.9 0 181.1-73.6 188.7-169.1H248v-81.6h239.2c2.7 13.2 4.8 27.2 4.8 42.6z"></path>
  </svg>
);
// --- End GoogleIcon Component ---


// --- LoginPage Component ---
// Komponen ini sekarang menggunakan AuthContext Anda yang baru!
const LoginPage = () => {
  // State untuk form
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');

  // State untuk error dan loading
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Ambil fungsi login dari context (sekarang ini adalah fungsi login 'asli')
  const { login, user, logout } = useContext(AuthContext); // Ambil logout

  /**
   * Fungsi untuk menangani login via NIM/Password
   */
  const handleSubmit = async (e) => {
    e.preventDefault(); // Mencegah refresh halaman
    setIsLoading(true);
    setError(null);

    try {
      // Panggil fungsi login dari context Anda.
      const success = await login(nim, password); // 'login' ini dari AuthProvider baru

      if (success) {
        // Dihapus: alert('Login Berhasil!...') 
        // Karena komponen akan otomatis re-render ke tampilan "Anda Sudah Login"
        setError(null);
      } 
    } catch (err) {
      // Ini akan menangkap error yang dilempar oleh fungsi login Anda
      setError(err.message || 'Terjadi kesalahan. Coba lagi nanti.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fungsi untuk menangani login via Google
   * PERBAIKAN: Mengaktifkan fungsionalitas asli
   */
  const handleGoogleLogin = () => {
    setError(null);
    setIsLoading(true);
    
    console.log("Mengarahkan ke Google Login...");
    
    // PERBAIKAN: Ini adalah kode aslinya.
    // Ini akan mengarahkan browser ke backend Anda
    window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/auth/google`;

    // Hapus simulasi
    // alert('Mengarahkan ke Google Login...\n(window.location.href = "http://localhost:5000/api/auth/google")');
    // setTimeout(() => {
    //     setIsLoading(false);
    //     setError("Redirect Google disimulasikan. Kembali ke halaman login.");
    // }, 1500);
  };

  // --- BARU: Jika user sudah login, tampilkan pesan ---
  if (user) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-purple-50 flex items-center justify-center p-6 font-sans">
             <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
                <h1 className="text-2xl font-bold mb-4">Anda Sudah Login</h1>
                <p className="text-gray-700 mb-6">Selamat datang, {user.name || user.nim}!</p>
                {/* PERBAIKAN: Menambahkan tombol logout */}
                <button
                    onClick={() => logout()} // Panggil fungsi logout dari context
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
                >
                    Logout
                </button>
             </div>
        </div>
    )
  }
  // --- AKHIR BLOK BARU ---


  // Jika user belum login, tampilkan halaman login
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-purple-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">Login Mahasiswa</h1>
        <p className="text-gray-600 text-center mb-8">Sapa Tazkia Chatbot</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
            {/* INI ADALAH PERBAIKANNYA */}
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">NIM</label>
            <input
              type="text"
              placeholder="Masukkan NIM Anda"
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
              placeholder="Masukkan Password"
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


// --- Main App Component ---
// This is the default export that wraps everything together.
export default function App() {
  return (
    // Sekarang App ini dibungkus oleh AuthProvider 'asli' Anda
    <AuthProvider>
      <LoginPage />
      {/* Di aplikasi nyata, di sinilah Anda akan meletakkan 
        sisa dari router Anda (mis: <ChatPage />, <ProfilePage />)
      */}
    </AuthProvider>
  );
}