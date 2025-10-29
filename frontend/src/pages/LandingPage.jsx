import React from 'react';
import { useNavigate } from 'react-router-dom';
import GradientText from '../components/common/GradientText';
import Button from '../components/common/Button';
import { Settings, Menu } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-purple-50 flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between p-6">
        <div className="flex items-center space-x-4">
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Settings size={24} className="text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Menu size={24} className="text-gray-600" />
          </button>
        </div>
        
        <h1 className="text-xl font-bold text-gray-800">Sapa Tazkia</h1>
        
        <div className="flex items-center space-x-3">
          <Button variant="primary" size="md" onClick={() => navigate('/login')}>
            SIGN IN
          </Button>
          <Button variant="primary" size="md">
            SIGN UP
          </Button>
        </div>
      </nav>

      {/* Sidebar (Mobile: Hidden, Desktop: Visible) */}
      <div className="hidden lg:block fixed left-0 top-20 p-6 space-y-4">
        <Button 
          variant="primary" 
          className="w-full"
          onClick={() => navigate('/login')}
        >
          Login Mahasiswa
        </Button>
        <button className="w-full flex items-center space-x-2 text-gray-700 hover:text-gray-900">
          <span>📝</span>
          <span>New</span>
        </button>
        <button className="w-full flex items-center space-x-2 text-gray-700 hover:text-gray-900">
          <span>💬</span>
          <span>Chats</span>
        </button>
      </div>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-20">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-center mb-8">
          <span className="text-gray-800">Where </span>
          <GradientText>should we begin?</GradientText>
        </h1>

        {/* Search Bar */}
        <div className="w-full max-w-3xl">
          <div className="relative">
            <input
              type="text"
              placeholder="Message Sapa Tazkia"
              onFocus={() => navigate('/chat')}
              className="w-full px-6 py-4 bg-gray-100 border border-gray-300 rounded-2xl text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all cursor-pointer"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200 rounded-lg">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="p-6 flex justify-center items-center space-x-4">
        <span className="text-sm text-gray-500">Follow us on</span>
        <div className="flex space-x-3">
          <div className="w-8 h-8 bg-gray-800 rounded-full"></div>
          <div className="w-8 h-8 bg-gray-800 rounded-full"></div>
          <div className="w-8 h-8 bg-gray-800 rounded-full"></div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;