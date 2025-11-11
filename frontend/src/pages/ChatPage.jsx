import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosConfig';
import { Send, Plus, MessageSquare, PenSquare, User, Settings, Instagram, Globe, Youtube } from 'lucide-react';

// --- Komponen Sidebar ---
const CustomSideBar = ({ user, chatHistory, onNewChat, onSelectChat, currentChatId, navigate, isSidebarOpen, onToggleSidebar, onLogout }) => {

    const ToggleIcon = ({ open }) => (
        <img
            src="https://www.svgrepo.com/show/493722/sidebar-toggle-nav-side-aside.svg"
            alt="Toggle Sidebar"
            className={`w-6 h-6 text-gray-700 transition-transform duration-300 ${open ? '' : 'transform rotate-180'}`}
        />
    );

    const handleUserClick = () => {
        if (user) {
            onLogout();
        } else {
            navigate('/login');
        }
    };

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

            {/* Tombol User Profile (Dinamis) */}
            <div className="flex justify-center mb-10">
                <button
                    className={` ${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 ${user ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-xl shadow-lg transition-all flex items-center group relative gap-3`}
                    title={user ? `Logged in as ${user.fullName}. Click to logout.` : 'Login as Mahasiswa'}
                    onClick={handleUserClick}
                >
                    <User size={20} />
                    <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
                        {user ? user.fullName : 'Login Mahasiswa'}
                    </span>
                </button>
            </div>

            {/* Tombol New Chat */}
            <div className={`flex ${isSidebarOpen ? 'justify-start' : 'justify-center'} space-y-3`}>
                <button
                    className={` ${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center group relative gap-3`}
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
                    className={` ${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-gray-700 rounded-xl flex items-center group relative gap-3`}
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
                    <button
                        key={chat.id}
                        onClick={() => onSelectChat(chat.id)}
                        className={`w-full text-left p-2 rounded-lg truncate text-sm ${currentChatId === chat.id ? 'bg-gray-200 font-semibold' : 'hover:bg-gray-100'}`}
                        title={chat.title}
                    >
                        {chat.title}
                    </button>
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
const ChatWindow = ({ messages, isLoading, userName }) => {

    const BotAvatar = () => (
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><path d="M12 2a2 2 0 0 0-2 2v.5L8.5 6h7l-1.5-1.5V4a2 2 0 0 0-2-2z" /><path d="M12 22a2 2 0 0 0 2-2v-.5l1.5-1.5h-7l1.5 1.5V20a2 2 0 0 0 2 2z" /><path d="M21 12a2 2 0 0 0-2-2h-3v4h3a2 2 0 0 0 2-2z" /><path d="M3 12a2 2 0 0 1 2-2h3v4H5a2 2 0 0 1-2-2z" /></svg>
        </div>
    );

    const UserAvatar = ({ initial }) => (
        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
            {initial ? initial.charAt(0).toUpperCase() : 'G'}
        </div>
    );

    if (messages.length === 0 && !isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M4 14s1.5-1 4-1 4 1 4 1v3H4z" /><path d="M18 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /><path d="M10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-700">
                    {userName ? `Selamat datang, ${userName}!` : 'Mulai percakapan'}
                </h2>
                <p className="text-sm">Tanyakan apa saja tentang STMIK Tazkia</p>
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 md:p-8 space-y-6">
            {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const avatar = isUser ? <UserAvatar initial={userName} /> : <BotAvatar />;

                return (
                    <div
                        key={index}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex items-start max-w-lg md:max-w-xl ${isUser ? 'flex-row-reverse' : 'flex-row'} ${isUser ? 'space-x-reverse' : 'space-x-3'}`}>
                            {avatar}
                            <div className={`p-3 md:p-4 rounded-xl max-w-full shadow-md text-sm ${
                                isUser
                                    ? 'bg-blue-500 text-white rounded-tr-sm'
                                    : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'
                                }`}>
                                <p>{msg.content}</p>
                                <p className={`mt-1 text-xs ${isUser ? 'text-blue-200' : 'text-gray-500'} text-right`}>
                                    {new Date(msg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
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
        <div className="p-4 md:p-6 border-t border-gray-200 flex justify-center bg-[#fbf9f6]">
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
                    <Send size={20} className="transform -rotate-45" />
                </button>
            </form>
        </div>
    );
};

// --- Komponen Utama ChatPage ---
const ChatPage = () => {
    const navigate = useNavigate();
    const { user, logout, loading, isAuthenticated } = useAuth();

    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentChatId, setCurrentChatId] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const chatContainerRef = useRef(null);

    // Redirect jika tidak authenticated
    useEffect(() => {
        if (!loading && !isAuthenticated) {
            console.log('🔍 [CHAT PAGE] User not authenticated, redirecting to login');
            navigate('/login', { replace: true });
        }
    }, [loading, isAuthenticated, navigate]);

    const loadChatHistory = useCallback(async () => {
        if (!user || !user.id) {
            console.log('🔍 [CHAT PAGE] No user ID, skipping chat history load');
            setChatHistory([]);
            return;
        }

        try {
            console.log('🔍 [CHAT PAGE] Loading chat history for user:', user.id);
            const response = await api.get(`/api/chat/conversations/${user.id}`);
            console.log('✅ [CHAT PAGE] Chat history loaded:', response.data.conversations);
            setChatHistory(response.data.conversations || []);
        } catch (error) {
            console.error('❌ [CHAT PAGE] Error loading chat history:', error);
            if (error.response?.status === 401) {
                console.log('🛑 [CHAT PAGE] 401 Unauthorized, logging out');
                logout();
                navigate('/login');
            }
            setChatHistory([]);
        }
    }, [user, logout, navigate]);

    useEffect(() => {
        if (!loading && isAuthenticated) {
            loadChatHistory();
        }
    }, [loadChatHistory, loading, isAuthenticated]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSendMessage = async (messageText) => {
        if (!isAuthenticated) {
            console.error('❌ [CHAT PAGE] Cannot send message - user not authenticated');
            return;
        }

        const userMessage = {
            role: 'user',
            content: messageText,
            createdAt: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            console.log('🔍 [CHAT PAGE] Sending message:', messageText);
            
            const response = await api.post('/api/chat', {
                message: messageText,
                conversationId: currentChatId,
            });

            console.log('✅ [CHAT PAGE] Message response:', response.data);

            const botMessage = {
                role: 'bot',
                content: response.data.reply,
                createdAt: response.data.timestamp || new Date().toISOString(),
                hasPDF: response.data.hasPDF || false,
            };

            setMessages(prev => [...prev, botMessage]);

            // Update chat history jika conversation baru dibuat
            if (user && response.data.conversationId && !currentChatId) {
                console.log('🔄 [CHAT PAGE] New conversation created:', response.data.conversationId);
                setCurrentChatId(response.data.conversationId);
                // Reload chat history untuk menampilkan conversation baru
                setTimeout(() => loadChatHistory(), 500);
            }

        } catch (error) {
            console.error('❌ [CHAT PAGE] Error sending message:', error);
            const errorMessage = {
                role: 'bot',
                content: 'Maaf, terjadi kesalahan saat mengirim pesan. Silakan coba lagi.',
                createdAt: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMessage]);
            
            if (error.response?.status === 401) {
                logout();
                navigate('/login');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = () => {
        console.log('🔄 [CHAT PAGE] Starting new chat');
        setMessages([]);
        setCurrentChatId(null);
    };

    const handleSelectChat = async (chatId) => {
        if (!chatId || chatId === currentChatId || !user) return;

        console.log('🔍 [CHAT PAGE] Selecting chat:', chatId);
        
        setCurrentChatId(chatId);
        setIsLoading(true);
        setMessages([]);

        try {
            const response = await api.get(`/api/chat/history/${chatId}`);
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
                navigate('/login');
            }
            setMessages([
                { role: 'bot', content: 'Gagal memuat riwayat chat.', createdAt: new Date().toISOString() }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    // Show loading while checking authentication
    if (loading) {
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

    return (
        <div className="flex h-screen bg-[#fbf9f6] font-sans">

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
            />

            <div className="flex-1 flex flex-col overflow-hidden">

                <nav className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
                    <h1
                        className="text-xl font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => navigate('/')}
                    >
                        Sapa Tazkia
                    </h1>
                </nav>

                <div
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto relative"
                >
                    <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col">
                        <ChatWindow
                            messages={messages}
                            isLoading={isLoading}
                            userName={user ? user.fullName : null}
                        />
                    </div>
                </div>

                <div>
                    <ChatInput onSend={handleSendMessage} disabled={isLoading} />

                    <div className="flex justify-center items-center space-x-2 px-6 pb-7 bg-[#fbf9f6]">
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