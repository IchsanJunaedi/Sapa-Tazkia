import React from 'react';
import { MessageSquare, PenSquare, User, Settings, Instagram, Globe, Youtube } from 'lucide-react';

const Sidebar = ({ onClickLogin, isSidebarOpen, onToggleSidebar, user, onLogout }) => {
  
  // ✅ PERBAIKAN: Gunakan useAuth hook untuk konsistensi
  // (Tapi karena ini komponen presentasional, kita tetap gunakan props)
  
  // ✅ Fungsi untuk mendapatkan nama user dengan berbagai fallback
  const getUserName = () => {
    return user?.name || user?.fullName || user?.username || 'User';
  };

  // ✅ Fungsi untuk mendapatkan nama pendek (first name saja)
  const getUserShortName = () => {
    const fullName = getUserName();
    return fullName.split(' ')[0];
  };

  const ToggleIcon = ({ open }) => (
    <img
      src="https://www.svgrepo.com/show/493722/sidebar-toggle-nav-side-aside.svg"
      alt="Toggle Sidebar"
      className={`w-6 h-6 text-gray-700 transition-transform duration-300 ${open ? '' : 'transform rotate-180'}`}
    />
  );

  return (
    <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-amber-50 border-r border-gray-200 flex flex-col h-screen p-3 shadow-xl transition-all duration-300 relative`}>
      
      {/* ✅ Header dengan toggle button */}
      {isSidebarOpen ? (
        <div className="flex justify-between items-center mb-8">
          <button 
            className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-3" 
            title="Settings"
            onClick={() => console.log('Settings clicked')} // ✅ Tambahkan handler
          >
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

      {/* ✅ User Login/Logout Button */}
      <div className="flex justify-center mb-10">
        {user ? (
          <button
            className={`${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 bg-green-500 text-white rounded-xl shadow-lg hover:bg-green-600 transition-all flex items-center group relative gap-3`}
            title={`Logged in as ${getUserName()}. Click to logout.`}
            onClick={onLogout}
          >
            <User size={20} />
            <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
              {getUserShortName()}
            </span>
          </button>
        ) : (
          <button
            className={`${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 bg-blue-500 text-white rounded-xl shadow-lg hover:bg-blue-600 transition-all flex items-center group relative gap-3`}
            title="Login Mahasiswa"
            onClick={onClickLogin}
          >
            <User size={20} />
            <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
              Login Mahasiswa
            </span>
          </button>
        )}
      </div>

      {/* ✅ New Chat Button */}
      <div className={`flex ${isSidebarOpen ? 'justify-start' : 'justify-center'} space-y-3`}>
        <button
          className={`${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center group relative gap-3`}
          title="New Chat"
          onClick={() => console.log('New Chat clicked')} // ✅ Tambahkan handler
        >
          <PenSquare size={20} />
          <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
            New Chat
          </span>
        </button>
      </div>

      {/* ✅ Chat History Button */}
      <div className={`flex ${isSidebarOpen ? 'justify-start' : 'justify-center'} mt-3`}>
        <button
          className={`${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center group relative gap-3`}
          title="Chats"
          onClick={() => console.log('Chat History clicked')} // ✅ Tambahkan handler
        >
          <MessageSquare size={20} />
          <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
            Riwayat Chat
          </span>
        </button>
      </div>

      {/* ✅ Social Media Links */}
      <div className={`mt-auto flex ${isSidebarOpen ? 'flex-col items-start gap-2' : 'flex-row items-center justify-center space-x-2'} pb-4`}>
        <a 
          href="https://www.instagram.com/stmiktazkia_official/" 
          target="_blank" 
          rel="noopener noreferrer" 
          title="Instagram" 
          className="text-gray-500 hover:text-pink-500 transition-colors flex items-center gap-3"
        >
          <Instagram size={16} />
          <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap text-sm`}>
            Instagram
          </span>
        </a>
        <a 
          href="https://stmik.tazkia.ac.id/" 
          target="_blank" 
          rel="noopener noreferrer" 
          title="Website" 
          className="text-gray-500 hover:text-blue-500 transition-colors flex items-center gap-3"
        >
          <Globe size={16} />
          <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap text-sm`}>
            Website
          </span>
        </a>
        <a 
          href="https://www.youtube.com/@stmiktazkia" 
          target="_blank" 
          rel="noopener noreferrer" 
          title="YouTube" 
          className="text-gray-500 hover:text-red-500 transition-colors flex items-center gap-3"
        >
          <Youtube size={16} />
          <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap text-sm`}>
            YouTube
          </span>
        </a>
      </div>
    </div>
  );
};

export default Sidebar;