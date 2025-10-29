import React from 'react';
import { User, Bot, Download } from 'lucide-react';

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}>
      <div className={`flex max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} space-x-3`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-500 ml-3' : 'bg-gray-300 mr-3'
        }`}>
          {isUser ? <User size={18} className="text-white" /> : <Bot size={18} className="text-gray-700" />}
        </div>
        
        {/* Message Bubble */}
        <div>
          <div className={`px-4 py-3 rounded-2xl ${
            isUser 
              ? 'bg-blue-100 text-gray-800 rounded-tr-sm' 
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
          }`}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
            
            {/* PDF Download Button (jika ada) */}
            {message.hasPDF && (
              <button className="mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-gray-700">
                <Download size={16} />
                <span>Unduh Nilai Semester 2 (PDF)</span>
              </button>
            )}
          </div>
          
          {/* Timestamp */}
          <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.createdAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;