import React, { useState, useEffect } from 'react';
import { PenSquare, User, Trash2, MoreHorizontal, LogOut, ChevronDown, ChevronRight, Loader2, Menu, X, Sun, Moon, Search } from 'lucide-react';
import ProfilePopover from './ProfilePopover';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/axiosConfig';

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
  className = '',
  // Mobile overlay props
  isMobileSidebarOpen = false,
  onCloseMobileSidebar
}) => {
  const { theme, toggleTheme } = useTheme();
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isProfilePopupVisible, setIsProfilePopupVisible] = useState(false);
  const [isChatsSectionOpen, setIsChatsSectionOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search effect
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.get(`/ai/conversations/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data.conversations || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      className={`w-6 h-6 invert opacity-70 transition-transform duration-300 ${open ? '' : 'transform rotate-180'}`}
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
      <div className={`hidden md:flex ${isSidebarOpen ? 'md:w-64' : 'md:w-20'} border-r border-white/10 flex-col h-screen p-3 shadow-xl transition-all duration-300 relative ${className}`} style={{ background: 'linear-gradient(160deg, #060e3a 0%, #0f1e78 100%)' }}>

        {/* Header */}
        {isSidebarOpen ? (
          <div className="flex justify-between items-center mb-8 flex-shrink-0">

            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl text-white/70 hover:bg-white/10 transition-colors"
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
              className="p-2 rounded-xl text-white/70 hover:bg-white/10 transition-colors"
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
              className={`${isSidebarOpen ? 'w-full justify-center p-3' : 'w-12 h-12 justify-center'} h-12 text-white rounded-full transition-all flex items-center group relative gap-3 backdrop-blur-sm border border-white/20 ${(isDeleting || isStartingNewChat)
                ? 'opacity-50 cursor-not-allowed bg-white/5'
                : 'bg-white/10 hover:bg-white/20'
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
              className="w-full flex items-center justify-between p-2 text-white/70 hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={isChatsSectionOpen ? "Sembunyikan Chats" : "Tampilkan Chats"}
              disabled={isStartingNewChat || isDeleting}
            >
              <span className="text-sm font-semibold">Chats</span>
              {isChatsSectionOpen ? (
                <ChevronDown size={16} className="text-white/50" />
              ) : (
                <ChevronRight size={16} className="text-white/50" />
              )}
            </button>
          )}
        </div>

        {/* Search Input */}
        {isSidebarOpen && (
          <div className="relative px-3 pb-2">
            <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Cari percakapan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs bg-white/10 text-white
                placeholder-white/30 border border-white/10 focus:outline-none focus:border-white/30"
            />
          </div>
        )}

        {/* Chat Lists */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isChatsSectionOpen && isSidebarOpen ? (
            <div className="flex-1 overflow-y-auto mt-4 space-y-4 custom-scrollbar">
              {searchResults !== null ? (
                <div className="space-y-1">
                  {isSearching && (
                    <div className="flex items-center justify-center gap-2 p-2 text-xs text-white/50">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Mencari...</span>
                    </div>
                  )}
                  {!isSearching && searchResults.length === 0 && (
                    <p className="p-2 text-xs text-white/40 text-center">Tidak ada hasil.</p>
                  )}
                  {searchResults.map(chat => (
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
                  ))}
                </div>
              ) : null}
              {searchResults === null && groupedChats.today.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide px-2">Today</h3>
                  {renderChatGroup(groupedChats.today)}
                </div>
              )}
              {searchResults === null && groupedChats.yesterday.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide px-2">Yesterday</h3>
                  {renderChatGroup(groupedChats.yesterday)}
                </div>
              )}
              {searchResults === null && groupedChats.last7Days.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide px-2">Previous 7 Days</h3>
                  {renderChatGroup(groupedChats.last7Days)}
                </div>
              )}
              {searchResults === null && groupedChats.last30Days.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide px-2">Previous 30 Days</h3>
                  {renderChatGroup(groupedChats.last30Days)}
                </div>
              )}
              {searchResults === null && groupedChats.older.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide px-2">
                    {formatMonthYear(groupedChats.older[0].timestamp)}
                  </h3>
                  {renderChatGroup(groupedChats.older)}
                </div>
              )}

              {/* Empty/Loading States */}
              {searchResults === null && chatHistory.length === 0 && user && (
                <p className="p-2 text-xs text-white/40 text-center">Belum ada riwayat chat.</p>
              )}
              {searchResults === null && !user && (
                <p className="p-2 text-xs text-white/40 text-center">Login untuk melihat riwayat chat Anda.</p>
              )}
              {(isDeleting || isStartingNewChat) && (
                <div className="p-2 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-white/50">
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
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
              text-white/60 hover:text-white hover:bg-white/10
              transition-colors mb-2"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {isSidebarOpen && (
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            )}
          </button>
          <div className="flex justify-center">
            <button
              className={`${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-white rounded-xl shadow-lg transition-all flex items-center backdrop-blur-md border border-white/30 ${user ? 'bg-white/15 hover:bg-white/25' : 'bg-white/15 hover:bg-white/25'
                } ${(isStartingNewChat || isDeleting) ? 'opacity-70 cursor-not-allowed' : ''
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

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 3px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.4); }
          .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.25) transparent; }
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
        <ProfilePopover
          getUserName={getUserName}
          getUserEmail={getUserEmail}
          position={popupPosition}
          onLogout={handleLogout}
          onSettingsClick={onSettingsClick}
          onClose={handleCloseAllPopups}
        />
      )}

      {/* Mobile Overlay Sidebar */}
      {isMobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50 md:hidden"
            onClick={onCloseMobileSidebar}
          />

          {/* Mobile Sidebar Panel */}
          <div className="fixed left-0 top-0 h-full w-72 z-50 md:hidden shadow-2xl transform transition-transform duration-300 ease-out flex flex-col p-3" style={{ background: 'linear-gradient(160deg, #060e3a 0%, #0f1e78 100%)' }}>
            {/* Close Button Header */}
            <div className="flex justify-between items-center mb-6 flex-shrink-0">

              <button
                onClick={onCloseMobileSidebar}
                className="p-2 rounded-xl text-white/70 hover:bg-white/10 transition-colors"
                title="Close Sidebar"
              >
                <X size={24} />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="flex flex-col flex-shrink-0">
              <button
                className={`w-full justify-center p-3 h-12 text-white rounded-full transition-all flex items-center gap-3 backdrop-blur-sm border border-white/20 ${(isDeleting || isStartingNewChat)
                    ? 'opacity-50 cursor-not-allowed bg-white/5'
                    : 'bg-white/10 hover:bg-white/20'
                  }`}
                title={isStartingNewChat ? "Memulai chat baru..." : "New Chat"}
                onClick={(e) => {
                  handleNewChat(e);
                  onCloseMobileSidebar?.();
                }}
                disabled={isDeleting || isStartingNewChat}
              >
                {isStartingNewChat ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <PenSquare size={20} />
                )}
                <span className="font-medium">
                  {isStartingNewChat ? 'Memulai...' : 'New chat'}
                </span>
              </button>
            </div>

            {/* Chats Toggle */}
            <div className="mt-6 flex-shrink-0">
              <button
                onClick={toggleChatsSection}
                className="w-full flex items-center justify-between p-2 text-white/70 hover:text-white rounded-lg transition-colors"
                title={isChatsSectionOpen ? "Sembunyikan Chats" : "Tampilkan Chats"}
              >
                <span className="text-sm font-semibold">Chats</span>
                {isChatsSectionOpen ? (
                  <ChevronDown size={16} className="text-white/50" />
                ) : (
                  <ChevronRight size={16} className="text-white/50" />
                )}
              </button>
            </div>

            {/* Chat Lists */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {isChatsSectionOpen && (
                <div className="flex-1 overflow-y-auto mt-4 space-y-4 custom-scrollbar">
                  {groupedChats.today.length > 0 && (
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide px-2">Today</h3>
                      {groupedChats.today.map(chat => (
                        <div
                          key={chat.id}
                          onClick={() => {
                            handleSelectChat(chat.id);
                            onCloseMobileSidebar?.();
                          }}
                          className={`flex items-center rounded-lg p-2 cursor-pointer text-white/80 ${currentChatId === chat.id ? 'bg-white/20 font-semibold text-white' : 'hover:bg-white/10'
                            }`}
                        >
                          <span className="truncate text-sm">{chat.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {groupedChats.yesterday.length > 0 && (
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide px-2">Yesterday</h3>
                      {groupedChats.yesterday.map(chat => (
                        <div
                          key={chat.id}
                          onClick={() => {
                            handleSelectChat(chat.id);
                            onCloseMobileSidebar?.();
                          }}
                          className={`flex items-center rounded-lg p-2 cursor-pointer text-white/80 ${currentChatId === chat.id ? 'bg-white/20 font-semibold text-white' : 'hover:bg-white/10'
                            }`}
                        >
                          <span className="truncate text-sm">{chat.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {chatHistory.length === 0 && user && (
                    <p className="p-2 text-xs text-white/40 text-center">Belum ada riwayat chat.</p>
                  )}
                  {!user && (
                    <p className="p-2 text-xs text-white/40 text-center">Login untuk melihat riwayat chat Anda.</p>
                  )}
                </div>
              )}
            </div>

            {/* Profile Footer */}
            <div className="mt-4 flex-shrink-0">
              {/* Theme Toggle Button (Mobile) */}
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
                  text-white/60 hover:text-white hover:bg-white/10
                  transition-colors mb-2"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button
                className={`w-full justify-start p-3 h-12 text-white rounded-xl shadow-lg transition-all flex items-center backdrop-blur-md border border-white/30 ${user ? 'bg-white/15 hover:bg-white/25' : 'bg-white/15 hover:bg-white/25'}`}
                title={user ? `Logged in as ${getUserName()}` : 'Login as Mahasiswa'}
                onClick={(e) => {
                  handleProfileClick(e);
                  if (!user) onCloseMobileSidebar?.();
                }}
              >
                <div className="flex items-center gap-3 w-full">
                  <User size={20} />
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
                </div>
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
          ? 'bg-white/20 text-white font-semibold'
          : 'hover:bg-white/10 text-white/70'
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
          className={`
            p-1 rounded-md transition-all ml-1
            ${isActive ? 'opacity-100 text-white/60' : 'opacity-0 group-hover:opacity-100 text-white/40'}
            hover:text-white
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