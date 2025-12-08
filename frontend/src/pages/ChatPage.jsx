import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosConfig';
import { sendMessageToAI } from '../api/aiService'; 
import { Plus, ArrowUp, MoreHorizontal, Trash2 } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import Sidebar from '../components/layout/SideBar';
import ChatWindow from '../components/chat/ChatWindow'; 
import RateLimitStatus from '../components/common/RateLimitStatus'; 

// --- Komponen ChatInput (FIXED: Direct DOM Manipulation) ---
const ChatInput = ({ onSend, disabled }) => {
    const [input, setInput] = useState('');
    const textareaRef = useRef(null);
    const formRef = useRef(null);

    // Batas Maksimal 250 Karakter
    const MAX_CHARS = 250;
    const isTooLong = input.length > MAX_CHARS;

    const adjustHeightAndShape = () => {
        const textarea = textareaRef.current;
        const form = formRef.current;
        
        if (textarea && form) {
            textarea.style.height = 'auto'; 
            const currentHeight = textarea.scrollHeight;
            textarea.style.height = `${Math.min(currentHeight, 150)}px`;

            if (currentHeight > 52) {
                form.style.borderRadius = '1.5rem'; 
            } else {
                form.style.borderRadius = '30px'; 
            }
        }
    };

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        
        if (input.trim() && !isTooLong && !disabled) {
            onSend(input.trim());
            setInput('');
            
            if (textareaRef.current && formRef.current) {
                textareaRef.current.style.height = 'auto';
                formRef.current.style.borderRadius = '30px';
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    useLayoutEffect(() => {
        adjustHeightAndShape();
    }, [input]);

    const isButtonEnabled = input.trim() && !isTooLong && !disabled;

    return (
        <div className="p-4 md:p-6 border-t border-gray-200 flex justify-center bg-[#fef6e4]">
            <form 
                ref={formRef}
                onSubmit={handleSubmit} 
                // ✅ [FIX 1] Hapus 'overflow-hidden' agar tooltip bisa keluar dari kotak
                className="w-full max-w-3xl flex items-end p-2 bg-white border border-gray-300 shadow-xl transition-all duration-200 ease-out relative"
                style={{ borderRadius: '30px' }} 
            >
                <button type="button" className="p-2 mb-1 mr-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0 h-10 w-10 flex items-center justify-center" title="Attach" disabled={disabled}>
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
                    // ✅ [FIX 2] Hapus logic warna merah. Tetap gray-700 selamanya.
                    className="flex-1 py-3 px-2 text-base text-gray-700 placeholder-gray-500 focus:outline-none bg-white resize-none max-h-[150px]"
                    style={{ 
                        lineHeight: '1.5', 
                        minHeight: '44px' 
                    }}
                />
                
                {/* Wrapper div untuk Logic Tooltip & Button */}
                <div className="relative group mb-1 ml-2 flex-shrink-0">
                    <button
                        type="submit"
                        disabled={!isButtonEnabled}
                        className={`h-10 w-10 flex items-center justify-center rounded-full transition-colors shadow-md ${
                            isButtonEnabled 
                            ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                            : 'bg-gray-300 cursor-not-allowed text-gray-500'
                        }`}
                        aria-label="Send Message"
                    >
                        <ArrowUp size={20} />
                    </button>

                    {/* Tooltip: Sekarang posisinya aman karena overflow form sudah dibuka */}
                    {isTooLong && (
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-max px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg z-50">
                            Message is too long
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

// --- Komponen Utama ChatPage (TIDAK ADA PERUBAHAN LOGIC) ---
const ChatPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
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
        hasRestoredFromUrl: false 
    });

    // 3. IS NEW CHAT INITIALIZATION
    const [isNewChat, setIsNewChat] = useState(() => {
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

    // EMERGENCY BRIDGE EFFECT (RESTORE FROM URL)
    useEffect(() => {
        if (chatId && isAuthenticated && !isGuest && !initializationRef.current.hasRestoredFromUrl) {
            if (messages.length === 0 || currentChatId !== chatId) {
                console.log(`🔄 [CHAT PAGE] Restoring chat from URL: ${chatId}`);
                
                initializationRef.current.hasRestoredFromUrl = true;
                
                setCurrentChatId(chatId);
                setIsNewChat(false);
                setIsLoading(true);
                setError(null);

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
            setError(null);
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

    // HANDLE AI MESSAGE UPDATED
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
    }, [currentChatId, loadChatHistory, isNewChat, navigate]); 

    const handleSendMessage = async (messageText) => {
        if (!isGuest && (!isAuthenticated || !user)) {
            navigate('/');
            return;
        }

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