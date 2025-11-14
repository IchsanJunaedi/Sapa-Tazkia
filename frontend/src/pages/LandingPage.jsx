import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosConfig';
import { Plus, X, ArrowUp } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import Sidebar from '../components/layout/SideBar';

// --- Komponen GradientText ---
const GradientText = ({ children, className = '' }) => {
  return (
    <span
      className={`bg-clip-text text-transparent bg-gradient-to-r from-gray-500 to-gray-600  ${className}`}
      style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
    >
      {children}
    </span>
  );
};

// --- Komponen Button ---
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

// --- Komponen GoogleIcon ---
const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6 mr-3">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.343c-1.896,3.101-5.466,6.17-11.343,6.17 c-6.958,0-12.632-5.673-12.632-12.632c0-6.958,5.674-12.632,12.632-12.632c3.23,0,6.347,1.385,8.441,3.483l5.882-5.882 C34.004,5.946,29.351,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20 C44,22.659,43.834,21.32,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.309,16.713L11.822,20.3L11.822,20.3C13.298,16.59,17.207,14,21.723,14c3.41,0,6.619,1.218,8.875,3.447l0.024,0.023 l5.845-5.844C34.004,5.946,29.351,4,24,4C16.326,4,9.66,8.275,6.309,14.713z" />
    <path fill="#4CAF50" d="M24,44c5.205,0,10.222-1.92,13.911-5.385l-6.736-6.495C30.297,33.024,27.265,34.08,24,34.08 c-5.877,0-9.448-3.07-11.344-6.171L6.309,33.287C9.66,39.725,16.326,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20h-0.29c-0.122-0.638-0.344-1.254-0.627-1.851 C41.347,17.385,38.23,16,35,16c-3.265,0-6.297,1.056-8.214,3.003L35.343,28h7.957 C42.834,26.68,44,25.045,44,24C44,22.659,43.834,21.32,43.611,20.083z" />
  </svg>
);

// --- Komponen AuthModal ---
const AuthModal = ({ isOpen, onClose, initialStep = 0, loginFunction, registerFunction }) => {
  const [step, setStep] = useState(initialStep);
  const [loginNim, setLoginNim] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nim, setNim] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep);
      setLoginNim('');
      setEmail('');
      setPassword('');
      setFullName('');
      setNim('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  const handleLogin = async () => {
    if (!loginNim || !password) {
      setError('NIM and password are required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await loginFunction(loginNim, password);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!fullName || !nim || !email || !password) {
      setError('All fields are required.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await registerFunction({ fullName, nim, email, password });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const renderContent = () => {
    switch (step) {
      case 0:
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
              type="text"
              placeholder="Enter your NIM"
              value={loginNim}
              onChange={(e) => setLoginNim(e.target.value)}
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
                (loginNim && password && !isLoading) ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'
                }`}
              disabled={!loginNim || !password || isLoading}
            >
              {isLoading ? 'Logging in...' : 'Continue'}
            </button>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                <GoogleIcon />
                Continue with google
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

      case 1:
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Your Account</h2>
            <p className="text-sm text-gray-600 mb-6">Get smarter academic responses and guidance from Sapa Tazkia.</p>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

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
              onClick={handleSignUp}
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

      case 2:
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

// --- Komponen Utama Landing Page (UPDATED VERSION) ---
const LandingPage = () => {
  const navigate = useNavigate();
  const { user, loginWithCredentials, register, logout, loading } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialModalStep, setInitialModalStep] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [greeting, setGreeting] = useState('');
  
  // ✅ TAMBAHAN: State untuk riwayat chat
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);

  // ✅ FUNGSI: Untuk mendapatkan nama user dengan maksimal 2 kata
  const getUserName = useCallback(() => {
    const fullName = user?.name || user?.fullName || user?.username || 'User';
    // Ambil maksimal 2 kata pertama
    const words = fullName.split(' ').slice(0, 2);
    return words.join(' ');
  }, [user]);

  // ✅ FIXED: Refresh greeting function dengan semua dependencies
  const refreshGreeting = useCallback(() => {
    const userShortName = getUserName();
    
    const greetingsForUser = [
      `Hi ${userShortName}, Good to see you!`,
      `Welcome back, ${userShortName}!`,
      `Hello ${userShortName}, ready to chat?`,
      `Hi ${userShortName}, how can I help you today?`,
      `Great to have you here, ${userShortName}!`
    ];

    const greetingsForGuest = [
      'Where should we begin?',
      'Hello! How can I assist you today?',
      'Welcome to Sapa Tazkia! How can I help?',
      'Ready to get started? What would you like to know?',
      'Hi there! What brings you here today?'
    ];

    const availableGreetings = user ? greetingsForUser : greetingsForGuest;
    const randomGreeting = availableGreetings[Math.floor(Math.random() * availableGreetings.length)];
    setGreeting(randomGreeting);
  }, [user, getUserName]);

  // ✅ TAMBAHAN: Load chat history untuk user yang login
  const loadChatHistory = useCallback(async () => {
    if (!user || !user.id) {
      console.log('🔍 [LANDING PAGE] No user ID, skipping chat history load');
      setChatHistory([]);
      return;
    }

    try {
      console.log('🔍 [LANDING PAGE] Loading chat history for user:', user.id);
      const response = await api.get('/api/ai/conversations');
      console.log('✅ [LANDING PAGE] Chat history loaded:', response.data.conversations);
      setChatHistory(response.data.conversations || []);
    } catch (error) {
      console.error('❌ [LANDING PAGE] Error loading chat history:', error);
      
      if (error.response?.status === 401) {
        console.log('🛑 [LANDING PAGE] 401 Unauthorized - Token invalid');
      } else if (error.response?.status === 404) {
        console.log('🔍 [LANDING PAGE] 404 - No conversations found');
        setChatHistory([]);
      } else {
        console.error('❌ [LANDING PAGE] Other error:', error.response?.data || error.message);
        setChatHistory([]);
      }
    }
  }, [user]);

  // ✅ TAMBAHAN: Handle delete chat dengan modal confirmation
  const handleDeleteClick = (chatId) => {
    setChatToDelete(chatId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!chatToDelete || !user) {
      setShowDeleteModal(false);
      setChatToDelete(null);
      return;
    }

    setIsDeleting(true);
    
    // Optimistic update
    const previousChatHistory = [...chatHistory];
    setChatHistory(prev => prev.filter(chat => chat.id !== chatToDelete));
    
    if (currentChatId === chatToDelete) {
      setCurrentChatId(null);
    }

    try {
      console.log('🗑️ [LANDING PAGE] Deleting chat:', chatToDelete);
      await api.delete(`/api/ai/conversations/${chatToDelete}`);
      console.log('✅ [LANDING PAGE] Chat deleted successfully');

    } catch (error) {
      console.error('❌ [LANDING PAGE] Error deleting chat:', error);
      
      // Rollback jika gagal
      setChatHistory(previousChatHistory);
      
      if (error.response?.status === 401) {
        console.log('🛑 [LANDING PAGE] 401 Unauthorized');
      } else if (error.response?.status === 404) {
        console.log('🔍 [LANDING PAGE] 404 - Chat not found');
      } else {
        alert('Gagal menghapus chat. Data dikembalikan.');
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setChatToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setChatToDelete(null);
  };

  // ✅ TAMBAHAN: Handle select chat - navigasi ke chat page dengan chat yang dipilih
  const handleSelectChat = (chatId) => {
    console.log('🔍 [LANDING PAGE] Selecting chat:', chatId);
    navigate('/chat', { 
      state: { 
        selectedChatId: chatId 
      } 
    });
  };

  // ✅ FIXED: Effect untuk menutup modal dan refresh greeting ketika user berubah
  useEffect(() => {
    if (user) {
      setIsModalOpen(false);
      // Load chat history ketika user login
      loadChatHistory();
    } else {
      setChatHistory([]);
    }
    refreshGreeting();
  }, [user, refreshGreeting, loadChatHistory]);

  // ✅ FIXED: Effect untuk set greeting awal saat component mount
  useEffect(() => {
    refreshGreeting();
  }, [refreshGreeting]);

  const openModal = (step) => {
    setInitialModalStep(step);
    setIsModalOpen(true);
  };
  
  const closeModal = () => setIsModalOpen(false);

  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  // ✅ FIXED: Fungsi untuk handle pengiriman pesan dengan navigasi yang benar
  const handleSendMessage = () => {
    if (message.trim()) {
      if (user) {
        navigate('/chat', { 
          state: { 
            initialMessage: message.trim(),
            isGuest: false 
          } 
        });
      } else {
        navigate('/chat', { 
          state: { 
            initialMessage: message.trim(),
            isGuest: true 
          }
        });
      }
    }
  };

  // ✅ FIXED: Fungsi untuk handle key press (Enter)
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // ✅ FIXED: Fungsi untuk langsung ke chat sebagai guest
  const handleGuestChat = () => {
    navigate('/chat', { 
      state: { 
        isGuest: true 
      }
    });
  };

  // ✅ FUNGSI: Handle new chat di Landing Page
  const handleNewChat = () => {
    window.location.reload(); // Refresh untuk chat baru
  };

  // ✅ FUNGSI: Handle settings click
  const handleSettingsClick = () => {
    console.log('Settings clicked');
  };

  return (
    <div className="min-h-screen flex bg-amber-50 font-sans overflow-hidden">
      {/* ✅ MODAL KONFIRMASI HAPUS */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Hapus Chat?"
        message="Apakah Anda yakin ingin menghapus chat ini?"
        confirmText="Hapus"
        cancelText="Batal"
        isDeleting={isDeleting}
      />

      {/* ✅ UPDATED: Menggunakan komponen Sidebar reusable */}
      <Sidebar
        user={user}
        onLogin={() => openModal(0)}
        onLogout={logout}
        chatHistory={chatHistory}
        onSelectChat={handleSelectChat}
        currentChatId={currentChatId}
        onDeleteChat={handleDeleteClick}
        isDeleting={isDeleting}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        onNewChat={handleNewChat}
        onSettingsClick={handleSettingsClick}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <nav className="flex items-center justify-between p-6 flex-shrink-0">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/LandingPage.jsx')}
              className="flex items-center focus:outline-none hover:opacity-80 transition-opacity"
            >
              <img 
                src="/logosapatazkia.png" 
                alt="Sapa Tazkia Logo" 
                className="h-8 w-auto hover:scale-105 transition-transform duration-200"
              />
            </button>
          </div>
          
          <div className="flex items-center space-x-3">
            {loading ? (
              <span className="text-gray-500">Loading...</span>
            ) : user ? (
              // ✅ DIHAPUS: Tombol Go to Chat dan Logout untuk user yang sudah login
              null
            ) : (
              <>
                <Button
                  variant="primary"
                  size="md"
                  className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200/50 rounded-lg"
                  onClick={() => openModal(0)}
                >
                  SIGN IN
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200/50 rounded-lg"
                  onClick={handleGuestChat}
                >
                  TRY AS GUEST
                </Button>
              </>
            )}
          </div>
        </nav>

        {/* Hero Section - FIXED */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 overflow-y-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-6 max-w-4xl">
              <GradientText>{greeting}</GradientText>
            </h1>
          </div>

          <div className="w-full max-w-2xl">
            <div className="relative flex items-center p-2 bg-white border border-gray-300 rounded-full shadow-xl">
              <button className="p-2 mr-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
                <Plus size={20} />
              </button>
              <input
                type="text"
                placeholder="Message Sapa Tazkia"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 px-2 py-2 text-lg text-gray-700 placeholder-gray-500 focus:outline-none bg-white"
              />
              <button
                className="p-3 bg-blue-500 text-white hover:bg-blue-600 rounded-full transition-colors shadow-md ml-2"
                aria-label="Send Message"
                onClick={handleSendMessage}
                disabled={!message.trim()}
              >
                <ArrowUp size={20} />
              </button>
            </div>
            
            {/* Guest mode info */}
            <div className="mt-4 text-center">
              <p className="text-gray-500 text-sm">
                {user ? 'AI can make mistakes. Cross-check academic information with official sources.' : 'AI can make mistakes. Cross-check academic information with official sources.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={isModalOpen}
        onClose={closeModal}
        initialStep={initialModalStep}
        loginFunction={loginWithCredentials}
        registerFunction={register}
      />
    </div>
  );
};

export default LandingPage;