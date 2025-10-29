import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Plus, MessageSquare, PenSquare, User, Settings } from 'lucide-react';

// --- Komponen GradientText Diintegrasikan di sini ---
const GradientText = ({ children, className = '' }) => {
  return (
    <span 
      className={`bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-purple-600 ${className}`}
      // Properti style untuk memastikan gradien bekerja pada teks
      style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
    >
      {children}
    </span>
  );
};

// --- Komponen Button Diintegrasikan di sini ---
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


// --- Komponen Sidebar Diintegrasikan di sini ---
const Sidebar = () => {  
  return (
    // Memastikan Sidebar memiliki tinggi penuh dan latar belakang berbeda (krem/peach)
    <div className="w-20 bg-amber-50 border-r border-gray-200 flex flex-col h-screen p-3 shadow-xl">
      
      {/* Tombol Pengaturan (Settings) - Paling Atas Kiri */}
      <div className="flex justify-center mb-8">
        <button className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors">
          <Settings size={24} />
        </button>
      </div>

      {/* Login Mahasiswa Button (Diganti menjadi ikon User) */}
      <div className="flex justify-center mb-10">
        <button 
          className="w-12 h-12 bg-blue-500 text-white rounded-xl shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center group relative"
          title="Login Mahasiswa"
        >
          <User size={20} />
          <span className="absolute left-full ml-3 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
            Login Mahasiswa
          </span>
        </button>
      </div>

      {/* New Chat Button */}
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
      
      {/* Chat History/Chats Button */}
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

      {/* Follow us on (Paling Bawah) */}
      <div className="mt-auto flex justify-center flex-col items-center">
        <p className="text-xs text-gray-500 rotate-90 mb-6 hidden">Follow us</p>
        <div className="space-y-2">
          {/* Placeholder untuk ikon Follow us, dibuat lebih ringkas */}
          <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
          <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
          <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};


const LandingPage = () => {
  const navigate = useNavigate();

  return (
    // Flex container utama untuk menampung Sidebar dan Konten Utama
    <div className="min-h-screen flex bg-[#fbf9f6] font-sans"> 
      
      {/* 1. Sidebar Kiri (Lebar 20) */}
      <Sidebar /> 

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
              className="bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200/50 rounded-lg" // Styling Sesuai Desain
              onClick={() => navigate('/login')}
            >
              SIGN IN
            </Button>
            <Button 
              variant="primary" 
              size="md"
              className="bg-orange-400 hover:bg-orange-500 text-white shadow-lg shadow-orange-200/50 rounded-lg" // Styling Sesuai Desain
              onClick={() => navigate('/register')} // Mengarahkan ke halaman daftar
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
            <GradientText>Where Should we begin?</GradientText> 
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
    </div>
  );
};

export default LandingPage;
