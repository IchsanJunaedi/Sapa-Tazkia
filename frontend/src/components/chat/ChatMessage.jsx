import React, { useState } from 'react';
import { User, Bot, Download, Copy, CheckCheck } from 'lucide-react';

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`flex max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-500 ml-3' : 'bg-gradient-to-br from-gray-400 to-gray-600 mr-3'
        }`}>
          {isUser ? 
            <User size={16} className="text-white" /> : 
            <Bot size={16} className="text-white" />
          }
        </div>
        
        {/* Message Content */}
        <div className="flex-1">
          <div className={`relative px-4 py-3 rounded-2xl ${
            isUser 
              ? 'bg-blue-500 text-white rounded-tr-sm' 
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
          }`}>
            
            {/* Message Text dengan optimized font */}
            <div className={`
              whitespace-pre-wrap
              ${isUser 
                ? 'font-medium text-[15px] leading-relaxed'  // User
                : 'font-normal text-[15px] leading-[1.7] tracking-wide'  // AI - optimized untuk readability
              }
            `}>
              {message.content}
            </div>

            {/* Copy Button untuk AI Messages */}
            {!isUser && (
              <button
                onClick={handleCopy}
                className="absolute -bottom-2 -right-2 p-1.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors opacity-0 group-hover:opacity-100"
                title="Salin teks"
              >
                {copied ? 
                  <CheckCheck size={14} className="text-green-500" /> : 
                  <Copy size={14} className="text-gray-500" />
                }
              </button>
            )}
            
            {/* PDF Download Button */}
            {message.hasPDF && (
              <button className="mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-gray-700">
                <Download size={16} />
                <span>Unduh Nilai Semester 2 (PDF)</span>
              </button>
            )}
          </div>
          
          {/* Timestamp */}
          <p className={`text-xs text-gray-400 mt-2 ${isUser ? 'text-right' : 'text-left'}`}>
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