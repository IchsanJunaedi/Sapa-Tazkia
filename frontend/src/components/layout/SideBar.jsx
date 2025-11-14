import React, { useState } from 'react';
import { MessageSquare, PenSquare, User, Settings, Trash2, MoreHorizontal, LogOut } from 'lucide-react';

const Sidebar = ({ 
  // Props untuk user dan auth
  user,
  onLogin,
  onLogout,
  
  // Props untuk chat history
  chatHistory = [],
  currentChatId,
  onSelectChat,
  onDeleteChat,
  isDeleting = false,
  
  // Props untuk toggle sidebar
  isSidebarOpen,
  onToggleSidebar,
  
  // Props untuk actions
  onNewChat,
  onSettingsClick,
  
  // Custom styling
  className = ''
}) => {
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isProfilePopupVisible, setIsProfilePopupVisible] = useState(false);
  
  // ✅ FUNGSI: Untuk mendapatkan nama user dengan maksimal 2 kata
  const getUserName = () => {
    const fullName = user?.name || user?.fullName || user?.username || 'User';
    const words = fullName.split(' ').slice(0, 2);
    return words.join(' ');
  };

  // ✅ FUNGSI: Untuk mendapatkan NIM user
  const getUserNIM = () => {
    return user?.nim || user?.studentId || 'NIM tidak tersedia';
  };

  // ✅ FUNGSI: Untuk mendapatkan email user
  const getUserEmail = () => {
    return user?.email || 'Email tidak tersedia';
  };

  // ✅ FUNGSI: Menampilkan popup delete
  const handleMoreClick = (chatId, event) => {
    if (!isSidebarOpen) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({
      x: rect.left - 120, // Posisi popup di sebelah kiri tombol
      y: rect.top
    });
    setSelectedChatId(chatId);
    setIsPopupVisible(true);
  };

  // ✅ FUNGSI: Menampilkan popup profile
  const handleProfileClick = (event) => {
    if (!user || !isSidebarOpen) {
      // Jika belum login, panggil onLogin
      if (!user) {
        onLogin?.();
      }
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    // Posisi popup di atas tombol profile
    setPopupPosition({
      x: rect.left,
      y: rect.top - 200 // Sesuaikan tinggi popup
    });
    setIsProfilePopupVisible(true);
  };

  // ✅ FUNGSI: Menutup semua popup
  const handleCloseAllPopups = () => {
    setIsPopupVisible(false);
    setIsProfilePopupVisible(false);
    setSelectedChatId(null);
  };

  // ✅ FUNGSI: Handle delete chat dari popup
  const handleDeleteFromPopup = () => {
    if (selectedChatId && onDeleteChat) {
      onDeleteChat(selectedChatId);
      handleCloseAllPopups();
    }
  };

  // ✅ FUNGSI: Handle logout
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      handleCloseAllPopups();
    }
  };

  const ToggleIcon = ({ open }) => (
    <img
      src="https://www.svgrepo.com/show/493722/sidebar-toggle-nav-side-aside.svg"
      alt="Toggle Sidebar"
      className={`w-6 h-6 text-gray-700 transition-transform duration-300 ${open ? '' : 'transform rotate-180'}`}
    />
  );

  return (
    <>
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-amber-50 border-r border-gray-200 flex flex-col h-screen p-3 shadow-xl transition-all duration-300 relative ${className}`}>
        
        {/* Header Sidebar (Settings & Toggle) */}
        {isSidebarOpen ? (
          <div className="flex justify-between items-center mb-8 flex-shrink-0">
            <button 
              className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-3" 
              title="Settings"
              onClick={onSettingsClick}
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
          <div className="flex justify-center mb-8 flex-shrink-0">
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors"
              title="Buka Sidebar"
            >
              <ToggleIcon open={false} />
            </button>
          </div>
        )}

        {/* ✅ DIUBAH: Container untuk bagian atas yang TIDAK bisa di-scroll (NEW CHAT & RIWAYAT CHAT) */}
        <div className="flex flex-col flex-shrink-0">
          {/* Tombol New Chat */}
          <div className={`flex ${isSidebarOpen ? 'justify-start' : 'justify-center'} space-y-3`}>
            <button
              className={`${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center group relative gap-3`}
              title="New Chat"
              onClick={onNewChat}
            >
              <PenSquare size={20} />
              <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
                New Chat
              </span>
            </button>
          </div>

          {/* Tombol Riwayat Chat (Label) */}
          <div className={`flex ${isSidebarOpen ? 'justify-start' : 'justify-center'} mt-3`}>
            <div
              className={`${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-gray-700 rounded-xl flex items-center group relative gap-3`}
              title="Chats"
            >
              <MessageSquare size={20} />
              <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
                Riwayat Chat
              </span>
            </div>
          </div>
        </div>

        {/* ✅ DIUBAH: Area Riwayat Chat dengan custom scrollbar */}
        <div className="flex-1 overflow-y-auto mt-0 space-y-2 min-h-0 custom-scrollbar">
          {isSidebarOpen && user && chatHistory.length > 0 && chatHistory.map(chat => (
            <div key={chat.id} className="flex items-center group">
              <button
                onClick={() => onSelectChat?.(chat.id)}
                className={`flex-1 text-left p-2 rounded-lg truncate text-sm ${
                  currentChatId === chat.id ? 'bg-gray-200 font-semibold' : 'hover:bg-gray-100'
                }`}
                title={chat.title}
                disabled={isDeleting}
              >
                {chat.title}
              </button>
              {onDeleteChat && isSidebarOpen && (
                <button
                  onClick={(e) => handleMoreClick(chat.id, e)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100 ml-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="More options"
                  disabled={isDeleting}
                >
                  <MoreHorizontal size={14} />
                </button>
              )}
            </div>
          ))}
          {isSidebarOpen && user && chatHistory.length === 0 && (
            <p className="p-2 text-xs text-gray-500 text-center">
              Belum ada riwayat chat.
            </p>
          )}
          {isSidebarOpen && !user && (
            <p className="p-2 text-xs text-gray-500 text-center">
              Login untuk melihat riwayat chat Anda.
            </p>
          )}
        </div>

        {/* ✅ DIUBAH: Profile dipindah ke bawah - TIDAK bisa di-scroll */}
        <div className="mt-auto flex-shrink-0">
          <div className="flex justify-center mb-4">
            <button
              className={`${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-auto ${
                user ? 'bg-[#172c66] hover:bg-[#172c90]' : 'bg-[#172c66] hover:bg-[#172c80]'
              } text-white rounded-xl shadow-lg transition-all flex flex-col items-start group relative gap-1 p-3`}
              title={user ? `Logged in as ${getUserName()}. NIM: ${getUserNIM()}` : 'Login as Mahasiswa'}
              onClick={handleProfileClick}
            >
              <div className="flex items-center gap-3 w-full">
                <User size={20} />
                {isSidebarOpen && (
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold whitespace-nowrap truncate max-w-[160px]">
                      {user ? getUserName() : 'Login Mahasiswa'}
                    </span>
                    {user && (
                      <span className="text-xs text-gray-300 whitespace-nowrap truncate max-w-[160px]">
                        {getUserNIM()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* ✅ TAMBAHAN: CSS untuk custom scrollbar */}
        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #9CA3AF;
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #6B7280;
          }
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #9CA3AF transparent;
          }
        `}</style>
      </div>

      {/* ✅ POPUP DELETE */}
      {isPopupVisible && (
        <>
          {/* Overlay untuk menutup popup ketika klik di luar */}
          <div 
            className="fixed inset-0 z-40"
            onClick={handleCloseAllPopups}
          />
          
          {/* Popup Container */}
          <div 
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-48"
            style={{
              left: `${popupPosition.x}px`,
              top: `${popupPosition.y}px`
            }}
          >
            {/* Header Popup */}
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100">
              <div className="p-2 bg-red-50 rounded-lg">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Hapus Chat</h3>
                <p className="text-xs text-gray-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>
            
            {/* Tombol Delete */}
            <button
              onClick={handleDeleteFromPopup}
              disabled={isDeleting}
              className="w-full py-2 px-3 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={14} />
              {isDeleting ? 'Menghapus...' : 'Hapus Chat'}
            </button>
          </div>
        </>
      )}

      {/* ✅ POPUP PROFILE */}
      {isProfilePopupVisible && user && (
        <>
          {/* Overlay untuk menutup popup ketika klik di luar */}
          <div 
            className="fixed inset-0 z-40"
            onClick={handleCloseAllPopups}
          />
          
          {/* Popup Profile Container */}
          <div 
            className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 w-64"
            style={{
              left: `${popupPosition.x}px`,
              top: `${popupPosition.y - 10}px`
            }}
          >
            {/* Header Profile */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[#172c66] rounded-full flex items-center justify-center">
                  <User size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 truncate">
                    {getUserName()}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {getUserEmail()}
                  </p>
                </div>
              </div>
                <div className="text-xs text-gray-400">
                {getUserNIM()} {getUserNIM()} 
              </div>
            </div>

            {/* Menu Options */}
            <div className="p-2">
              {/* Tombol Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut size={16} />
                <span>Log out</span>
              </button>
            </div>

            {/* Footer - Plan Info */}
            <div className="px-4 py-3 bg-gray-50 rounded-b-xl border-t border-gray-100">
              <div className="flex items-center justify-between">
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Sidebar;