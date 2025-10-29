import React, { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import ChatInput from '../components/chat/ChatInput';
import axios from 'axios';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  
  // Mock user (nanti diganti dengan auth real)
  const [user, setUser] = useState({
    id: 1,
    nim: '20210120069',
    fullName: 'Muhammad Ikhsan',
  });

  // Load chat history saat pertama kali
  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      // TODO: Implementasi API get chat history
      // const response = await axios.get(`http://localhost:5000/api/chat/history/${user.id}`);
      // setChatHistory(response.data.conversations);
      
      // Mock data untuk testing
      setChatHistory([
        { id: 1, title: 'Cek IPK dan Nilai S...', createdAt: '2025-10-07' },
        { id: 2, title: 'Program Studi Taz...', createdAt: '2025-10-06' }
      ]);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleSendMessage = async (messageText) => {
    // Tambah pesan user ke UI
    const userMessage = {
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Kirim ke backend
      const response = await axios.post('http://localhost:5000/api/chat', {
        message: messageText,
        userId: user.id,
        conversationId: currentChatId
      });

      // Tambah response bot
      const botMessage = {
        role: 'bot',
        content: response.data.reply,
        createdAt: new Date().toISOString(),
        hasPDF: response.data.hasPDF || false
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      // Update conversation ID jika baru
      if (response.data.conversationId && !currentChatId) {
        setCurrentChatId(response.data.conversationId);
        loadChatHistory(); // Refresh history
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Error message
      const errorMessage = {
        role: 'bot',
        content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
  };

  const handleSelectChat = async (chatId) => {
    setCurrentChatId(chatId);
    setIsLoading(true);
    
    try {
      // Load messages dari chat yang dipilih
      const response = await axios.get(`http://localhost:5000/api/chat/history/${chatId}`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        user={user}
        chatHistory={chatHistory}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        currentChatId={currentChatId}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Messages */}
        <ChatWindow messages={messages} isLoading={isLoading} />
        
        {/* Chat Input */}
        <ChatInput
          onSend={handleSendMessage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};

export default ChatPage;