import React, { useState } from 'react';
import { PenSquare, User, Settings, Trash2, MoreHorizontal, LogOut, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

const Sidebar = ({ 
  user,
  onLogin,
  onLogout,
  chatHistory = [],
  currentChatId,
  onSelectChat,
  onDeleteChat,
  isDeleting = false,
  isSidebarOpen,
  onToggleSidebar,
  onNewChat,
  onSettingsClick,
  isStartingNewChat = false,
  className = ''
}) => {
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isProfilePopupVisible, setIsProfilePopupVisible] = useState(false);
  const [isChatsSectionOpen, setIsChatsSectionOpen] = useState(true);
  
  // ✅ FUNGSI: Helper
  const getUserName = () => {
    const fullName = user?.name || user?.fullName || user?.username || 'User';
    const words = fullName.split(' ').slice(0, 2);
    return words.join(' ');
  };

  const getUserNIM = () => user?.nim || user?.studentId || 'NIM tidak tersedia';
  const getUserEmail = () => user?.email || 'Email tidak tersedia';

  // ✅ FUNGSI: Grouping
  const groupChatsByTime = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const groups = {
      today: [],
      yesterday: [],
      last7Days: [],
      last30Days: [],
      older: []
    };

    chatHistory.forEach(chat => {
      const chatDate = new Date(chat.timestamp || chat.createdAt || Date.now());
      const chatDay = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());

      if (chatDay.getTime() === today.getTime()) {
        groups.today.push(chat);
      } else if (chatDay.getTime() === yesterday.getTime()) {
        groups.yesterday.push(chat);
      } else if (chatDate >= sevenDaysAgo) {
        groups.last7Days.push(chat);
      } else if (chatDate >= thirtyDaysAgo) {
        groups.last30Days.push(chat);
      } else {
        groups.older.push(chat);
      }
    });

    return groups;
  };

  const formatMonthYear = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
  };

  // ✅ FUNGSI: Actions
  const handleMoreClick = (chatId, event) => {
    if (!isSidebarOpen) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({ x: rect.left - 120, y: rect.top });
    setSelectedChatId(chatId);
    setIsPopupVisible(true);
  };

  const handleProfileClick = (event) => {
    if (!user || !isSidebarOpen) {
      if (!user) onLogin?.();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setPopupPosition({ x: rect.left, y: rect.top - 200 });
    setIsProfilePopupVisible(true);
  };

  const handleCloseAllPopups = () => {
    setIsPopupVisible(false);
    setIsProfilePopupVisible(false);
    setSelectedChatId(null);
  };

  const handleDeleteFromPopup = () => {
    if (selectedChatId && onDeleteChat) {
      onDeleteChat(selectedChatId);
      handleCloseAllPopups();
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      handleCloseAllPopups();
    }
  };

  const toggleChatsSection = () => setIsChatsSectionOpen(!isChatsSectionOpen);

  const handleNewChat = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (isDeleting || isStartingNewChat) return;
    if (onNewChat) onNewChat();
    handleCloseAllPopups();
  };

  const handleSelectChat = (chatId, e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (isDeleting || isStartingNewChat) return;
    if (chatId === currentChatId) return;
    if (onSelectChat) onSelectChat(chatId);
  };

  const ToggleIcon = ({ open }) => (
    <img
      src="https://www.svgrepo.com/show/493722/sidebar-toggle-nav-side-aside.svg"
      alt="Toggle Sidebar"
      className={`w-6 h-6 text-gray-700 transition-transform duration-300 ${open ? '' : 'transform rotate-180'}`}
    />
  );

  const groupedChats = groupChatsByTime();

  // Helper Render Group
  const renderChatGroup = (chats) => (
    chats.map(chat => (
      <ChatItem 
        key={chat.id}
        chat={chat}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onDeleteChat={onDeleteChat}
        isDeleting={isDeleting}
        isStartingNewChat={isStartingNewChat}
        handleMoreClick={handleMoreClick}
        isSidebarOpen={isSidebarOpen}
      />
    ))
  );

  return (
    <>
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-amber-50 border-r border-gray-200 flex flex-col h-screen p-3 shadow-xl transition-all duration-300 relative ${className}`}>
        
        {/* Header */}
        {isSidebarOpen ? (
          <div className="flex justify-between items-center mb-8 flex-shrink-0">
            <button 
              className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-3" 
              title="Settings"
              onClick={onSettingsClick}
              disabled={isStartingNewChat || isDeleting}
            >
              <Settings size={24} />
            </button>
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors"
              title="Tutup Sidebar"
              disabled={isStartingNewChat || isDeleting}
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
              disabled={isStartingNewChat || isDeleting}
            >
              <ToggleIcon open={false} />
            </button>
          </div>
        )}

        {/* New Chat Button */}
        <div className="flex flex-col flex-shrink-0">
          <div className={`flex ${isSidebarOpen ? 'justify-start' : 'justify-center'}`}>
            <button
              className={`${isSidebarOpen ? 'w-full justify-center p-3' : 'w-12 h-12 justify-center'} h-12 bg-white border border-gray-300 text-gray-700 rounded-full transition-all flex items-center group relative gap-3 shadow-sm ${
                (isDeleting || isStartingNewChat) 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-gray-50 hover:shadow-md'
              }`}
              title={isStartingNewChat ? "Memulai chat baru..." : "New Chat"}
              onClick={handleNewChat}
              disabled={isDeleting || isStartingNewChat}
            >
              {isStartingNewChat ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <PenSquare size={20} />
              )}
              <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap font-medium`}>
                {isStartingNewChat ? 'Memulai...' : 'New chat'}
              </span>
            </button>
          </div>
        </div>

        {/* Chats Toggle */}
        <div className="mt-6 flex-shrink-0">
          {isSidebarOpen && (
            <button
              onClick={toggleChatsSection}
              className="w-full flex items-center justify-between p-2 text-gray-700 hover:text-gray-900 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={isChatsSectionOpen ? "Sembunyikan Chats" : "Tampilkan Chats"}
              disabled={isStartingNewChat || isDeleting}
            >
              <span className="text-sm font-semibold">Chats</span>
              {isChatsSectionOpen ? (
                <ChevronDown size={16} className="text-gray-500" />
              ) : (
                <ChevronRight size={16} className="text-gray-500" />
              )}
            </button>
          )}
        </div>

        {/* Chat Lists */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isChatsSectionOpen && isSidebarOpen ? (
            <div className="flex-1 overflow-y-auto mt-4 space-y-4 custom-scrollbar">
              {groupedChats.today.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Today</h3>
                  {renderChatGroup(groupedChats.today)}
                </div>
              )}
              {groupedChats.yesterday.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Yesterday</h3>
                  {renderChatGroup(groupedChats.yesterday)}
                </div>
              )}
              {groupedChats.last7Days.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Previous 7 Days</h3>
                  {renderChatGroup(groupedChats.last7Days)}
                </div>
              )}
              {groupedChats.last30Days.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">Previous 30 Days</h3>
                  {renderChatGroup(groupedChats.last30Days)}
                </div>
              )}
              {groupedChats.older.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">
                    {formatMonthYear(groupedChats.older[0].timestamp)}
                  </h3>
                  {renderChatGroup(groupedChats.older)}
                </div>
              )}

              {/* Empty/Loading States */}
              {chatHistory.length === 0 && user && (
                <p className="p-2 text-xs text-gray-500 text-center">Belum ada riwayat chat.</p>
              )}
              {!user && (
                <p className="p-2 text-xs text-gray-500 text-center">Login untuk melihat riwayat chat Anda.</p>
              )}
              {(isDeleting || isStartingNewChat) && (
                <div className="p-2 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Loader2 size={12} className="animate-spin" />
                    <span>{isStartingNewChat ? 'Memulai chat...' : 'Menghapus...'}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1"></div>
          )}
        </div>

        {/* Profile Footer */}
        <div className="mt-8 flex-shrink-0">
          <div className="flex justify-center">
            <button
              className={`${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 ${
                user ? 'bg-[#172c66] hover:bg-[#172c90]' : 'bg-[#172c66] hover:bg-[#172c80]'
              } text-white rounded-xl shadow-lg transition-all flex items-center ${
                (isStartingNewChat || isDeleting) ? 'opacity-70 cursor-not-allowed' : ''
              }`}
              title={user ? `Logged in as ${getUserName()}` : 'Login as Mahasiswa'}
              onClick={handleProfileClick}
              disabled={isStartingNewChat || isDeleting}
            >
              <div className={`flex items-center ${isSidebarOpen ? 'gap-3 w-full' : 'justify-center w-full'}`}>
                <User size={20} />
                {isSidebarOpen && (
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="text-sm font-semibold whitespace-nowrap truncate">
                      {user ? getUserName() : 'Login Mahasiswa'}
                    </span>
                    {user && (
                      <span className="text-xs text-gray-300 whitespace-nowrap truncate">
                        {getUserNIM()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          </div>
        </div>

        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #9CA3AF; border-radius: 3px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6B7280; }
          .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #9CA3AF transparent; }
        `}</style>
      </div>

      {/* Popups */}
      {isPopupVisible && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleCloseAllPopups} />
          <div className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-48" style={{ left: `${popupPosition.x}px`, top: `${popupPosition.y}px` }}>
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-100">
              <div className="p-2 bg-red-50 rounded-lg"><Trash2 size={18} className="text-red-500" /></div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Hapus Chat</h3>
                <p className="text-xs text-gray-500">Tak bisa dibatalkan</p>
              </div>
            </div>
            <button onClick={handleDeleteFromPopup} disabled={isDeleting || isStartingNewChat} className="w-full py-2 px-3 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {isDeleting ? 'Menghapus...' : 'Hapus Chat'}
            </button>
          </div>
        </>
      )}

      {isProfilePopupVisible && user && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleCloseAllPopups} />
          <div className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 w-64" style={{ left: `${popupPosition.x}px`, top: `${popupPosition.y - 10}px` }}>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[#172c66] rounded-full flex items-center justify-center"><User size={20} className="text-white" /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{getUserName()}</h3>
                  <p className="text-xs text-gray-500 truncate">{getUserEmail()}</p>
                </div>
              </div>
              <div className="text-xs text-gray-400">{getUserNIM()}</div>
            </div>
            <div className="p-2">
              <button onClick={handleLogout} disabled={isStartingNewChat || isDeleting} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-red-600 hover:bg-red-50">
                <LogOut size={16} /> <span>Log out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

// ✅ FIX: ChatItem Tanpa Kotak di Tombol Titik Tiga
const ChatItem = ({ 
  chat, 
  currentChatId, 
  onSelectChat, 
  onDeleteChat, 
  isDeleting, 
  isStartingNewChat,
  handleMoreClick, 
  isSidebarOpen 
}) => {
  
  const handleChatClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (isDeleting || isStartingNewChat) return;
    if (chat.id === currentChatId) return;
    if (onSelectChat) onSelectChat(chat.id, e);
  };

  const handleMoreButtonClick = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (isDeleting || isStartingNewChat) return;
    if (handleMoreClick) handleMoreClick(chat.id, e);
  };

  const isLoading = isDeleting || isStartingNewChat;
  const isActive = currentChatId === chat.id;

  return (
    // Container utama (Parent) yang memiliki background abu-abu saat aktif
    <div 
      onClick={handleChatClick}
      className={`
        flex items-center group rounded-lg p-2 transition-colors cursor-pointer relative
        ${isActive 
          ? 'bg-gray-200 text-gray-800 font-semibold' 
          : 'hover:bg-gray-100 text-gray-700'
        } 
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div 
        className="flex-1 text-left truncate text-sm"
        title={chat.title}
      >
        {chat.title}
      </div>

      {onDeleteChat && isSidebarOpen && (
        <button
          onClick={handleMoreButtonClick}
          // ✅ PERBAIKAN: Menghapus background color (hover:bg-gray-300)
          // Sekarang hanya mengubah warna icon saat di-hover (hover:text-black)
          className={`
            p-1 rounded-md transition-all ml-1
            ${isActive ? 'opacity-100 text-gray-600' : 'opacity-0 group-hover:opacity-100 text-gray-400'} 
            hover:text-black 
            ${isLoading ? 'cursor-not-allowed' : ''}
          `}
          title="More options"
          disabled={isLoading}
        >
          <MoreHorizontal size={16} />
        </button>
      )}
    </div>
  );
};

export default Sidebar;