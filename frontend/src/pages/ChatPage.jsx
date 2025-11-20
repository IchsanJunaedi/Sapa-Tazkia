import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosConfig';
import { sendMessageToAI } from '../api/aiService';
import { Plus, ArrowUp, MoreHorizontal, Trash2 } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import Sidebar from '../components/layout/SideBar';

// --- Komponen ChatWindow --- (TIDAK BERUBAH)
const ChatWindow = ({ messages, isLoading, userName, isGuest = false }) => {
    if (messages.length === 0 && !isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center m-4">
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
        <div className="flex-1 p-4 md:p-8 space-y-4">
            {messages.map((msg, index) => {
                const isUser = msg.sender === 'user' || msg.role === 'user';
                
                return (
                    <div
                        key={index}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl ${isUser ? 'ml-auto' : 'mr-auto'}`}>
                            <div className={`p-3 md:p-4 rounded-3xl text-sm break-words ${
                                isUser
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-800'
                                }`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    </div>
                );
            })}

            {isLoading && (
                <div className="flex justify-start">
                    <div className="max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl mr-auto">
                        <div className="p-3 text-gray-800 rounded-3xl">
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

// --- Komponen ChatInput --- (TIDAK BERUBAH)
const ChatInput = ({ onSend, disabled }) => {
    const [input, setInput] = useState('');
    const textareaRef = useRef(null);
    
    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (input.trim() && !disabled) {
            onSend(input.trim());
            setInput('');
            // Reset height setelah kirim
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
        // Shift + Enter akan membiarkan new line secara natural
    };

    // Auto-resize textarea agar tinggi menyesuaikan konten
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [input]);

    return (
        <div className="p-4 md:p-6 border-t border-gray-200 flex justify-center bg-[#fef6e4]">
            <form onSubmit={handleSubmit} className="w-full max-w-3xl flex items-center p-2 bg-white border border-gray-300 rounded-full shadow-xl">
                <button type="button" className="p-2 mr-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full transition-colors" title="Attach" disabled={disabled}>
                    <Plus size={20} />
                </button>
                
                {/* Ganti input dengan textarea */}
                <textarea
                    ref={textareaRef}
                    placeholder="Message Sapa Tazkia"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    rows={1}
                    className="flex-1 px-2 py-2 text-base text-gray-700 placeholder-gray-500 focus:outline-none bg-white resize-none min-h-[40px] max-h-[120px]"
                    style={{ 
                        // Maintain styling seperti input
                        border: 'none',
                        outline: 'none',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        lineHeight: 'inherit'
                    }}
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

// --- Komponen Utama ChatPage --- (DIPERBAIKI)
const ChatPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, loading, isAuthenticated } = useAuth();

    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // ✅ PERBAIKAN: Tambahkan state untuk new chat loading
    const [isStartingNewChat, setIsStartingNewChat] = useState(false);
    
    // ✅ State untuk currentChatId dengan localStorage persistence
    const [currentChatId, setCurrentChatId] = useState(() => {
        const saved = localStorage.getItem('chatpage_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.currentChatId || null;
            } catch (e) {
                return null;
            }
        }
        return null;
    });
    
    const [chatHistory, setChatHistory] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isGuest, setIsGuest] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // ✅ STATE untuk Modal Confirmation
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [chatToDelete, setChatToDelete] = useState(null);
    
    // ✅ STATE untuk Menu Titik Tiga
    const [showMenu, setShowMenu] = useState(false);
    
    const chatContainerRef = useRef(null);
    const menuButtonRef = useRef(null);

    // ✅ PERBAIKAN UTAMA: Ref yang lebih sederhana dan efektif
    const initializationRef = useRef({
        hasProcessedInitialState: false,
        isSelectingChat: false,
        isStartingNewChat: false
    });

    // ✅ State untuk new chat tracking
    const [isNewChat, setIsNewChat] = useState(() => {
        const saved = localStorage.getItem('chatpage_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.isNewChat !== undefined ? parsed.isNewChat : true;
            } catch (e) {
                return true;
            }
        }
        return true;
    });

    // ✅ Save state ke localStorage dengan debounce
    useEffect(() => {
        if (isGuest) {
            console.log('💾 [CHAT PAGE] Guest mode - skipping localStorage save');
            return;
        }

        const timeoutId = setTimeout(() => {
            const stateToSave = {
                isNewChat,
                currentChatId,
                messages: messages.slice(-10),
                timestamp: Date.now()
            };
            localStorage.setItem('chatpage_state', JSON.stringify(stateToSave));
            console.log('💾 [CHAT PAGE] State saved to localStorage:', { 
                currentChatId, 
                isNewChat,
                messagesCount: messages.length
            });
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [isNewChat, currentChatId, messages, isGuest]);

    // ✅ FUNCTION DEFINITIONS

    const getUserName = useCallback(() => {
        const fullName = user?.name || user?.fullName || user?.username || 'User';
        const words = fullName.split(' ').slice(0, 2);
        return words.join(' ');
    }, [user]);

    const handleMenuToggle = (e) => {
        e.stopPropagation();
        setShowMenu(prev => !prev);
    };

    const handleCloseMenu = useCallback(() => {
        setShowMenu(false);
    }, []);

    const handleDeleteFromMenu = () => {
        if (currentChatId && !isGuest) {
            setChatToDelete(currentChatId);
            setShowDeleteModal(true);
            setShowMenu(false);
        }
    };

    // Attach event listener untuk close menu ketika klik di luar
    useEffect(() => {
        if (showMenu) {
            document.addEventListener('click', handleCloseMenu);
            return () => {
                document.removeEventListener('click', handleCloseMenu);
            };
        }
    }, [showMenu, handleCloseMenu]);

    // ✅ Load Chat History
    const loadChatHistory = useCallback(async (forceReload = false) => {
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

    // ✅ Handle Delete dengan Modal Confirmation
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
        
        const previousChatHistory = [...chatHistory];
        setChatHistory(prev => prev.filter(chat => chat.id !== chatToDelete));
        
        if (currentChatId === chatToDelete) {
            setCurrentChatId(null);
            setMessages([]);
            setIsNewChat(true);
        }

        try {
            console.log('🗑️ [CHAT PAGE] Deleting chat:', chatToDelete);
            await api.delete(`/api/ai/conversations/${chatToDelete}`);
            console.log('✅ [CHAT PAGE] Chat deleted successfully');

            setTimeout(() => {
                loadChatHistory(true);
            }, 300);

        } catch (error) {
            console.error('❌ [CHAT PAGE] Error deleting chat:', error);
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

    // ✅ Handle AI Message yang diperbaiki
    const handleAIMessage = useCallback(async (messageText, isGuestMode = false) => {
        setIsLoading(true);

        try {
            console.log('🤖 [CHAT PAGE] Sending to AI:', { 
                messageText, 
                isGuestMode, 
                isNewChat,
                currentChatId 
            });

            const shouldCreateNewChat = !currentChatId && isNewChat;
            
            console.log('🔍 [CHAT PAGE] Chat creation decision:', {
                shouldCreateNewChat,
                currentChatId,
                isNewChat
            });

            const response = await sendMessageToAI(
                messageText, 
                isGuestMode, 
                shouldCreateNewChat,
                currentChatId
            );
            
            console.log('✅ [CHAT PAGE] AI Response:', response);

            const botMessage = {
                id: Date.now() + 1,
                content: response.message || response.reply || 'Maaf, tidak ada respons dari AI.',
                sender: 'ai',
                role: 'bot',
                timestamp: response.timestamp || new Date().toISOString(),
            };

            setMessages(prev => [...prev, botMessage]);

            if (response.conversationId) {
                console.log('🔄 [CHAT PAGE] Setting currentChatId from response:', response.conversationId);
                
                setCurrentChatId(response.conversationId);
                
                if (shouldCreateNewChat) {
                    console.log('🔄 [CHAT PAGE] First message completed, setting isNewChat to false');
                    setIsNewChat(false);
                }
                
                setTimeout(() => {
                    console.log('🔄 [CHAT PAGE] Reloading chat history after conversation update');
                    loadChatHistory(true);
                }, 500);
            } else {
                console.log('⚠️ [CHAT PAGE] No conversationId in response, maintaining current state');
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
    }, [currentChatId, loadChatHistory, isNewChat]);

    // ✅ Handle Send Message
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

    // ✅ PERBAIKAN KRITIS: Handle New Chat dengan loading state dan race condition prevention
    const handleNewChat = useCallback(() => {
        console.log('🔄 [CHAT PAGE] Starting new chat');
        
        // ✅ PERBAIKAN: Set loading state untuk mencegah race condition
        setIsStartingNewChat(true);
        initializationRef.current.isStartingNewChat = true;
        
        // Reset semua state ke kondisi awal
        setMessages([]);
        setCurrentChatId(null);
        setIsNewChat(true);
        setIsGuest(false);
        
        // ✅ PERBAIKAN PENTING: Reset flag initialization
        initializationRef.current.hasProcessedInitialState = false;
        initializationRef.current.isSelectingChat = false;
        
        // ✅ PERBAIKAN KRITIS: Clear location state untuk mencegah proses ulang
        if (window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
            console.log('🧹 [CHAT PAGE] Location state cleared after new chat');
        }
        
        // Clear localStorage
        if (!isGuest) {
            localStorage.removeItem('chatpage_state');
        }
        
        console.log('✅ [CHAT PAGE] New chat state reset complete');
        
        // ✅ PERBAIKAN: Reset loading state setelah delay
        setTimeout(() => {
            setIsStartingNewChat(false);
            initializationRef.current.isStartingNewChat = false;
            console.log('🔄 [CHAT PAGE] New chat loading state reset');
        }, 300);
    }, [isGuest]);

    // ✅ PERBAIKAN: Handle Select Chat dari history dengan race condition prevention
    const handleSelectChat = useCallback(async (chatId) => {
        // ✅ PERBAIKAN: Skip jika sedang starting new chat
        if (isStartingNewChat || initializationRef.current.isStartingNewChat) {
            console.log('⏩ [CHAT PAGE] Select chat skipped - currently starting new chat');
            return;
        }

        if (!chatId || chatId === currentChatId || !user || isGuest) return;

        console.log('🔍 [CHAT PAGE] Selecting chat:', chatId);
        
        initializationRef.current.isSelectingChat = true;
        
        setCurrentChatId(chatId);
        setIsNewChat(false);
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
            setTimeout(() => {
                initializationRef.current.isSelectingChat = false;
            }, 100);
        }
    }, [currentChatId, user, isGuest, logout, navigate, isStartingNewChat]);

    const handleToggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    const handleLogin = () => {
        navigate('/');
    };

    const handleSettingsClick = () => {
        console.log('Settings clicked');
    };

    // ✅ PERBAIKAN UTAMA: EFFECT UNTUK PROSES INITIAL STATE DARI LANDING PAGE
    useEffect(() => {
        // Skip jika sedang memilih chat dari sidebar
        if (initializationRef.current.isSelectingChat) {
            console.log('⏩ [CHAT PAGE] Skipping - currently selecting chat from sidebar');
            return;
        }

        // Skip jika sudah diproses
        if (initializationRef.current.hasProcessedInitialState) {
            console.log('⏩ [CHAT PAGE] Initial state already processed');
            return;
        }

        // ✅ PERBAIKAN: Skip jika sedang starting new chat
        if (isStartingNewChat || initializationRef.current.isStartingNewChat) {
            console.log('⏩ [CHAT PAGE] Skipping - currently starting new chat');
            return;
        }

        console.log('🎯 [CHAT PAGE] Processing initial state from LandingPage');
        
        const processInitialState = async () => {
            const guestFromUrl = new URLSearchParams(location.search).get('guest') === 'true';
            const guestFromState = location.state?.isGuest;
            const initialMessage = location.state?.initialMessage;
            const selectedChatId = location.state?.selectedChatId;

            console.log('🔍 [CHAT PAGE] Initial state data:', {
                guestFromUrl,
                guestFromState,
                initialMessage,
                selectedChatId,
                currentGuest: isGuest,
                currentChatId,
                isNewChat
            });

            // ✅ PERBAIKAN: Skip jika ini new chat dan tidak ada initial state yang valid
            if (isNewChat && !initialMessage && !selectedChatId && !guestFromState && !guestFromUrl) {
                console.log('⏩ [CHAT PAGE] New chat with no initial state - skipping processing');
                initializationRef.current.hasProcessedInitialState = true;
                return;
            }

            // ✅ Handle guest mode
            if ((guestFromUrl || guestFromState) && !isGuest) {
                console.log('👤 [CHAT PAGE] Setting guest mode from LandingPage');
                setIsGuest(true);
                setMessages([]);
                setCurrentChatId(null);
                setIsNewChat(true);
                initializationRef.current.hasProcessedInitialState = true;
                
                if (guestFromUrl) {
                    navigate('/chat', { replace: true });
                }
                return;
            }

            // ✅ Handle selected chat dari sidebar LandingPage
            if (selectedChatId && selectedChatId !== currentChatId && !isGuest) {
                console.log('🔍 [CHAT PAGE] Processing selected chat from LandingPage:', selectedChatId);
                initializationRef.current.hasProcessedInitialState = true;
                await handleSelectChat(selectedChatId);
                return;
            }

            // ✅ Handle initial message dari input landing page
            if (initialMessage && !initializationRef.current.hasProcessedInitialState) {
                console.log('🚨 [CHAT PAGE] Processing initial message from LandingPage:', initialMessage);
                
                // Reset state untuk chat baru dari LandingPage
                setMessages([]);
                setCurrentChatId(null);
                setIsNewChat(true);
                setIsGuest(!!guestFromState);

                const userMessage = {
                    id: Date.now(),
                    content: initialMessage,
                    sender: 'user',
                    role: 'user',
                    timestamp: new Date().toISOString(),
                    isGuest: !!guestFromState
                };

                setMessages([userMessage]);
                
                initializationRef.current.hasProcessedInitialState = true;
                
                await handleAIMessage(initialMessage, !!guestFromState);
                
                console.log('✅ [CHAT PAGE] Initial message processed successfully');
                return;
            }

            // ✅ Default case - tandai sudah diproses
            initializationRef.current.hasProcessedInitialState = true;
            console.log('✅ [CHAT PAGE] Default initialization completed');
        };

        const timeoutId = setTimeout(() => {
            processInitialState();
        }, 50);

        return () => clearTimeout(timeoutId);
    }, [
        location.state,
        location.search,
        isGuest,
        currentChatId,
        handleSelectChat,
        handleAIMessage,
        navigate,
        isNewChat,
        isStartingNewChat // ✅ PERBAIKAN: Tambahkan dependency
    ]);

    // ✅ Effect untuk load chat history saat user berubah
    useEffect(() => {
        if (!isGuest && isAuthenticated && user && user.id) {
            console.log('👤 [CHAT PAGE] User authenticated, loading chat history');
            loadChatHistory();
        }
    }, [isAuthenticated, user, isGuest, loadChatHistory]);

    // ✅ Effect untuk clear location state setelah diproses
    useEffect(() => {
        if (initializationRef.current.hasProcessedInitialState && location.state) {
            console.log('🧹 [CHAT PAGE] Clearing location state after processing');
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
    }, [initializationRef.current.hasProcessedInitialState, location.state]);

    // ✅ Debug effect untuk melacak state changes
    useEffect(() => {
        console.log('🔍 [CHAT PAGE] STATE UPDATE', {
            messagesCount: messages.length,
            currentChatId,
            isNewChat,
            isGuest,
            user: user ? `User ${user.id}` : 'No user',
            isSelectingChat: initializationRef.current.isSelectingChat,
            hasProcessedInitialState: initializationRef.current.hasProcessedInitialState,
            isStartingNewChat: isStartingNewChat,
            chatHistoryCount: chatHistory.length
        });
    }, [messages, currentChatId, isNewChat, isGuest, user, chatHistory, isStartingNewChat]);

    // Auto-scroll to bottom
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
        <div className="flex h-screen bg-amber-50 font-sans overflow-hidden">
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
                onLogin={handleLogin}
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
                isStartingNewChat={isStartingNewChat} // ✅ PERBAIKAN: Kirim loading state ke Sidebar
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                <nav className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
                    {/* Logo */}
                    <div className="flex items-center">
                        <button 
                            onClick={() => navigate('/', { replace: true, state: { from: 'chat-page' } })}
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
                        ) : null}
                        
                        {/* ✅ TAMBAHKAN: Tombol Menu Titik Tiga Horizontal */}
                        {!isGuest && currentChatId && (
                            <div className="relative">
                                <button
                                    ref={menuButtonRef}
                                    onClick={handleMenuToggle}
                                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors opacity-80 hover:opacity-100"
                                    title="More options"
                                >
                                    <MoreHorizontal size={18} />
                                </button>
                                
                                {/* Dropdown Menu */}
                                {showMenu && (
                                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                                        <button
                                            onClick={handleDeleteFromMenu}
                                            className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 size={14} className="mr-2" />
                                            Hapus Chat
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </nav>

                <div
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full"
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

                <div className="flex-shrink-0">
                    <ChatInput onSend={handleSendMessage} disabled={isLoading || isDeleting || isStartingNewChat} />
                </div>
            </div>
        </div>
    );
};

export default ChatPage;