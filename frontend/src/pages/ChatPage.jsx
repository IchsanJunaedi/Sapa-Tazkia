import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom'; // ✅ [FIX] Tambah useParams
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosConfig';
import { sendMessageToAI } from '../api/aiService'; 
import { Plus, ArrowUp, MoreHorizontal, Trash2 } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import Sidebar from '../components/layout/SideBar';
import ChatWindow from '../components/chat/ChatWindow'; 
import RateLimitStatus from '../components/common/RateLimitStatus'; 

// --- Komponen ChatInput --- (TIDAK BERUBAH)
const ChatInput = ({ onSend, disabled }) => {
    const [input, setInput] = useState('');
    const textareaRef = useRef(null);
    
    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (input.trim() && !disabled) {
            onSend(input.trim());
            setInput('');
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
    };

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

// --- Komponen Utama ChatPage ---
const ChatPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    // ✅ [FIX] Ambil ID dari URL. 
    // PENTING: Pastikan di Route definisinya pakai :chatId (misal path="/chat/:chatId"). 
    // Jika di route pakai :id, ganti 'chatId' dibawah menjadi 'id'.
    const { chatId } = useParams(); 
    
    const { user, logout, loading, isAuthenticated } = useAuth();

    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null); 
    const [isStartingNewChat, setIsStartingNewChat] = useState(false);
    
    // 1. IS GUEST INITIALIZATION
    const [isGuest, setIsGuest] = useState(() => {
        if (location.state && typeof location.state.isGuest !== 'undefined') {
            return location.state.isGuest;
        }
        const urlGuest = new URLSearchParams(location.search).get('guest') === 'true';
        if (urlGuest) return true;
        
        const token = localStorage.getItem('token');
        if (token) return false;

        const storageGuest = localStorage.getItem('guestSessionId');
        return !!storageGuest;
    });

    // 2. CURRENT CHAT ID INITIALIZATION
    const [currentChatId, setCurrentChatId] = useState(() => {
        // ✅ [FIX] Prioritaskan ID dari URL jika ada
        if (chatId) return chatId;

        if (location.state?.initialMessage || location.state?.fromLandingPage) {
            console.log('🚀 [CHAT PAGE] Initializing New Chat from Landing Page');
            return null; 
        }

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [chatToDelete, setChatToDelete] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    
    const chatContainerRef = useRef(null);
    const menuButtonRef = useRef(null);

    const initializationRef = useRef({
        hasProcessedInitialState: false,
        isProcessingInitialMessage: false,
        hasUserInitiatedNewChat: false,
        hasRestoredFromUrl: false // ✅ [FIX] Ref baru untuk mencegah double fetch
    });

    // 3. IS NEW CHAT INITIALIZATION
    const [isNewChat, setIsNewChat] = useState(() => {
        // ✅ [FIX] Jika ada chatId di URL, berarti BUKAN new chat
        if (chatId) return false;

        if (location.state?.initialMessage || location.state?.fromLandingPage) {
            return true;
        }

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

    // Save state ke localStorage
    useEffect(() => {
        if (isGuest) {
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
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [isNewChat, currentChatId, messages, isGuest]);

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

    useEffect(() => {
        if (showMenu) {
            document.addEventListener('click', handleCloseMenu);
            return () => {
                document.removeEventListener('click', handleCloseMenu);
            };
        }
    }, [showMenu, handleCloseMenu]);

    const loadChatHistory = useCallback(async (forceReload = false) => {
        if (isGuest) {
            setChatHistory([]);
            return;
        }

        if (!user || !user.id) {
            return;
        }

        try {
            const response = await api.get('/api/ai/conversations');
            setChatHistory(response.data.conversations || []);
        } catch (error) {
            console.error('❌ [CHAT PAGE] Error loading chat history:', error);
            if (error.response?.status === 401) {
                logout();
                navigate('/');
            } else {
                setChatHistory([]);
            }
        }
    }, [user, logout, navigate, isGuest]);

    // ✅ [FIX] EMERGENCY BRIDGE EFFECT (RESTORE FROM URL)
    // Effect ini khusus menangani Refresh Page saat ada ID di URL
    useEffect(() => {
        // Cek apakah ada chatId di URL, user sudah login, bukan tamu, dan belum diproses
        if (chatId && isAuthenticated && !isGuest && !initializationRef.current.hasRestoredFromUrl) {
            
            // Cek jika messages kosong (tanda refresh) ATAU ID di URL beda dengan state
            if (messages.length === 0 || currentChatId !== chatId) {
                console.log(`🔄 [CHAT PAGE] Restoring chat from URL: ${chatId}`);
                
                // Set flag agar tidak loop
                initializationRef.current.hasRestoredFromUrl = true;
                
                // Update State Manual
                setCurrentChatId(chatId);
                setIsNewChat(false);
                setIsLoading(true);
                setError(null);

                // Fetch Langsung (Bypass handleSelectChat untuk menghindari logic return)
                api.get(`/api/ai/history/${chatId}`)
                    .then(response => {
                        if (response.data && Array.isArray(response.data.messages)) {
                            setMessages(response.data.messages);
                        } else {
                            setMessages([]);
                        }
                    })
                    .catch(err => {
                        console.error("❌ Failed to restore chat from URL:", err);
                        // Opsional: Jika not found, redirect ke new chat
                        if(err.response?.status === 404) {
                             navigate('/chat', { replace: true });
                        }
                    })
                    .finally(() => {
                        setIsLoading(false);
                    });
            }
        }
    }, [chatId, isAuthenticated, isGuest, messages.length, currentChatId, navigate]);


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
            setError(null); // Reset error jika chat dihapus
        }

        try {
            await api.delete(`/api/ai/conversations/${chatToDelete}`);
            setTimeout(() => {
                loadChatHistory(true);
            }, 300);

        } catch (error) {
            setChatHistory(previousChatHistory);
            if (error.response?.status === 401) {
                logout();
                navigate('/');
            } else {
                alert('Gagal menghapus chat.');
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

    // 4. HANDLE AI MESSAGE UPDATED (FORCE NEW CHAT PARAMETER)
    const handleAIMessage = useCallback(async (messageText, isGuestMode = false, isInitialMessage = false, forceNewChat = false) => {
        if (initializationRef.current.hasUserInitiatedNewChat && isInitialMessage) {
            initializationRef.current.hasUserInitiatedNewChat = false;
            return;
        }

        setIsLoading(true);
        setError(null); 

        try {
            const effectiveCurrentChatId = forceNewChat ? null : currentChatId;
            const shouldCreateNewChat = forceNewChat || (!effectiveCurrentChatId && isNewChat);
            
            console.log('🤖 [CHAT PAGE] Sending to AI...');

            const response = await sendMessageToAI(
                messageText, 
                isGuestMode, 
                shouldCreateNewChat,
                effectiveCurrentChatId
            );
            
            const botMessage = {
                id: Date.now() + 1,
                content: response.message || response.reply || 'Maaf, tidak ada respons dari AI.',
                sender: 'ai',
                role: 'bot',
                timestamp: response.timestamp || new Date().toISOString(),
            };

            setMessages(prev => [...prev, botMessage]);

            if (response.conversationId) {
                setCurrentChatId(response.conversationId);
                
                if (shouldCreateNewChat) {
                    setIsNewChat(false);
                    // ✅ [FIX] Update URL tanpa refresh halaman agar jika di-refresh user tetap disitu
                    navigate(`/chat/${response.conversationId}`, { replace: true });
                }
                
                setTimeout(() => {
                    loadChatHistory(true);
                }, 500);
            }

        } catch (error) {
            console.error('❌ [CHAT PAGE] Error sending message:', error);
            
            if (error.status === 429 || error.code === 'rate_limit_exceeded') {
                setError(error); 
            } else {
                const errorMessage = {
                    id: Date.now() + 1,
                    content: 'Maaf, terjadi kesalahan pada sistem. Silakan coba sesaat lagi.',
                    sender: 'ai',
                    role: 'bot',
                    timestamp: new Date().toISOString(),
                    isError: true
                };
                setMessages(prev => [...prev, errorMessage]);
            }
        } finally {
            setIsLoading(false);
            if (isInitialMessage) {
                initializationRef.current.isProcessingInitialMessage = false;
            }
        }
    }, [currentChatId, loadChatHistory, isNewChat, navigate]); // Tambah navigate ke dependency

    const handleSendMessage = async (messageText) => {
        if (!isGuest && (!isAuthenticated || !user)) {
            navigate('/');
            return;
        }

        // Reset Error saat user mencoba kirim pesan baru
        setError(null); 

        const userMessage = {
            id: Date.now(),
            content: messageText,
            sender: 'user',
            role: 'user',
            timestamp: new Date().toISOString(),
            isGuest: isGuest
        };

        setMessages(prev => [...prev, userMessage]);
        await handleAIMessage(messageText, isGuest);
    };

    const handleNewChat = useCallback(() => {
        initializationRef.current.hasUserInitiatedNewChat = true;
        initializationRef.current.hasProcessedInitialState = true; 
        
        setIsStartingNewChat(true);
        setMessages([]);
        setCurrentChatId(null);
        setIsNewChat(true);
        setError(null); 
        
        // ✅ [FIX] Reset URL ke root chat saat New Chat
        navigate('/chat', { replace: true });
        
        initializationRef.current.isProcessingInitialMessage = false;
        
        setTimeout(() => {
            if (!isGuest) {
                localStorage.removeItem('chatpage_state');
            }
            setIsStartingNewChat(false);
        }, 200);
    }, [isGuest, navigate]);

    const handleSelectChat = useCallback(async (chatId) => {
        if (isStartingNewChat) return;
        if (!chatId || chatId === currentChatId || !user || isGuest) return;

        setCurrentChatId(chatId);
        setIsNewChat(false);
        setIsLoading(true);
        setMessages([]);
        setError(null); 

        // ✅ [FIX] Update URL agar sinkron dengan chat yang dipilih
        navigate(`/chat/${chatId}`, { replace: false });

        try {
            const response = await api.get(`/api/ai/history/${chatId}`);
            if (response.data && Array.isArray(response.data.messages)) {
                setMessages(response.data.messages);
            } else {
                setMessages([]);
            }
        } catch (error) {
            if (error.response?.status === 401) {
                logout();
                navigate('/');
            }
            setMessages([]);
        } finally {
            setIsLoading(false);
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

    // EFFECT INISIALISASI
    useEffect(() => {
        if (initializationRef.current.hasProcessedInitialState || 
            initializationRef.current.isProcessingInitialMessage ||
            initializationRef.current.hasUserInitiatedNewChat) {
            return;
        }

        const processInitialState = async () => {
            const locationState = location.state;

            if (locationState && typeof locationState.isGuest !== 'undefined') {
                 if (locationState.isGuest !== isGuest) {
                      setIsGuest(locationState.isGuest);
                 }
            }

            if (locationState?.initialMessage && locationState?.fromLandingPage) {
                initializationRef.current.isProcessingInitialMessage = true;
                initializationRef.current.hasProcessedInitialState = true;
                
                setMessages([]);
                setCurrentChatId(null);
                setIsNewChat(true);
                setError(null);
                
                const userMessage = {
                    id: Date.now(),
                    content: locationState.initialMessage,
                    sender: 'user',
                    role: 'user',
                    timestamp: new Date().toISOString(),
                    isGuest: !!locationState.isGuest
                };

                setMessages([userMessage]);
                
                await handleAIMessage(
                    locationState.initialMessage, 
                    !!locationState.isGuest, 
                    true, 
                    true 
                );
                
                if (window.history.replaceState) {
                    const newState = { ...locationState };
                    delete newState.initialMessage;
                    delete newState.fromLandingPage;
                    window.history.replaceState(newState, document.title, window.location.pathname);
                }
                return;
            }

            if (locationState?.selectedChatId && !isGuest) {
                initializationRef.current.hasProcessedInitialState = true;
                await handleSelectChat(locationState.selectedChatId);
                return;
            }

            if (locationState?.isGuest && !isGuest) {
                setIsGuest(true);
                setMessages([]);
                setCurrentChatId(null);
                setIsNewChat(true);
                initializationRef.current.hasProcessedInitialState = true;
                return;
            }

            initializationRef.current.hasProcessedInitialState = true;
        };

        const timeoutId = setTimeout(() => {
            processInitialState();
        }, 50);

        return () => clearTimeout(timeoutId);
    }, [location.state, isGuest, handleSelectChat, handleAIMessage]);

    // EFFECT LOAD HISTORY
    useEffect(() => {
        if (isAuthenticated && user && user.id) {
            if (isGuest) {
                const locationIsGuest = location.state?.isGuest;
                if (locationIsGuest === false || locationIsGuest === undefined) {
                      setIsGuest(false);
                }
            }
            loadChatHistory();
        }
    }, [isAuthenticated, user, isGuest, loadChatHistory, location.state]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isLoading, error]);

    // ✅ TAMPILAN LOADING
    if (loading && !isGuest) {
        return (
            <div className="flex h-screen bg-[#fbf9f6] items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // ✅ TAMPILAN REDIRECT
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
            
            <RateLimitStatus 
                isGuestMode={isGuest} 
                userName={user ? getUserName() : 'Mahasiswa'} 
            />

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
                isStartingNewChat={isStartingNewChat}
            />

            <div className="flex-1 flex flex-col overflow-hidden relative">
                <nav className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
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
                        
                        {!isGuest && currentChatId && (
                            <div className="relative">
                                <button
                                    ref={menuButtonRef}
                                    onClick={handleMenuToggle}
                                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors opacity-80 hover:opacity-100"
                                >
                                    <MoreHorizontal size={18} />
                                </button>
                                
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
                            error={error}
                        />
                    </div>
                </div>

                <div className="flex-shrink-0">
                    <ChatInput 
                        onSend={handleSendMessage} 
                        disabled={isLoading || isDeleting || isStartingNewChat || (error && (error.status === 429 || error.code === 'rate_limit_exceeded'))} 
                    />
                </div>
            </div>
        </div>
    );
};

export default ChatPage;