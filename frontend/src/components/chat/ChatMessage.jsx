import React, { useState, useEffect } from 'react';
import { User, Bot, Download, Copy, CheckCheck } from 'lucide-react';

// ==========================================
// 🛠️ HELPER FUNCTIONS (FORMATTING)
// ==========================================

// ✅ 1. Clean content dari teks yang tidak diinginkan
const cleanMessageContent = (text) => {
  if (!text) return '';
  return text.replace(/Invalid Date\s*$/, '').trim();
};

// ✅ 2. Deteksi dan format teks Arabic
const formatMessageWithArabic = (text) => {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  
  return text.split('\n').map((line, index) => {
    const hasArabic = arabicRegex.test(line);
    
    return (
      <div 
        key={index} 
        className={hasArabic ? 'arabic-text' : 'regular-text'}
        style={{ 
          marginBottom: '0.5rem',
          unicodeBidi: hasArabic ? 'plaintext' : 'normal'
        }}
      >
        {line}
      </div>
    );
  });
};

// ✅ 3. Format teks dengan bold untuk **teks**
const formatMessageWithBold = (text) => {
  return text.split('\n').map((line, lineIndex) => {
    if (!line.trim()) return <div key={lineIndex} className="h-3"></div>;
    
    const parts = [];
    let currentIndex = 0;
    let boldStart = line.indexOf('**');
    
    while (boldStart !== -1) {
      if (boldStart > currentIndex) {
        parts.push(
          <span key={`${lineIndex}-${currentIndex}`}>
            {line.substring(currentIndex, boldStart)}
          </span>
        );
      }
      
      const boldEnd = line.indexOf('**', boldStart + 2);
      if (boldEnd === -1) break;
      
      const boldText = line.substring(boldStart + 2, boldEnd);
      parts.push(
        <strong key={`${lineIndex}-bold-${boldStart}`} className="font-semibold text-gray-900">
          {boldText}
        </strong>
      );
      
      currentIndex = boldEnd + 2;
      boldStart = line.indexOf('**', currentIndex);
    }
    
    if (currentIndex < line.length) {
      parts.push(
        <span key={`${lineIndex}-end`}>
          {line.substring(currentIndex)}
        </span>
      );
    }
    
    return (
      <div key={lineIndex} className="mb-2 last:mb-0">
        {parts.length > 0 ? parts : line}
      </div>
    );
  });
};

// ✅ 4. Gabungkan semua formatter
const formatMessageContent = (text) => {
  if (!text) return null;

  const cleanedText = cleanMessageContent(text);
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  
  if (arabicRegex.test(cleanedText)) {
    return formatMessageWithArabic(cleanedText);
  }
  
  return formatMessageWithBold(cleanedText);
};

// ==========================================
// 💬 MAIN COMPONENT
// ==========================================

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  // State untuk efek mengetik
  const [displayContent, setDisplayContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // EFFECT: Logika Typing vs Instant Load
  useEffect(() => {
    const fullContent = message.content || '';
    
    // 1. Jika User, langsung tampilkan
    if (isUser) {
      setDisplayContent(fullContent);
      setIsTyping(false);
      return;
    }

    // 2. Cek apakah pesan ini "Baru"
    const msgTime = new Date(message.createdAt || message.timestamp || Date.now()).getTime();
    const now = Date.now();
    const isRecent = (now - msgTime) < 5000; 

    // 3. Jika History Lama -> Langsung tampilkan
    if (!isRecent) {
      setDisplayContent(fullContent);
      setIsTyping(false);
      return;
    }

    // 4. Jika Pesan Baru -> Jalankan Efek Mengetik
    setDisplayContent('');
    setIsTyping(true);

    let index = 0;
    
    // ⚡ PERCEPATAN DI SINI
    const speed = 10; // Jeda antar update lebih singkat (sebelumnya 20)
    const charsPerTick = 3; // Muncul 3 karakter sekaligus (biar ngebut)

    const intervalId = setInterval(() => {
      index += charsPerTick;
      
      if (index <= fullContent.length) {
        setDisplayContent(fullContent.slice(0, index));
      } else {
        // Pastikan karakter terakhir ter-render
        setDisplayContent(fullContent);
        clearInterval(intervalId);
        setIsTyping(false);
      }
    }, speed);

    return () => clearInterval(intervalId);
  }, [message.content, message.createdAt, message.timestamp, isUser]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cleanMessageContent(message.content));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 group`}>
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
              : 'glass-effect text-gray-800 rounded-tl-sm'
          }`}>
            
            <div className={`
              ${isUser 
                ? 'font-medium text-[15px] leading-relaxed' 
                : 'font-normal text-[15px] leading-[1.7] tracking-wide'
              }
            `}>
              {/* Teks yang diformat */}
              {formatMessageContent(displayContent)}
            </div>

            {/* Copy Button */}
            {!isUser && !isTyping && (
              <button
                onClick={handleCopy}
                className="glass-effect-copy absolute -bottom-2 -right-2 p-1.5 border border-gray-300 rounded-lg shadow-sm hover:bg-white/50 transition-all duration-300 opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                title="Salin teks"
              >
                {copied ? 
                  <CheckCheck size={14} className="text-green-500" /> : 
                  <Copy size={14} className="text-gray-600" />
                }
              </button>
            )}
            
            {/* PDF Download Button */}
            {message.hasPDF && !isTyping && (
              <button className="glass-effect-download mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white/30 hover:bg-white/40 rounded-lg transition-all duration-300 text-sm font-medium text-gray-700 backdrop-blur-sm border border-white/20">
                <Download size={16} />
                <span>Unduh Nilai Semester 2 (PDF)</span>
              </button>
            )}
          </div>
          
          {/* Timestamp */}
          <p className={`text-xs text-gray-400 mt-2 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.createdAt || message.timestamp || Date.now()).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>

      {/* CSS Styles */}
      <style jsx>{`
        .glass-effect {
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }
        
        .glass-effect-copy {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.4);
        }
        
        .glass-effect-download {
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .glass-effect:hover {
          background: rgba(255, 255, 255, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.4);
        }
        
        .arabic-text {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 18px;
          font-weight: 500;
          text-align: right;
          line-height: 1.8;
          direction: rtl;
        }
        
        .regular-text {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
      `}</style>
    </div>
  );
};

export default ChatMessage;