import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios'; // <-- DIHAPUS: Tidak terpakai
// --- PERUBAHAN: Menghapus LogOut yang tidak terpakai ---
import { Send, Plus, MessageSquare, PenSquare, User, Settings, Instagram, Globe, Youtube } from 'lucide-react';

// --- 1. Komponen Pembantu (Button) Dihapus ---
// Seluruh komponen 'Button' dihapus karena tidak terpakai (no-unused-vars)


// --- 2. Komponen Sidebar Diintegrasikan ---
// --- PERBAIKAN: Menambahkan prop isSidebarOpen dan onToggleSidebar ---
const CustomSideBar = ({ user, chatHistory, onNewChat, onSelectChat, currentChatId, navigate, isSidebarOpen, onToggleSidebar }) => {
    
    // Komponen Ikon Toggle kustom menggunakan SVG yang Anda berikan
    const ToggleIcon = ({ open }) => (
        <img 
            src="https://www.svgrepo.com/show/493722/sidebar-toggle-nav-side-aside.svg" 
            alt="Toggle Sidebar" 
            className={`w-6 h-6 text-gray-700 transition-transform duration-300 ${open ? '' : 'transform rotate-180'}`}
        />
    );

    return (
        // --- PERBAIKAN: Lebar dinamis (w-20 atau w-64) dengan transisi ---
        <div className={` ${isSidebarOpen ? 'w-64' : 'w-20'} bg-amber-50 border-r border-gray-200 flex flex-col h-screen p-3 shadow-xl transition-all duration-300 relative`}>
            
            {/* --- PERBAIKAN: LOGIKA HEADER SIDEBAR DISAMAKAN DENGAN LANDING PAGE --- */}
            {isSidebarOpen ? (
                // --- TAMPILAN TERBUKA: Settings dan Toggle sejajar (HANYA IKON) ---
                <div className="flex justify-between items-center mb-8">
                    {/* Tombol Pengaturan (Settings) - HANYA IKON */}
                    <button className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-3" title="Settings">
                        <Settings size={24} />
                    </button>
                    {/* Tombol Toggle Sidebar */}
                    <button 
                        onClick={onToggleSidebar} 
                        className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors" 
                        title="Tutup Sidebar"
                    >
                        <ToggleIcon open={true} />
                    </button>
                </div>
            ) : (
                // --- TAMPILAN TERTUTUP: HANYA TOMBOL TOGGLE ---
                <>
                    {/* Tombol Toggle Sidebar */}
                    <div className="flex justify-center mb-8">
                        <button 
                            onClick={onToggleSidebar} 
                            className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors" 
                            title="Buka Sidebar"
                        >
                            <ToggleIcon open={false} />
                        </button>
                    </div>
                    {/* Tombol Pengaturan (Settings) DIHAPUS saat tertutup */}
                </>
            )}
            {/* --- AKHIR PERBAIKAN LOGIKA HEADER --- */}


            {/* Tombol User Profile/Logout */}
            {/* --- PERBAIKAN: Layout dinamis (w-full/w-12, h-12, justify) --- */}
            <div className="flex justify-center mb-10">
                <button 
                    className={` ${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 bg-blue-500 text-white rounded-xl shadow-lg hover:bg-blue-600 transition-all flex items-center group relative gap-3`}
                    title={user ? `Logged in as ${user.fullName}` : 'User Profile'}
                    onClick={() => console.log('User Profile/Logout clicked')} 
                >
                    <User size={20} />
                    <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
                        {user ? user.fullName : 'User Profile'}
                    </span>
                </button>
            </div>

            {/* Tombol New Chat */}
            {/* --- PERBAIKAN: Layout dinamis --- */}
            <div className={`flex ${isSidebarOpen ? 'justify-start' : 'justify-center'} space-y-3`}>
                <button 
                    className={` ${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center group relative gap-3`}
                    title="New Chat"
                    onClick={onNewChat} // <-- Memicu reset chat state
                >
                    <PenSquare size={20} />
                    <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
                        New Chat
                    </span>
                </button>
            </div>
            
            {/* Tombol Chats History */}
            {/* --- PERBAIKAN: Layout dinamis --- */}
            <div className={`flex ${isSidebarOpen ? 'justify-start' : 'justify-center'} mt-3`}>
                <button 
                    className={` ${isSidebarOpen ? 'w-full justify-start p-3' : 'w-12 h-12 justify-center'} h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center group relative gap-3`}
                    title="Chats"
                    onClick={() => console.log('Open Chat History')} 
                >
                    <MessageSquare size={20} />
                    <span className={`${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'} transition-opacity whitespace-nowrap`}>
                        Riwayat Chat
                    </span>
                </button>
            </div>

            {/* Area Riwayat Chat (dibiarkan kosong untuk layout ikonik) */}
            <div className="flex-1 overflow-y-auto">
                {/* Biasanya riwayat chat diletakkan di sini jika sidebar lebih lebar */}
            </div>

            {/* --- PERUBAHAN: Footer Dots (Sidebar) diganti Social Links --- */}
            {/* --- PERBAIKAN: Layout dinamis (flex-row/flex-col, items-start/items-center) --- */}
            <div className={`mt-auto flex ${isSidebarOpen ? 'flex-col items-start gap-2' : 'flex-row items-center justify-center space-x-2'} pb-4`}>
                {/* Instagram */}
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
                
                {/* Website */}
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
                
                {/* YouTube */}
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
            {/* --- AKHIR PERUBAHAN --- */}
        </div>
    );
};

// --- 3. Komponen ChatWindow Diintegrasikan ---
const ChatWindow = ({ messages, isLoading }) => {
    
    // --- PERBAIKAN: ref dan useEffect DIPINDAHKAN ke ChatPage ---

    // Fungsi untuk mensimulasikan ikon Bot
    const BotAvatar = () => (
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><path d="M12 2a2 2 0 0 0-2 2v.5L8.5 6h7l-1.5-1.5V4a2 2 0 0 0-2-2z"/><path d="M12 22a2 2 0 0 0 2-2v-.5l1.5-1.5h-7l1.5 1.5V20a2 2 0 0 0 2 2z"/><path d="M21 12a2 2 0 0 0-2-2h-3v4h3a2 2 0 0 0 2-2z"/><path d="M3 12a2 2 0 0 1 2-2h3v4H5a2 2 0 0 1-2-2z"/></svg>
        </div>
    );
    
    const UserAvatar = ({ initial }) => (
        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
            {initial}
        </div>
    );

    if (messages.length === 0 && !isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M4 14s1.5-1 4-1 4 1 4 1v3H4z"/><path d="M18 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-700">Mulai percakapan</h2>
                <p className="text-sm">Tanyakan apa saja tentang STMIK Tazkia</p>
            </div>
        );
    }

    return (
        // --- PERBAIKAN: Tambahkan 'flex-1' agar komponen ini mengisi ruang ---
        <div className="flex-1 p-4 md:p-8 space-y-6">
            {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                const avatar = isUser ? <UserAvatar initial={'A'} /> : <BotAvatar />;
                
                return (
                    <div 
                        key={index} 
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                        {/* Avatar dan konten diatur sesuai role */}
                        <div className={`flex items-start max-w-lg md:max-w-xl ${isUser ? 'flex-row-reverse' : 'flex-row'} space-x-3 space-x-reverse`}>
                            
                            {/* Avatar */}
                            {avatar}
                            
                            {/* Message Bubble */}
                            <div className={`p-3 md:p-4 rounded-xl max-w-full shadow-md text-sm ${
                                isUser 
                                ? 'bg-blue-500 text-white rounded-tr-sm' // User: Biru, Sudut kanan atas flat
                                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm' // Bot: Putih/Abu, Sudut kiri atas flat
                            }`}>
                                <p>{msg.content}</p>
                                <p className={`mt-1 text-xs ${isUser ? 'text-blue-200' : 'text-gray-500'} text-right`}>
                                    {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
            
            {/* Loading Indicator */}
            {isLoading && (
                <div className="flex justify-start">
                    <div className="w-8 h-8 bg-gray-200 rounded-full mr-3 flex items-center justify-center">
                        <BotAvatar />
                    </div>
                    <div className="p-3 bg-white text-gray-800 rounded-xl border border-gray-200 shadow-md animate-pulse">
                        <span className="text-gray-500">Typing...</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- 4. Komponen ChatInput Diintegrasikan ---
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
                
                {/* Ikon Plus (+) di Kiri Input */}
                <button 
                    type="button"
                    className="p-2 mr-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                    title="Attach"
                    disabled={disabled}
                >
                    <Plus size={20} />
                </button>

                {/* Input */}
                <input
                    type="text"
                    placeholder="Message Sapa Tazkia"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 px-2 py-2 text-base text-gray-700 placeholder-gray-500 focus:outline-none bg-white" 
                    disabled={disabled}
                />
                
                {/* Ikon Panah/Kirim di Kanan Input */}
                <button 
                    type="submit"
                    className={`p-3 text-white rounded-full transition-colors shadow-md ml-2 ${
                        input.trim() && !disabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'
                    }`}
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
    const navigate = useNavigate(); // Untuk simulasi New Chat
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentChatId, setCurrentChatId] = useState(null);
    const [chatHistory, setChatHistory] = useState([]);

    // --- PERBAIKAN: State untuk mengontrol sidebar ---
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mulai dalam keadaan tertutup (ikonik)
    
    // --- PERBAIKAN: Pindahkan ref ke sini ---
    const chatContainerRef = useRef(null);

    const [user] = useState({
        id: 1,
        nim: '20210120069',
        fullName: 'Muhammad Ikhsan',
    });

    // ✅ useCallback agar tidak berubah tiap render
    const loadChatHistory = useCallback(async () => {
        try {
            // Simulasi API call (gunakan axios.get di implementasi Anda)
            // const response = await axios.get(`http://localhost:5000/api/chat/conversations/${user.id}`);
            // setChatHistory(response.data.conversations);
            setChatHistory([
                { id: '1', title: 'Pertanyaan UTS', createdAt: new Date(Date.now() - 86400000) },
                { id: '2', title: 'Biaya Kuliah', createdAt: new Date(Date.now() - 3600000) },
            ]);
        } catch (error) {
            console.error('Error loading chat history:', error);
            setChatHistory([]);
        }
    }, []); // <-- DIUBAH: user.id dihapus dari dependency array

    useEffect(() => {
        loadChatHistory();
    }, [loadChatHistory]);

    // --- PERBAIKAN: Pindahkan useEffect auto-scroll ke sini ---
    useEffect(() => {
        if (chatContainerRef.current) {
            // Perintahkan kontainer untuk scroll ke paling bawah
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, isLoading]); // <-- Efek ini berjalan setiap kali 'messages' atau 'isLoading' berubah

    const handleSendMessage = async (messageText) => {
        const userMessage = {
            role: 'user',
            content: messageText,
            createdAt: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            // Simulasi API call (ganti dengan axios.post di implementasi Anda)
            /*
            const response = await axios.post('http://localhost:5000/api/chat', {
                message: messageText,
                userId: user.id,
                conversationId: currentChatId,
            });

            const botMessage = {
                role: 'bot',
                content: response.data.reply,
                createdAt: new Date().toISOString(),
                hasPDF: response.data.hasPDF || false,
            };
            
            setMessages(prev => [...prev, botMessage]);
            
            if (response.data.conversationId && !currentChatId) {
                setCurrentChatId(response.data.conversationId);
                loadChatHistory();
            }
            */

            // SIMULASI RESPONSE (Hapus ini saat menggunakan axios)
            setTimeout(() => {
                const botMessage = {
                    role: 'bot',
                    content: `Terima kasih! Saya akan memproses pertanyaan tentang "${messageText}". Sebagai simulasi, ini adalah jawaban bot.`,
                    createdAt: new Date().toISOString(),
                };
                setMessages(prev => [...prev, botMessage]);
                setIsLoading(false);
            }, 1000);
            
        } catch (error) {
            console.error('Error:', error);
            const errorMessage = {
                role: 'bot',
                content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
                createdAt: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMessage]);
            setIsLoading(false);
        }
    };

    const handleNewChat = () => {
        setMessages([]);
        setCurrentChatId(null);
        // Opsional: navigasi ulang untuk memastikan reset state
        navigate('/chat'); 
    };

    const handleSelectChat = async (chatId) => {
        setCurrentChatId(chatId);
        setIsLoading(true);
        
        try {
            // Simulasi API call (ganti dengan axios.get di implementasi Anda)
            /*
            const response = await axios.get(`http://localhost:5000/api/chat/history/${chatId}`);
            setMessages(response.data.messages);
            */
            
            // SIMULASI PESAN LAMA
            setTimeout(() => {
                setMessages([
                    { role: 'user', content: `Simulasi: Pertanyaan chat ${chatId}`, createdAt: new Date(Date.now() - 1000000).toISOString() },
                    { role: 'bot', content: `Simulasi: Jawaban chat ${chatId}`, createdAt: new Date(Date.now() - 900000).toISOString() },
                ]);
                setIsLoading(false);
            }, 500);
            
        } catch (error) {
            console.error('Error:', error);
            setIsLoading(false);
        }
    };

    // --- PERBAIKAN: Fungsi untuk toggle sidebar ---
    const handleToggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    return (
        <div className="flex h-screen bg-[#fbf9f6] font-sans">
            
            {/* 1. Sidebar Kiri (Lebar 20) */}
            {/* --- PERBAIKAN: Kirim prop state sidebar --- */}
            <CustomSideBar 
                user={user}
                chatHistory={chatHistory}
                onNewChat={handleNewChat}
                onSelectChat={handleSelectChat}
                currentChatId={currentChatId}
                navigate={navigate}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={handleToggleSidebar}
            />

            {/* 2. Main Content Area */}
            {/* --- PERBAIKAN: Tambahkan overflow-hidden agar kontainer ini tidak scroll --- */}
            <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Header Chat */}
                <nav className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200">
                    <h1 
                        className="text-xl font-bold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => navigate('/')}
                    >
                        Sapa Tazkia
                    </h1>
                    {/* Tombol Logout Dihapus */}
                </nav>

                {/* Area Utama Chat (ChatWindow) */}
                {/* --- PERBAIKAN: Div ini HANYA untuk scroll --- */}
                <div 
                    ref={chatContainerRef} 
                    className="flex-1 overflow-y-auto relative"
                >
                    {/* Pembungkus untuk menengahkan ChatWindow */}
                    {/* --- PERBAIKAN: Tambahkan flex-1 dan flex-col agar 'Mulai Percakapan' bisa di tengah --- */}
                    <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col">
                        
                        {/* Jendela Chat (Sekarang di dalam area scroll) */}
                        <ChatWindow messages={messages} isLoading={isLoading} />
                        
                        {/* Input Chat dan Footer DIPINDAHKAN KELUAR dari div ini */}
                    </div>
                </div>

                {/* --- PERBAIKAN: Wrapper untuk Input dan Footer (DI LUAR area scroll) --- */}
                <div>
                    {/* Input Chat (Sekarang diam di bawah) */}
                    <ChatInput onSend={handleSendMessage} disabled={isLoading} />
                    
                    {/* Footer (Sekarang diam di bawah) */}
                    {/* --- PERBAIKAN: Hapus pt-6, tambahkan bg-white agar seragam --- */}
                    <div className="flex justify-center items-center space-x-2 px-6 pb-7 bg-[#fbf9f6]">
                        {/* Instagram */}
                        <a 
                            href="https://www.instagram.com/stmiktazkia_official/" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            title="Instagram"
                            className="text-gray-500 hover:text-pink-500 transition-colors"
                        >
                            <Instagram size={16} />
                        </a>
                        
                        {/* Website */}
                        <a 
                            href="https://stmik.tazkia.ac.id/" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            title="Website"
                            className="text-gray-500 hover:text-blue-500 transition-colors"
                        >
                            <Globe size={16} />
                        </a>
                        
                        {/* YouTube */}
                        <a 
                            href="https://www.youtube.com/@stmiktazkia" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            title="YouTube"
                            className="text-gray-500 hover:text-red-500 transition-colors"
                        >
                            <Youtube size={16} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatPage;

