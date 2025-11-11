import React, { useState, useContext, createContext } from 'react';

// --- Mock AuthContext ---
// In a real app, this would be in its own file (e.g., context/AuthContext.js)
// We create a mock context to make useContext(AuthContext) work.
const AuthContext = createContext();

// Mock AuthProvider to wrap the app
const AuthProvider = ({ children }) => {
  // Mock login function
  const login = async (nim, password) => {
    console.log("Attempting login with:", nim, password);
    // Simulate an API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate a successful login for demonstration
    if (nim === "12345" && password === "password") {
      console.log("Mock login successful");
      return true;
    }
    // Simulate a failed login
    console.log("Mock login failed");
    return false;
  };

  return (
    <AuthContext.Provider value={{ login }}>
      {children}
    </AuthContext.Provider>
  );
};
// --- End Mock AuthContext ---


// --- GoogleIcon Component ---
// In a real app, this might be in components/common/GoogleIcon.js
const GoogleIcon = () => (
  <svg className="w-5 h-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-62.2 62.2C338.5 109.4 300.9 96 248 96c-106.1 0-192 85.9-192 192s85.9 192 192 192c100.9 0 181.1-73.6 188.7-169.1H248v-81.6h239.2c2.7 13.2 4.8 27.2 4.8 42.6z"></path>
  </svg>
);
// --- End GoogleIcon Component ---


// --- LoginPage Component ---
// This is the code you provided, modified to work standalone.
const LoginPage = () => {
  // State untuk form
  const [nim, setNim] = useState('');
  const [password, setPassword] = useState('');

  // State untuk error dan loading
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Ambil fungsi login dari context
  const { login } = useContext(AuthContext);

  /**
   * Fungsi untuk menangani login via NIM/Password
   */
  const handleSubmit = async (e) => {
    e.preventDefault(); // Mencegah refresh halaman
    setIsLoading(true);
    setError(null);

    try {
      // Panggil fungsi login dari context Anda.
      const success = await login(nim, password);

      if (success) {
        // In a real app with react-router, you'd use:
        // navigate('/chat');
        // For this demo, we'll just show an alert.
        alert('Login Berhasil! (Di aplikasi nyata, Anda akan diarahkan ke /chat)');
        setError(null);
      } else {
        setError('Login gagal. Periksa kembali NIM dan Password Anda. (Coba NIM: 12345, Pass: password)');
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan. Coba lagi nanti.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fungsi untuk menangani login via Google
   */
  const handleGoogleLogin = () => {
    setError(null);
    setIsLoading(true);
    
    // Ini BUKAN panggilan API (axios).
    // Ini mengarahkan seluruh browser ke backend.
    // Backend (port 5000) akan menangani redirect ke Google.
    
    // Since we can't redirect in this environment, we'll log it.
    console.log("Mengarahkan ke Google Login...");
    alert('Mengarahkan ke Google Login...\n(window.location.href = "http://localhost:5000/api/auth/google")');
    
    // Simulate the action
    setTimeout(() => {
        setIsLoading(false);
        setError("Redirect Google disimulasikan. Kembali ke halaman login.");
    }, 1500);
    
    // BARIS ASLI (dikomentari agar tidak error di sandbox)
    // window.location.href = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/auth/google`;
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
            {/* Teks dinamis saat loading */}
            {isLoading ? 'Memproses...' : 'Login'}
          </button>
        </form>

        {/* --- Tombol Google Login --- */}
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
        {/* --- AKHIR BLOK BARU --- */}

        <p className="text-center text-sm text-gray-600 mt-6">
          Belum punya akun?
          {/* Mengganti <Link> dengan <a> karena react-router-dom tidak di-load.
            Di aplikasi nyata, ini akan menjadi:
            <Link to="/register" className="text-orange-500 hover:underline ml-1">
              Daftar
            </Link>
          */}
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
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  );
}