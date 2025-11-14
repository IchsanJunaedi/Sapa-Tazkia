import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosConfig';
import { sendMessageToAI } from '../api/aiService';
import { Plus, MessageSquare, PenSquare, User, Settings, Instagram, Globe, Youtube, ArrowUp, Trash2 } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

// --- Komponen Sidebar ---
const CustomSideBar = ({ user, chatHistory, onNewChat, onSelectChat, currentChatId, navigate, isSidebarOpen, onToggleSidebar, onLogout, onDeleteChat, isDeleting }) => {
    
    // ✅ FUNGSI: Untuk mendapatkan nama user dengan maksimal 2 kata
    const getUserName = () => {
        const fullName = user?.name || user?.fullName || user?.username || 'User';
        // Ambil maksimal 2 kata pertama
        const words = fullName.split(' ').slice(0, 2);
        return words.join(' ');
    };

    // ✅ FUNGSI: Untuk mendapatkan NIM user
    const getUserNIM = () => {
        return user?.nim || user?.studentId || 'NIM tidak tersedia';
    };

    const ToggleIcon = ({ open }) => (
        <img
            src="https://www.svgrepo.com/show/493722/sidebar-toggle-nav-side-aside.svg"
            alt="Toggle Sidebar"
            className={`w-6 h-6 text-gray-700 transition-transform duration-300 ${open ? '' : 'transform rotate-180'}`}
        />
    );

    // ✅ DIUBAH: Hapus handleUserClick yang menyebabkan logout
    const handleUserClick = () => {
        // Tidak melakukan apa-apa ketika diklik, atau bisa diarahkan ke profile page
        console.log('User profile clicked');
    };

    return (
        <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-amber-50 border-r border-gray-200 flex flex-col h-screen p-3 shadow-xl transition-all duration-300 relative`}>

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

            {/* ✅ DIUBAH: Tombol User Profile dengan Nama dan NIM */}
            <div className="flex justify-center mb-10">
                <button
                    className={`${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-auto ${user ? 'bg-[#172c66] hover:bg-[#172c90]' : 'bg-[#172c66] hover:bg-[#172c6]'} text-white rounded-xl shadow-lg transition-all flex flex-col items-start group relative gap-1 p-3`}
                    title={user ? `Logged in as ${getUserName()}. NIM: ${getUserNIM()}` : 'Login as Mahasiswa'}
                    onClick={handleUserClick}
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

            {/* Area Riwayat Chat */}
            <div className="flex-1 overflow-y-auto mt-0 space-y-2">
                {isSidebarOpen && user && chatHistory.length > 0 && chatHistory.map(chat => (
                    <div key={chat.id} className="flex items-center group">
                        <button
                            onClick={() => onSelectChat(chat.id)}
                            className={`flex-1 text-left p-2 rounded-lg truncate text-sm ${
                                currentChatId === chat.id ? 'bg-gray-200 font-semibold' : 'hover:bg-gray-100'
                            }`}
                            title={chat.title}
                            disabled={isDeleting}
                        >
                            {chat.title}
                        </button>
                        <button
                            onClick={() => onDeleteChat(chat.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ml-1 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Hapus chat"
                            disabled={isDeleting}
                        >
                            <Trash2 size={14} />
                        </button>
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

            {/* Social Links */}
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

// --- Komponen ChatWindow ---
const ChatWindow = ({ messages, isLoading, userName, isGuest = false }) => {

    const BotAvatar = () => (
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><path d="M12 2a2 2 0 0 0-2 2v.5L8.5 6h7l-1.5-1.5V4a2 2 0 0 0-2-2z" /><path d="M12 22a2 2 0 0 0 2-2v-.5l1.5-1.5h-7l1.5 1.5V20a2 2 0 0 0 2 2z" /><path d="M21 12a2 2 0 0 0-2-2h-3v4h3a2 2 0 0 0 2-2z" /><path d="M3 12a2 2 0 0 1 2-2h3v4H5a2 2 0 0 1-2-2z" /></svg>
        </div>
    );

    const UserAvatar = ({ initial, isGuest }) => (
        <div className={`w-8 h-8 ${isGuest ? 'bg-blue-500' : 'bg-blue-500'} text-white rounded-full flex items-center justify-center text-sm font-semibold`}>
            {isGuest ? 'G' : (initial ? initial.charAt(0).toUpperCase() : 'U')}
        </div>
    );

    if (messages.length === 0 && !isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M4 14s1.5-1 4-1 4 1 4 1v3H4z" /><path d="M18 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /><path d="M10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-700">
                    {isGuest ? 'Selamat datang di Mode Tamu!' : (userName ? `Selamat datang, ${userName}!` : 'Mulai percakapan')}
                </h2>
                <p className="text-sm">Tanyakan apa saja tentang STMIK Tazkia</p>
                {isGuest && (
                    <p className="text-xs text-blue-500 mt-2">Login untuk menyimpan riwayat chat</p>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 md:p-8 space-y-6">
            {messages.map((msg, index) => {
                const isUser = msg.sender === 'user' || msg.role === 'user';
                const avatar = isUser ? <UserAvatar initial={userName} isGuest={msg.isGuest} /> : <BotAvatar />;

                return (
                    <div
                        key={index}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex items-start max-w-lg md:max-w-xl ${isUser ? 'flex-row-reverse' : 'flex-row'} ${isUser ? 'space-x-reverse' : 'space-x-3'}`}>
                            {avatar}
                            <div className={`p-3 md:p-4 rounded-xl max-w-full shadow-md text-sm ${
                                isUser
                                    ? `${msg.isGuest ? 'bg-blue-500' : 'bg-blue-500'} text-white rounded-tr-sm`
                                    : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'
                                }`}>
                                <p>{msg.content}</p>
                                <p className={`mt-1 text-xs ${isUser ? (msg.isGuest ? 'text-purple-200' : 'text-blue-200') : 'text-gray-500'} text-right`}>
                                    {new Date(msg.timestamp || msg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}

            {isLoading && (
                <div className="flex justify-start">
                    <div className="flex items-start space-x-3">
                        <BotAvatar />
                        <div className="p-3 bg-white text-gray-800 rounded-xl border border-gray-200 shadow-md">
                            <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Komponen ChatInput ---
const ChatInput = ({ onSend, disabled }) => {
    const [input, setInput] = useState('');
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim() && !disabled) {
            onSend(input.trim());
            setInput('');
        }
    };

    return (
        <div className="p-4 md:p-6 border-t border-gray-200 flex justify-center bg-[#fef6e4]">
            <form onSubmit={handleSubmit} className="w-full max-w-3xl flex items-center p-2 bg-white border border-gray-300 rounded-full shadow-xl">
                <button type="button" className="p-2 mr-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full transition-colors" title="Attach" disabled={disabled}>
                    <Plus size={20} />
                </button>
                <input
                    type="text"
                    placeholder="Message Sapa Tazkia"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 px-2 py-2 text-base text-gray-700 placeholder-gray-500 focus:outline-none bg-white"
                    disabled={disabled}
                />
                <button
                    type="submit"
                    className={`p-3 text-white rounded-full transition-colors shadow-md ml-2 ${input.trim() && !disabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'}`}
                    aria-label="Send Message"
                    disabled={!input.trim() || disabled}
                >
                    <ArrowUp size={20} />
                </button>
            </form>
        </div>
    );
};

// --- Komponen Utama ChatPage ---
const ChatPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, loading, isAuthenticated, token } = useAuth();

    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentChatId, setCurrentChatId] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isGuest, setIsGuest] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // ✅ STATE untuk Modal Confirmation
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [chatToDelete, setChatToDelete] = useState(null);
    
    const chatContainerRef = useRef(null);

    // ✅ FIX: Tambahkan ref untuk mencegah multiple executions
    const hasProcessedInitialMessage = useRef(false);
    const hasProcessedUrlMessage = useRef(false);

    // ✅ FUNCTION DEFINITIONS

    const loadChatHistory = useCallback(async () => {
        if (isGuest || !user || !user.id) {
            console.log('🔍 [CHAT PAGE] Guest mode or no user ID, skipping chat history load');
            setChatHistory([]);
            return;
        }

        try {
            console.log('🔍 [CHAT PAGE] Loading chat history for user:', user.id);
            const response = await api.get('/api/ai/conversations');
            console.log('✅ [CHAT PAGE] Chat history loaded:', response.data.conversations);
            setChatHistory(response.data.conversations || []);
        } catch (error) {
            console.error('❌ [CHAT PAGE] Error loading chat history:', error);
            
            if (error.response?.status === 401) {
                console.log('🛑 [CHAT PAGE] 401 Unauthorized - Token invalid, logging out');
                logout();
                navigate('/');
            } else if (error.response?.status === 404) {
                console.log('🔍 [CHAT PAGE] 404 - No conversations found');
                setChatHistory([]);
            } else {
                console.error('❌ [CHAT PAGE] Other error:', error.response?.data || error.message);
                setChatHistory([]);
            }
        }
    }, [user, logout, navigate, isGuest]);

    // ✅ FUNGSI: Handle Delete dengan Modal Confirmation
    const handleDeleteClick = (chatId) => {
        setChatToDelete(chatId);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!chatToDelete || !user || isGuest) {
            setShowDeleteModal(false);
            setChatToDelete(null);
            return;
        }

        setIsDeleting(true);
        
        // ✅ OPTIMISTIC UPDATE: Langsung update UI
        const previousChatHistory = [...chatHistory];
        setChatHistory(prev => prev.filter(chat => chat.id !== chatToDelete));
        
        // Jika chat yang dihapus sedang aktif, reset ke new chat
        if (currentChatId === chatToDelete) {
            setCurrentChatId(null);
            setMessages([]);
        }

        try {
            console.log('🗑️ [CHAT PAGE] Deleting chat:', chatToDelete);
            await api.delete(`/api/ai/conversations/${chatToDelete}`);
            console.log('✅ [CHAT PAGE] Chat deleted successfully');

        } catch (error) {
            console.error('❌ [CHAT PAGE] Error deleting chat:', error);
            
            // ✅ ROLLBACK jika backend gagal
            setChatHistory(previousChatHistory);
            
            if (error.response?.status === 401) {
                console.log('🛑 [CHAT PAGE] 401 Unauthorized - Token invalid, logging out');
                logout();
                navigate('/');
            } else if (error.response?.status === 404) {
                console.log('🔍 [CHAT PAGE] 404 - Chat not found, no rollback needed');
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

    const handleAIMessage = useCallback(async (messageText, isGuestMode = false) => {
        setIsLoading(true);

        try {
            console.log('🤖 [CHAT PAGE] Sending to AI:', { messageText, isGuestMode });
            const response = await sendMessageToAI(messageText, isGuestMode);
            console.log('✅ [CHAT PAGE] AI Response:', response);

            const botMessage = {
                id: Date.now() + 1,
                content: response.message || response.reply || 'Maaf, tidak ada respons dari AI.',
                sender: 'ai',
                role: 'bot',
                timestamp: response.timestamp || new Date().toISOString(),
            };

            setMessages(prev => [...prev, botMessage]);

            if (!isGuestMode && user && response.conversationId && !currentChatId) {
                console.log('🔄 [CHAT PAGE] New conversation created:', response.conversationId);
                setCurrentChatId(response.conversationId);
                setTimeout(() => loadChatHistory(), 500);
            }

        } catch (error) {
            console.error('❌ [CHAT PAGE] Error sending message to AI:', error);
            
            const errorMessage = {
                id: Date.now() + 1,
                content: 'Maaf, terjadi kesalahan saat mengirim pesan. Silakan coba lagi.',
                sender: 'ai',
                role: 'bot',
                timestamp: new Date().toISOString(),
                isError: true
            };
            setMessages(prev => [...prev, errorMessage]);
            
        } finally {
            setIsLoading(false);
        }
    }, [user, currentChatId, loadChatHistory]);

    const handleSendMessage = async (messageText) => {
        if (!isGuest && (!isAuthenticated || !user)) {
            console.error('❌ [CHAT PAGE] Cannot send message - user not authenticated');
            navigate('/');
            return;
        }

        if (!isGuest) {
            const currentToken = localStorage.getItem('token');
            if (!currentToken || currentToken.length < 20) {
                console.error('❌ [CHAT PAGE] Invalid token, cannot send message');
                logout();
                navigate('/');
                return;
            }
        }

        const userMessage = {
            id: Date.now(),
            content: messageText,
            sender: 'user',
            role: 'user',
            timestamp: new Date().toISOString(),
            isGuest: isGuest
        };

        setMessages(prev => [...prev, userMessage]);
        
        if (isGuest) {
            await handleAIMessage(messageText, true);
        } else {
            await handleAIMessage(messageText, false);
        }
    };

    const handleNewChat = () => {
        console.log('🔄 [CHAT PAGE] Starting new chat');
        setMessages([]);
        setCurrentChatId(null);
        
        // ✅ FIX: Reset processing flags untuk new chat
        hasProcessedInitialMessage.current = false;
        hasProcessedUrlMessage.current = false;
        
        if (isGuest) {
            setIsGuest(false);
            navigate('/chat');
        }
    };

    const handleSelectChat = async (chatId) => {
        if (!chatId || chatId === currentChatId || !user || isGuest) return;

        console.log('🔍 [CHAT PAGE] Selecting chat:', chatId);
        
        setCurrentChatId(chatId);
        setIsLoading(true);
        setMessages([]);

        try {
            const response = await api.get(`/api/ai/history/${chatId}`);
            console.log('✅ [CHAT PAGE] Chat history loaded:', response.data);
            
            if (response.data && Array.isArray(response.data.messages)) {
                setMessages(response.data.messages);
            } else {
                console.error('❌ [CHAT PAGE] Invalid history data:', response.data);
                setMessages([]);
            }

        } catch (error) {
            console.error('❌ [CHAT PAGE] Error loading chat history:', error);
            if (error.response?.status === 401) {
                logout();
                navigate('/');
            }
            setMessages([
                { 
                    id: Date.now(),
                    role: 'bot', 
                    sender: 'ai',
                    content: 'Gagal memuat riwayat chat.', 
                    timestamp: new Date().toISOString() 
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    // ✅ FUNGSI: Untuk mendapatkan nama user dengan maksimal 2 kata
    const getUserName = () => {
        const fullName = user?.name || user?.fullName || user?.username || 'User';
        // Ambil maksimal 2 kata pertama
        const words = fullName.split(' ').slice(0, 2);
        return words.join(' ');
    };

    // ✅ FUNGSI: Untuk mendapatkan NIM user
    const getUserNIM = () => {
        return user?.nim || user?.studentId || 'NIM tidak tersedia';
    };

    // ✅ USE EFFECTS dengan proper guards

    // 1. FIRST: Set guest mode from location state - HANYA SEKALI
    useEffect(() => {
        const guestMode = location.state?.isGuest;
        console.log('🔍 [CHAT PAGE] Checking location state for guest mode:', guestMode);

        if (guestMode && !isGuest) {
            console.log('👤 [CHAT PAGE] Setting guest mode from location state');
            setIsGuest(true);
        }
    }, [location.state, isGuest]);

    // 2. SECOND: Handle initial message - DENGAN GUARD
    useEffect(() => {
        const initialMessage = location.state?.initialMessage;
        const guestMode = location.state?.isGuest;

        console.log('📨 [CHAT PAGE] Processing initial message check:', { 
            initialMessage, 
            guestMode,
            currentGuestState: isGuest,
            hasProcessed: hasProcessedInitialMessage.current
        });

        if (initialMessage && !hasProcessedInitialMessage.current) {
            console.log('🚨 [CHAT PAGE] Processing initial message:', initialMessage);
            hasProcessedInitialMessage.current = true;
            
            const userMessage = {
                id: Date.now(),
                content: initialMessage,
                sender: 'user',
                role: 'user',
                timestamp: new Date().toISOString(),
                isGuest: guestMode || isGuest
            };

            setMessages([userMessage]);
            handleAIMessage(initialMessage, guestMode || isGuest);
        }
    }, [location.state, handleAIMessage, isGuest]);

    // 3. THIRD: Auth check - dengan guest mode protection
    useEffect(() => {
        console.log('🔍 [CHAT PAGE] Auth Status Check:', {
            loading,
            isAuthenticated,
            user: user ? { id: user.id, name: getUserName() } : 'No user',
            tokenLength: token?.length,
            isGuest: isGuest,
            locationState: location.state,
            locationSearch: location.search
        });

        // ✅ CEK SEMUA SUMBER untuk guest mode
        const guestFromUrl = new URLSearchParams(location.search).get('guest') === 'true';
        const guestFromState = location.state?.isGuest;
        
        if (guestFromUrl || guestFromState) {
            console.log('👤 [CHAT PAGE] Guest mode detected - skipping auth checks');
            setIsGuest(true);
            return;
        }

        // ✅ JIKA GUEST MODE SUDAH AKTIF, SKIP
        if (isGuest) {
            console.log('👤 [CHAT PAGE] Guest mode active - skipping auth checks');
            return;
        }

        // ✅ HANYA JALANKAN AUTH CHECKS JIKA BUKAN GUEST
        if (!loading && !isAuthenticated) {
            console.log('❌ [CHAT PAGE] User not authenticated and not guest, redirecting to home');
            navigate('/', { replace: true });
            return;
        }
    }, [loading, isAuthenticated, user, token, navigate, logout, isGuest, location.state, location.search]);

    // 4. FOURTH: Handle URL parameters - DENGAN GUARD
    useEffect(() => {
        // ✅ CEK URL PARAMETERS untuk guest mode
        const urlParams = new URLSearchParams(location.search);
        const guestFromUrl = urlParams.get('guest') === 'true';
        const messageFromUrl = urlParams.get('message');

        console.log('🔗 [CHAT PAGE] URL Parameters:', { 
            guestFromUrl, 
            messageFromUrl,
            locationSearch: location.search,
            hasProcessed: hasProcessedUrlMessage.current
        });

        if (guestFromUrl && !hasProcessedUrlMessage.current) {
            console.log('👤 [CHAT PAGE] Guest mode detected from URL');
            setIsGuest(true);
            
            if (messageFromUrl) {
                console.log('🚨 [CHAT PAGE] Processing message from URL:', messageFromUrl);
                hasProcessedUrlMessage.current = true;
                
                const userMessage = {
                    id: Date.now(),
                    content: decodeURIComponent(messageFromUrl),
                    sender: 'user',
                    role: 'user',
                    timestamp: new Date().toISOString(),
                    isGuest: true
                };

                setMessages([userMessage]);
                handleAIMessage(decodeURIComponent(messageFromUrl), true);
                
                // ✅ HAPUS PARAMETERS dari URL setelah diproses
                navigate('/chat', { replace: true });
            }
        }
    }, [location.search, navigate, handleAIMessage]);

    // 5. Load chat history for authenticated users
    useEffect(() => {
        if (!loading && isAuthenticated && user && user.id && !isGuest) {
            console.log('🔄 [CHAT PAGE] Loading chat history...');
            loadChatHistory();
        }
    }, [loadChatHistory, loading, isAuthenticated, user, isGuest]);

    // 6. Auto-scroll to bottom
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    // Show loading while checking authentication (only for non-guest)
    if (loading && !isGuest) {
        return (
            <div className="flex h-screen bg-[#fbf9f6] items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 animate-pulse"><path d="M4 14s1.5-1 4-1 4 1 4 1v3H4z" /><path d="M18 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /><path d="M10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
                    </div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated && !isGuest) {
        return (
            <div className="flex h-screen bg-[#fbf9f6] items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </div>
                    <p className="text-gray-600">Redirecting...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#fef6e4] font-sans">
            {/* ✅ MODAL KONFIRMASI HAPUS */}
            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                title="Hapus Chat"
                message="Apakah Anda yakin ingin menghapus chat ini? Tindakan ini tidak dapat dibatalkan."
                confirmText="Hapus"
                cancelText="Batal"
                isDeleting={isDeleting}
            />

            <CustomSideBar
                user={user}
                chatHistory={chatHistory}
                onNewChat={handleNewChat}
                onSelectChat={handleSelectChat}
                currentChatId={currentChatId}
                navigate={navigate}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={handleToggleSidebar}
                onLogout={logout}
                onDeleteChat={handleDeleteClick}
                isDeleting={isDeleting}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                <nav className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
                    {/* ✅ UPDATED: Ganti teks dengan gambar logo */}
                    <div className="flex items-center">
                        <button 
                            onClick={() => navigate('/')}
                            className="flex items-center focus:outline-none hover:opacity-80 transition-opacity"
                        >
                            <img 
                                src="/logosapatazkia.png" 
                                alt="Sapa Tazkia Logo" 
                                className="h-8 w-auto hover:scale-105 transition-transform duration-200"
                            />
                        </button>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                        {isGuest ? (
                            <span className="text-blue-500 font-medium">Mode Tamu</span>
                        ) : user ? (
                            <span className="text-gray-800">Halo, {getUserName()}</span>
                        ) : null}
                        <button
                            onClick={() => navigate('/')}
                            className="px-4 py-2 bg-[#fef6e4] text-gray-800 rounded-lg hover:bg-[#fef6e4] transition-colors"
                        >
                            Kembali
                        </button>
                    </div>
                </nav>

                <div
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto relative"
                >
                    <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col">
                        <ChatWindow
                            messages={messages}
                            isLoading={isLoading}
                            userName={user ? getUserName() : null}
                            isGuest={isGuest}
                        />
                    </div>
                </div>

                <div>
                    <ChatInput onSend={handleSendMessage} disabled={isLoading || isDeleting} />

                    <div className="flex justify-center items-center space-x-2 px-6 pb-7 bg-[#fef6e4]">
                        <a href="https://www.instagram.com/stmiktazkia_official/" target="_blank" rel="noopener noreferrer" title="Instagram" className="text-gray-500 hover:text-pink-500 transition-colors">
                            <Instagram size={16} />
                        </a>
                        <a href="https://stmik.tazkia.ac.id/" target="_blank" rel="noopener noreferrer" title="Website" className="text-gray-500 hover:text-blue-500 transition-colors">
                            <Globe size={16} />
                        </a>
                        <a href="https://www.youtube.com/@stmiktazkia" target="_blank" rel="noopener noreferrer" title="YouTube" className="text-gray-500 hover:text-red-500 transition-colors">
                            <Youtube size={16} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatPage;