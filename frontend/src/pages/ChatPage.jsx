import React, { useState, useEffect, useCallback } from 'react';
import SideBar from '../components/layout/SideBar';
import ChatWindow from '../components/chat/ChatWindow';
import ChatInput from '../components/chat/ChatInput';
import axios from 'axios';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  
  const [user] = useState({
    id: 1,
    nim: '20210120069',
    fullName: 'Muhammad Ikhsan',
  });

  // ✅ useCallback agar tidak berubah tiap render
  const loadChatHistory = useCallback(async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/chat/conversations/${user.id}`);
      setChatHistory(response.data.conversations);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setChatHistory([]);
    }
  }, [user.id]);

  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  const handleSendMessage = async (messageText) => {
    const userMessage = {
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
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
      
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        role: 'bot',
        content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
        createdAt: new Date().toISOString(),
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
      const response = await axios.get(`http://localhost:5000/api/chat/history/${chatId}`);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <SideBar
        user={user}
        chatHistory={chatHistory}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        currentChatId={currentChatId}
      />

      <div className="flex-1 flex flex-col">
        <ChatWindow messages={messages} isLoading={isLoading} />
        <ChatInput onSend={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};

export default ChatPage;
