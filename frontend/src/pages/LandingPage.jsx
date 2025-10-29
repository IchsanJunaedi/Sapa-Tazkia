import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Plus, MessageSquare, PenSquare, User, Settings, X, Mail } from 'lucide-react';

// --- 1. Komponen GradientText Diintegrasikan ---
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

// --- 2. Komponen Button Diintegrasikan ---
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


// --- 3. Komponen Sidebar Diintegrasikan ---
// Sidebar kini menerima prop untuk memicu modal login
const Sidebar = ({ onClickLogin }) => {  
  return (
    <div className="w-20 bg-amber-50 border-r border-gray-200 flex flex-col h-screen p-3 shadow-xl">
      
      {/* Tombol Pengaturan (Settings) - Paling Atas */}
      <div className="flex justify-center mb-8">
        <button className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors">
          <Settings size={24} />
        </button>
      </div>

      {/* Tombol Login Mahasiswa - Dipicu oleh onClickLogin */}
      <div className="flex justify-center mb-10">
        <button 
          className="w-12 h-12 bg-blue-500 text-white rounded-xl shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center group relative"
          title="Login Mahasiswa"
          onClick={onClickLogin} // Memicu modal saat diklik
        >
          <User size={20} />
          {/* Tooltip untuk desktop */}
          <span className="absolute left-full ml-3 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
            Login Mahasiswa
          </span>
        </button>
      </div>

      {/* Tombol New Chat */}
      <div className="flex justify-center space-y-3">
        <button 
          className="w-12 h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center justify-center group relative"
          title="New Chat"
        >
          <PenSquare size={20} />
           <span className="absolute left-full ml-3 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
            New
          </span>
        </button>
      </div>
      
      {/* Tombol Chats History */}
      <div className="flex justify-center">
        <button 
          className="w-12 h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center justify-center group relative"
          title="Chats"
        >
          <MessageSquare size={20} />
          <span className="absolute left-full ml-3 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
            Chats
          </span>
        </button>
      </div>

      {/* Footer Dots */}
      <div className="mt-auto flex justify-center flex-col items-center">
        {/* Konten Follow Us asli, dimodifikasi menjadi dots */}
        <div className="flex space-x-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

// --- 4. Komponen AuthModal Diintegrasikan ---
const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6 mr-3">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.343c-1.896,3.101-5.466,6.17-11.343,6.17 c-6.958,0-12.632-5.673-12.632-12.632c0-6.958,5.674-12.632,12.632-12.632c3.23,0,6.347,1.385,8.441,3.483l5.882-5.882 C34.004,5.946,29.351,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20 C44,22.659,43.834,21.32,43.611,20.083z"/>
        <path fill="#FF3D00" d="M6.309,16.713L11.822,20.3L11.822,20.3C13.298,16.59,17.207,14,21.723,14c3.41,0,6.619,1.218,8.875,3.447l0.024,0.023 l5.845-5.844C34.004,5.946,29.351,4,24,4C16.326,4,9.66,8.275,6.309,14.713z"/>
        <path fill="#4CAF50" d="M24,44c5.205,0,10.222-1.92,13.911-5.385l-6.736-6.495C30.297,33.024,27.265,34.08,24,34.08 c-5.877,0-9.448-3.07-11.344-6.171L6.309,33.287C9.66,39.725,16.326,44,24,44z"/>
        <path fill="#1976D2" d="M43.611,20.083L43.611,20.083L42,20h-0.29c-0.122-0.638-0.344-1.254-0.627-1.851 C41.347,17.385,38.23,16,35,16c-3.265,0-6.297,1.056-8.214,3.003L35.343,28h7.957 C42.834,26.68,44,25.045,44,24C44,22.659,43.834,21.32,43.611,20.083z"/>
    </svg>
);


const AuthModal = ({ isOpen, onClose, initialStep = 0 }) => {
  const [step, setStep] = useState(initialStep); 
  const [email, setEmail] = useState('');

  // Sinkronisasi step saat modal dibuka
  useEffect(() => {
      if (isOpen) {
          setStep(initialStep);
          // Hanya untuk simulasi email yang sudah ada
          if(initialStep === 1 || initialStep === 2) {
            setEmail('ican234@gmail.com');
          } else {
            setEmail('');
          }
      }
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  const renderContent = () => {
    switch (step) {
      case 0: // Login: Log Into Your Account 
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Log Into Your Account</h2>
            <p className="text-sm text-gray-600 mb-6">Get smarter academic responses and guidance from Sapa Tazkia.</p>
            
            <input 
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none mb-4"
            />

            <button
              onClick={() => {
                if (email) setStep(1); 
              }}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-colors mb-4 ${
                email ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              Continue
            </button>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <div className="space-y-3">
              <button className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <GoogleIcon />
                Continue with google
              </button>
              <button className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Mail size={20} className="mr-3 text-gray-500" />
                Email and password
              </button>
            </div>

            <p className="text-sm text-center text-gray-600 mt-6">
              No account yet? 
              {/* Mengganti <a> dengan <button> untuk menangani state tanpa href="#" */}
              <button onClick={() => setStep(1)} className="text-orange-500 hover:underline font-semibold ml-1 focus:outline-none">
                Sign Up
              </button>
            </p>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2">
              Close
            </button>
          </>
        );

      case 1: // Signup Step 1: Create Your Account 
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Create Your Account</h2>
            <p className="text-sm text-gray-600 mb-6">Get smarter academic responses and guidance from Sapa Tazkia.</p>
            
            <div className="w-full px-4 py-3 flex items-center justify-between bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-medium mb-4">
              <span>{email || 'ican234@gmail.com'}</span>
              <Mail size={16} />
            </div>

            <button
              onClick={() => setStep(2)} 
              className="w-full py-3 rounded-xl font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-colors mb-4"
            >
              Continue
            </button>

            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <div className="space-y-3">
              <button className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <GoogleIcon />
                Continue with google
              </button>
              <button className="w-full py-3 flex items-center justify-center border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Mail size={20} className="mr-3 text-gray-500" />
                Email and password
              </button>
            </div>

            <p className="text-sm text-center text-gray-600 mt-6">
              Already have an account? 
              {/* Mengganti <a> dengan <button> untuk menangani state tanpa href="#" */}
              <button onClick={() => setStep(0)} className="text-orange-500 hover:underline font-semibold ml-1 focus:outline-none">
                Log in
              </button>
            </p>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2">
              Close
            </button>
          </>
        );

      case 2: // Signup Step 2: Enter Your Code 
        return (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Enter Your Code</h2>
            <p className="text-sm text-gray-600">Enter the verification code we just sent to</p>
            <p className="text-sm font-semibold text-gray-900 mb-6">{email || 'ican234@gmail.com'}</p>
            
            <input 
              type="text"
              placeholder="Code"
              className="w-full px-4 py-3 text-center border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none mb-4 tracking-widest text-xl font-mono"
            />

            <button
              onClick={() => onClose()} 
              className="w-full py-3 rounded-xl font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-colors mb-4"
            >
              Verify Code
            </button>

            <button className="w-full text-sm text-blue-600 hover:text-blue-800 mb-6">
              Resend code
            </button>

            <p className="text-center text-xs text-gray-500 mb-10">
              {/* Mengganti <a> dengan <button> untuk tautan non-navigasi */}
              <button className="text-gray-500 hover:underline mx-1">Term of use</button> | <button className="text-gray-500 hover:underline mx-1">Privacy policy</button>
            </p>

            <p className="text-sm text-center text-gray-600 mt-6">
              Already have an account? 
              {/* Mengganti <a> dengan <button> untuk menangani state tanpa href="#" */}
              <button onClick={() => setStep(0)} className="text-orange-500 hover:underline font-semibold ml-1 focus:outline-none">
                Log in
              </button>
            </p>
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-900 mt-2">
              Close
            </button>
          </>
        );
      default:
        return null;
    }
  };


  return (
    // Backdrop
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      {/* Modal Card */}
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
  // State untuk mengontrol pembukaan modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialModalStep, setInitialModalStep] = useState(0); // 0: Login, 1: Signup

  const openModal = (step) => {
    setInitialModalStep(step);
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="min-h-screen flex bg-[#fbf9f6] font-sans"> 
      
      {/* 1. Sidebar Kiri (Lebar 20) */}
      <Sidebar onClickLogin={() => openModal(0)} /> 

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col">
        
        {/* Header/Top Nav - Sapa Tazkia Logo & Auth Buttons */}
        <nav className="flex items-center justify-between p-6">
          <h1 className="text-xl font-bold text-gray-800">Sapa Tazkia</h1>
          
          {/* Tombol Sign In & Sign Up di Kanan Atas */}
          <div className="flex items-center space-x-3">
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
          </div>
        </nav>

        {/* Hero Section (Content Utama) - Dibuat Terpusat */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20"> 
          
          {/* Teks Header Baru */}
          <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-12 max-w-4xl">
            {/* <span className="text-gray-800">Where should </span> */}
            <GradientText>Where should we begin?</GradientText> 
          </h1>

          {/* Search/Message Bar Baru */}
          <div className="w-full max-w-2xl">
            <div className="relative flex items-center p-2 bg-white border border-gray-300 rounded-full shadow-xl">
              
              {/* Ikon Plus (+) di Kiri Input */}
              <button className="p-2 mr-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
                <Plus size={20} />
              </button>

              {/* Input */}
              <input
                type="text"
                placeholder="Message Sapa Tazkia"
                onFocus={() => navigate('/chat')}
                className="flex-1 px-2 py-2 text-lg text-gray-700 placeholder-gray-500 focus:outline-none bg-white cursor-pointer" 
              />
              
              {/* Ikon Panah/Kirim di Kanan Input */}
              <button 
                className="p-3 bg-blue-500 text-white hover:bg-blue-600 rounded-full transition-colors shadow-md ml-2"
                aria-label="Send Message"
              >
                <Send size={20} className="transform -rotate-45" /> 
              </button>
            </div>
          </div>
        </div>

        {/* Footer Dots */}
        <div className="flex justify-center p-4">
            <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            </div>
        </div>
      </div>

      {/* MODAL OTENTIKASI - Tampil di atas Landing Page */}
      <AuthModal isOpen={isModalOpen} onClose={closeModal} initialStep={initialModalStep} />
    </div>
  );
};

export default LandingPage;
