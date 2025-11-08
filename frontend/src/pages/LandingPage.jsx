import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// --- PERUBAHAN: Import useAuth ---
import { useAuth } from '../context/AuthContext.js';
import { Send, Plus, MessageSquare, PenSquare, User, Settings, X, Mail, Instagram, Globe, Youtube } from 'lucide-react';

// --- Komponen GradientText (Sudah dibersihkan) ---
const GradientText = ({ children, className = '' }) => {
  return (
    <span
      className={`bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600 ${className}`}
      style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
    >
      {children}
    </span>
  );
};

// --- Komponen Button (Sudah dibersihkan) ---
const Button = ({ children, onClick, className, variant = 'default', size = 'md', ...props }) => {
  const baseClasses = 'font-semibold transition-all duration-200 ease-in-out flex items-center justify-center rounded-lg';
  const variantClasses = {
    default: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md',
    secondary: 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50',
  };
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  const finalClasses = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ');
  return (
    <button
      onClick={onClick}
      className={finalClasses}
      {...props}
    >
      {children}
    </button>
  );
};

// --- Komponen Sidebar (Sudah dibersihkan) ---
const Sidebar = ({ onClickLogin, isSidebarOpen, onToggleSidebar, user, onLogout }) => {

  // Komponen Ikon Toggle kustom
  const ToggleIcon = ({ open }) => (
    <img
      src="https://www.svgrepo.com/show/493722/sidebar-toggle-nav-side-aside.svg"
      alt="Toggle Sidebar"
      className={`w-6 h-6 text-gray-700 transition-transform duration-300 ${open ? '' : 'transform rotate-180'}`}
    />
  );

  return (
    <div className={` ${isSidebarOpen ? 'w-64' : 'w-20'} bg-amber-50 border-r border-gray-200 flex flex-col h-screen p-3 shadow-xl transition-all duration-300 relative`}>

      {/* Header Sidebar (Settings & Toggle) */}
      {isSidebarOpen ? (
        <div className="flex justify-between items-center mb-8">
          <button className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-3" title="Settings">
            <Settings size={24} />
          </button>
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors"
            title="Tutup Sidebar"
          >
            <ToggleIcon open={true} />
          </button>
        </div>
      ) : (
        <div className="flex justify-center mb-8">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors"
            title="Buka Sidebar"
          >
            <ToggleIcon open={false} />
          </button>
        </div>
      )}

      {/* --- PERUBAHAN: Tombol Login/User Dinamis --- */}
      <div className="flex justify-center mb-10">
        {user ? (
          // Jika sudah login
          <button
            className={` ${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 bg-green-500 text-white rounded-xl shadow-lg hover:bg-green-600 transition-all flex items-center group relative gap-3`}
            title={`Logged in as ${user.fullName}. Click to logout.`}
            onClick={onLogout} // Memicu logout
          >
            <User size={20} />
            <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
              {user.fullName.split(' ')[0]} {/* Tampilkan nama depan */}
            </span>
          </button>
        ) : (
          // Jika belum login
          <button
            className={` ${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 bg-blue-500 text-white rounded-xl shadow-lg hover:bg-blue-600 transition-all flex items-center group relative gap-3`}
            title="Login Mahasiswa"
            onClick={onClickLogin} // Memicu modal
          >
            <User size={20} />
            <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
              Login Mahasiswa
            </span>
          </button>
        )}
      </div>

      {/* Tombol New Chat */}
      <div className={`flex ${isSidebarOpen ? 'justify-start' : 'justify-center'} space-y-3`}>
        <button
          className={` ${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center group relative gap-3`}
          title="New Chat"
        >
          <PenSquare size={20} />
          <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
            New Chat
          </span>
        </button>
      </div>

      {/* Tombol Chats History */}
      <div className={`flex ${isSidebarOpen ? 'justify-start' : 'justify-center'} mt-3`}>
        <button
          className={` ${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center group relative gap-3`}
          title="Chats"
        >
          <MessageSquare size={20} />
          <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
            Riwayat Chat
          </span>
        </button>
      </div>

      {/* Social Links di Footer */}
      <div className={`mt-auto flex ${isSidebarOpen ? 'flex-col items-start gap-2' : 'flex-row items-center justify-center space-x-2'} pb-4`}>
        <a href="https://www.instagram.com/stmiktazkia_official/" target="_blank" rel="noopener noreferrer" title="Instagram" className="text-gray-500 hover:text-pink-500 transition-colors flex items-center gap-3">
          <Instagram size={16} />
          <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap text-sm`}>Instagram</span>
        </a>
        <a href="https://stmik.tazkia.ac.id/" target="_blank" rel="noopener noreferrer" title="Website" className="text-gray-500 hover:text-blue-500 transition-colors flex items-center gap-3">
          <Globe size={16} />
          <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap text-sm`}>Website</span>
        </a>
        <a href="https://www.youtube.com/@stmiktazkia" target="_blank" rel="noopener noreferrer" title="YouTube" className="text-gray-500 hover:text-red-500 transition-colors flex items-center gap-3">
          <Youtube size={16} />
          <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap text-sm`}>YouTube</span>
        </a>
      </div>
    </div>
  );
};

// --- Komponen GoogleIcon (Sudah dibersihkan) ---
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6 mr-3">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.343c-1.896,3.101-5.466,6.17-11.343,6.17 c-6.958,0-12.632-5.673-12.632-12.632c0-6.958,5.674-12.632,12.632-12.632c3.23,0,6.347,1.385,8.441,3.483l5.882-5.882 C34.004,5.946,29.351,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20 C44,22.659,43.834,21.32,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.309,16.713L11.822,20.3L11.822,20.3C13.298,16.59,17.207,14,21.723,14c3.41,0,6.619,1.218,8.875,3.447l0.024,0.023 l5.845-5.844C34.004,5.946,29.351,4,24,4C16.326,4,9.66,8.275,6.309,14.713z" />
    <path fill="#4CAF50" d="M24,44c5.205,0,10.222-1.92,13.911-5.385l-6.736-6.495C30.297,33.024,27.265,34.08,24,34.08 c-5.877,0-9.448-3.07-11.344-6.171L6.309,33.287C9.66,39.725,16.326,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20h-0.29c-0.122-0.638-0.344-1.254-0.627-1.851 C41.347,17.385,38.23,16,35,16c-3.265,0-6.297,1.056-8.214,3.003L35.343,28h7.957 C42.834,26.68,44,25.045,44,24C44,22.659,43.834,21.32,43.611,20.083z" />
  </svg>
);


// --- Komponen AuthModal (Sudah dibersihkan) ---
const AuthModal = ({ isOpen, onClose, initialStep = 0, loginFunction, registerFunction }) => {
  const [step, setStep] = useState(initialStep);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // --- PERBAIKAN: Tambahkan state untuk form registrasi ---
  const [fullName, setFullName] = useState('');
  const [nim, setNim] = useState('');
  // Kita akan gunakan state 'password' yang sudah ada untuk registrasi juga
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sinkronisasi step saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      // Reset state
      setEmail('');
      setPassword('');
      // --- PERBAIKAN: Reset state baru ---
      setFullName('');
      setNim('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  // Fungsi handleLogin
  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await loginFunction(email, password);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  // --- PERBAIKAN: Fungsi handleSignUp kini diimplementasikan ---
  const handleSignUp = async () => {
    if (!fullName || !nim || !email || !password) {
      setError('All fields are required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Panggil fungsi register dari AuthContext
      await registerFunction({ fullName, nim, email, password });
      
      // Jika berhasil, pindah ke step verifikasi
      // (Atau tutup modal jika registerFunction sudah menangani login)
      // Untuk sekarang, kita pindah ke step 2
      setStep(2); 
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const renderContent = () => {
    switch (step) {
      case 0: // Login
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Log Into Your Account</h2>
            <p className="text-sm text-gray-600 mb-6">Get smarter academic responses and guidance from Sapa Tazkia.</p>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none mb-4"
              disabled={isLoading}
            />
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none mb-4"
              disabled={isLoading}
            />
            <button
              onClick={handleLogin}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-colors mb-4 ${
                (email && password && !isLoading) ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'
                }`}
              disabled={!email || !password || isLoading}
            >
              {isLoading ? 'Logging in...' : 'Continue'}
            </button>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <div className="space-y-3">
              <button className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors" disabled={isLoading}>
                <GoogleIcon />
                Continue with google
              </button>
              <button className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors" disabled={isLoading}>
                <Mail size={20} className="mr-3 text-gray-500" />
                Email and password
              </button>
            </div>

            <p className="text-sm text-center text-gray-600 mt-6">
              No account yet?
              <button onClick={() => setStep(1)} className="text-orange-500 hover:underline font-semibold ml-1 focus:outline-none" disabled={isLoading}>
                Sign Up
              </button>
            </p>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2" disabled={isLoading}>
              Close
            </button>
          </>
        );

      case 1: // Signup Step 1
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Your Account</h2>
            <p className="text-sm text-gray-600 mb-6">Get smarter academic responses and guidance from Sapa Tazkia.</p>

            {/* --- PERBAIKAN: Tampilkan error --- */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {/* --- PERBAIKAN: Hubungkan input ke state --- */}
            <input 
              type="text" 
              placeholder="Full Name" 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
            />
            <input 
              type="text" 
              placeholder="NIM" 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4" 
              value={nim}
              onChange={(e) => setNim(e.target.value)}
              disabled={isLoading}
            />
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4" 
              disabled={isLoading}
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />

            <button
              onClick={handleSignUp} // Panggil fungsi register di sini
              className={`w-full py-3 rounded-xl font-semibold text-white transition-colors mb-4 ${
                (email && password && fullName && nim && !isLoading) ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={!email || !password || !fullName || !nim || isLoading}
            >
              {isLoading ? 'Creating account...' : 'Continue'}
            </button>
            <p className="text-sm text-center text-gray-600 mt-6">
              Already have an account?
              <button 
                onClick={() => setStep(0)} 
                className="text-orange-500 hover:underline font-semibold ml-1 focus:outline-none"
                disabled={isLoading}
              >
                Log in
              </button>
            </p>
          </>
        );

      case 2: // Signup Step 2: Verify Code
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Enter Your Code</h2>
            <p className="text-sm text-gray-600">Enter the verification code we just sent to</p>
            <p className="text-sm font-semibold text-gray-900 mb-6">{email || 'your-email@example.com'}</p>
            <input type="text" placeholder="Code" className="w-full px-4 py-3 text-center border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none mb-4 tracking-widest text-xl font-mono" />
            <button onClick={() => onClose()} className="w-full py-3 rounded-xl font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-colors mb-4">
              Verify Code
            </button>
          </>
        );
      default:
        return null;
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm relative transform transition-all duration-300 scale-100">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100">
          <X size={24} />
        </button>
        <div className="text-center mt-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};


// --- Komponen Utama Landing Page ---
const LandingPage = () => {
  const navigate = useNavigate();
  const { user, login, register, logout, loading } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialModalStep, setInitialModalStep] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setIsModalOpen(false);
    }
  }, [user]);

  const openModal = (step) => {
    setInitialModalStep(step);
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);

  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const handleChatFocus = () => {
    navigate('/chat');
  };

  return (
    <div className="min-h-screen flex bg-[#fbf9f6] font-sans">

      <Sidebar
        onClickLogin={() => openModal(0)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        user={user} // Kirim data user
        onLogout={logout} // Kirim fungsi logout
      />

      {/* ===================================================================
        ✅ PERBAIKAN: Menambahkan <div ...> pembungkus ini kembali 
        untuk memperbaiki layout yang "acak-acakan".
      =================================================================== */}
      <div className="flex-1 flex flex-col">

        <nav className="flex items-center justify-between p-6">
          <h1 className="text-xl font-bold text-gray-800">Sapa Tazkia</h1>

          <div className="flex items-center space-x-3">
            {loading ? (
              <span className="text-gray-500">Loading...</span>
            ) : user ? (
              // Jika sudah login
              <>
                <Button
                  variant="primary"
                  size="md"
                  className="bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200/50 rounded-lg"
                  onClick={() => navigate('/chat')}
                >
                  Go to Chat
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg"
                  onClick={logout}
                >
                  LOGOUT
                </Button>
              </>
            ) : (
              // Jika belum login
              <>
                <Button
                  variant="primary"
                  size="md"
                  className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200/50 rounded-lg"
                  onClick={() => openModal(0)} // Buka modal di Step 0 (Login)
                >
                  SIGN IN
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200/50 rounded-lg"
                  onClick={() => openModal(1)} // Buka modal di Step 1 (Sign Up)
                >
                  SIGN UP
                </Button>
              </>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-12 max-w-4xl">
            <GradientText>Where should we begin?</GradientText>
          </h1>

          <div className="w-full max-w-2xl">
            <div className="relative flex items-center p-2 bg-white border border-gray-300 rounded-full shadow-xl">
              <button className="p-2 mr-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
                <Plus size={20} />
              </button>
              <input
                type="text"
                placeholder="Message Sapa Tazkia"
                onFocus={handleChatFocus}
                readOnly
                className="flex-1 px-2 py-2 text-lg text-gray-700 placeholder-gray-500 focus:outline-none bg-white cursor-pointer"
              />
              <button
                className="p-3 bg-blue-500 text-white hover:bg-blue-600 rounded-full transition-colors shadow-md ml-2"
                aria-label="Send Message"
                onClick={handleChatFocus}
              >
                <Send size={20} className="transform -rotate-45" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Social Links (Tetap Sama) */}
        <div className="flex justify-center p-6 space-x-6">
          <a href="https://www.instagram.com/stmiktazkia_official/" target="_blank" rel="noopener noreferrer" title="Instagram" className="text-gray-500 hover:text-pink-500 transition-colors">
            <Instagram size={14} />
          </a>
          <a href="https://stmik.tazkia.ac.id/" target="_blank" rel="noopener noreferrer" title="Website" className="text-gray-500 hover:text-blue-500 transition-colors">
            <Globe size={14} />
          </a>
          <a href="https://www.youtube.com/@stmiktazkia" target="_blank" rel="noopener noreferrer" title="YouTube" className="text-gray-500 hover:text-red-500 transition-colors">
            <Youtube size={14} />
          </a>
        </div>

      </div>
      {/* ===================================================================
        ✅ AKHIR DARI DIV PEMBUNGKUS YANG HILANG
      =================================================================== */}

      <AuthModal
        isOpen={isModalOpen}
        onClose={closeModal}
        initialStep={initialModalStep}
        loginFunction={login}
        registerFunction={register}
      />
    </div>
  );
};

export default LandingPage;