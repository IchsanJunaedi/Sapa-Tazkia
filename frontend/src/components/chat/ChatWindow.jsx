import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Clock, User, Bot, Download, Copy, CheckCheck, RotateCcw } from 'lucide-react';

// ==========================================
// 🛠️ HELPER FUNCTIONS (FORMATTING)
// ==========================================

const cleanMessageContent = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/Invalid Date\s*$/, '').trim();
};

const formatMessageWithArabic = (text) => {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return text.split('\n').map((line, index) => {
    const hasArabic = arabicRegex.test(line);
    return (
      <div
        key={index}
        className={hasArabic ? 'arabic-text' : 'regular-text'}
        style={{ marginBottom: '0.5rem', unicodeBidi: hasArabic ? 'plaintext' : 'normal' }}
      >
        {line}
      </div>
    );
  });
};

const formatMessageWithLinks = (text) => {
  if (typeof text !== 'string') return text;
  const markdownRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const rawUrlRegex = /(https?:\/\/[^\s<]+[^.,\s<)])|(\b(?:[a-z0-9-]+\.)+(?:ac\.id|id|com|net|org|edu|gov)\b(?:[^\s,.<)]*[^\s,.<)])?)/gi;
  const parts = [];
  let lastIndex = 0;
  const matches = [];
  let match;
  while ((match = markdownRegex.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length, label: match[1], url: match[2], type: 'markdown' });
  }
  while ((match = rawUrlRegex.exec(text)) !== null) {
    const isOverlapping = matches.some(m =>
      (match.index >= m.index && match.index < m.index + m.length) ||
      (m.index >= match.index && m.index < match.index + match[0].length)
    );
    if (!isOverlapping) {
      matches.push({ index: match.index, length: match[0].length, label: match[0], url: match[0], type: 'raw' });
    }
  }
  matches.sort((a, b) => a.index - b.index);
  matches.forEach((m, i) => {
    if (m.index > lastIndex) parts.push(text.substring(lastIndex, m.index));
    const href = m.url.startsWith('http') ? m.url : `https://${m.url}`;
    parts.push(
      <a key={`link-${m.index}-${i}`} href={href} target="_blank" rel="noopener noreferrer"
        className="text-blue-200 hover:text-blue-100 underline decoration-blue-200/40 hover:decoration-blue-100 transition-all font-medium px-0.5">
        {m.label}
      </a>
    );
    lastIndex = m.index + m.length;
  });
  if (lastIndex < text.length) parts.push(text.substring(lastIndex));
  return parts.length > 0 ? parts : text;
};

const formatMessageWithBold = (text) => {
  return text.split('\n').map((line, lineIndex) => {
    if (!line.trim()) return <div key={lineIndex} className="h-3"></div>;
    const parts = [];
    let currentIndex = 0;
    let boldStart = line.indexOf('**');
    while (boldStart !== -1) {
      if (boldStart > currentIndex) {
        parts.push(<span key={`${lineIndex}-${currentIndex}`}>{formatMessageWithLinks(line.substring(currentIndex, boldStart))}</span>);
      }
      const boldEnd = line.indexOf('**', boldStart + 2);
      if (boldEnd === -1) break;
      const boldText = line.substring(boldStart + 2, boldEnd);
      parts.push(
        <strong key={`${lineIndex}-bold-${boldStart}`} className="font-semibold text-white">
          {formatMessageWithLinks(boldText)}
        </strong>
      );
      currentIndex = boldEnd + 2;
      boldStart = line.indexOf('**', currentIndex);
    }
    if (currentIndex < line.length) {
      parts.push(<span key={`${lineIndex}-end`}>{formatMessageWithLinks(line.substring(currentIndex))}</span>);
    }
    return (
      <div key={lineIndex} className="mb-2 last:mb-0">
        {parts.length > 0 ? parts : formatMessageWithLinks(line)}
      </div>
    );
  });
};

const formatMessageContent = (text) => {
  if (!text || typeof text !== 'string') return null;
  const cleanedText = cleanMessageContent(text);
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (arabicRegex.test(cleanedText)) {
    return formatMessageWithArabic(cleanedText).map(element => {
      if (element.props && element.props.children) {
        return React.cloneElement(element, {}, formatMessageWithLinks(element.props.children));
      }
      return element;
    });
  }
  return formatMessageWithBold(cleanedText);
};

// ==========================================
// 💬 TYPING INDICATOR
// ==========================================

const TypingIndicator = () => (
  <div className="flex justify-start mb-6 w-full">
    <div className="flex flex-row">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ai-avatar mr-3">
        <Bot size={16} className="text-white" />
      </div>
      <div className="ai-bubble px-5 py-4 flex items-center space-x-1.5">
        <div className="typing-dot"></div>
        <div className="typing-dot"></div>
        <div className="typing-dot"></div>
      </div>
    </div>
  </div>
);

// ==========================================
// 💬 SINGLE CHAT MESSAGE
// ==========================================

const SingleChatMessage = ({ message, onDownloadPDF, onRetry }) => {
  const isUser = message.role === 'user';
  const isCancelledOrError = message.isCancelled || message.isError;
  const [copied, setCopied] = useState(false);
  const [displayContent, setDisplayContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const fullContent = message.content || '';
    if (isUser) {
      setDisplayContent(fullContent);
      setIsTyping(false);
      return;
    }
    const msgTime = new Date(message.createdAt || message.timestamp || Date.now()).getTime();
    const isRecent = (Date.now() - msgTime) < 5000;
    if (!isRecent) {
      setDisplayContent(fullContent);
      setIsTyping(false);
      return;
    }
    if (message.isStreaming || message.isStreamComplete) {
      setDisplayContent(fullContent);
      setIsTyping(false);
      return;
    }
    setDisplayContent('');
    setIsTyping(true);
    let index = 0;
    const intervalId = setInterval(() => {
      index += 3;
      if (index <= fullContent.length) {
        setDisplayContent(fullContent.slice(0, index));
      } else {
        setDisplayContent(fullContent);
        clearInterval(intervalId);
        setIsTyping(false);
      }
    }, 10);
    return () => clearInterval(intervalId);
  }, [message.content, message.createdAt, message.timestamp, isUser]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cleanMessageContent(message.content));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 group w-full`}>
      <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'}`} style={{ maxWidth: isUser ? '70%' : '85%' }}>

        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'user-avatar ml-3' : 'ai-avatar mr-3'
        }`}>
          {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className={`relative ${
            isUser
              ? 'user-bubble px-[18px] py-3'
              : isCancelledOrError
                ? 'error-bubble px-[18px] py-3'
                : 'ai-bubble px-[18px] py-[14px]'
          }`}>

            <div className={`${
              isUser
                ? 'font-medium text-[15px] leading-relaxed text-white'
                : isCancelledOrError
                  ? 'font-normal text-[15px] leading-[1.7] text-orange-200'
                  : 'font-normal text-[15px] leading-[1.7] tracking-wide text-white'
            }`}>
              {formatMessageContent(displayContent)}
            </div>

            {/* Copy Button */}
            {!isUser && !isTyping && (
              <button
                onClick={handleCopy}
                className="absolute -bottom-2 -right-2 p-1.5 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
                title="Salin teks"
              >
                {copied
                  ? <CheckCheck size={14} className="text-green-300" />
                  : <Copy size={14} className="text-white/70" />
                }
              </button>
            )}

            {/* PDF Download Button */}
            {(message.hasPdfButton || message.hasPDF) && !isTyping && (
              <button
                onClick={onDownloadPDF}
                className="mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 text-sm font-medium text-white"
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <Download size={16} />
                <span>Download Transkrip PDF</span>
              </button>
            )}
          </div>

          {/* Timestamp + Retry */}
          <div className={`flex items-center mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '4px', textAlign: isUser ? 'right' : 'left' }}>
              {new Date(message.createdAt || message.timestamp || Date.now()).toLocaleTimeString('id-ID', {
                hour: '2-digit', minute: '2-digit'
              })}
            </p>
            {isCancelledOrError && !isTyping && onRetry && (
              <button
                onClick={onRetry}
                className="ml-2 p-1.5 rounded-lg transition-all duration-200 group/retry"
                style={{ background: 'rgba(251,146,60,0.2)', border: '1px solid rgba(251,146,60,0.3)' }}
                title="Coba lagi"
              >
                <RotateCcw size={14} className="text-orange-300 group-hover/retry:rotate-[-45deg] transition-transform duration-200" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 🚀 MAIN: Chat Window Container
// ==========================================

const ChatWindow = ({ messages, isLoading, error, onDownloadPDF, onRetry }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, error]);

  const renderErrorState = () => {
    if (!error) return null;
    const isRateLimit = error.code === 'rate_limit_exceeded' || error.status === 429;
    if (isRateLimit) {
      return (
        <div className="flex justify-center my-6 w-full">
          <div className="rounded-xl p-4 max-w-md w-full mx-4" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-full flex-shrink-0" style={{ background: 'rgba(239,68,68,0.2)' }}>
                <Clock className="w-5 h-5 text-red-300" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-200">Batas Penggunaan Tercapai</h3>
                <p className="text-sm text-red-300 mt-1">{error.message || "Kuota token harian Anda telah habis."}</p>
                <div className="mt-3 flex items-center space-x-2 text-xs text-red-300 font-medium">
                  <span>⏳ Coba lagi nanti</span>
                  <span>•</span>
                  <span>Login untuk kuota lebih banyak</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-center my-4 w-full px-4">
        <div className="rounded-lg px-4 py-3 flex items-center max-w-lg w-full" style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}>
          <AlertCircle className="w-5 h-5 text-orange-300 mr-2 flex-shrink-0" />
          <span className="text-sm text-orange-200">{error.message || "Terjadi kesalahan sistem"}</span>
        </div>
      </div>
    );
  };

  if (messages.length === 0 && !error && !isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-0 animate-in fade-in duration-700 opacity-100">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-bounce-slow"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)' }}>
          <svg className="w-10 h-10 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">Sapa Tazkia AI</h2>
        <p className="text-white/50 max-w-sm leading-relaxed">Tanyakan apa saja tentang Tazkia.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2 pt-4 pb-4 w-full">
      {messages.map((msg, index) => (
        <SingleChatMessage key={index} message={msg} onDownloadPDF={onDownloadPDF} onRetry={onRetry} />
      ))}

      {isLoading && <TypingIndicator />}

      {renderErrorState()}

      <div ref={messagesEndRef} className="h-1" />

      <style>{`
        /* ── Keyframes ── */
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes slideUpFade {
          from { transform: translateY(10px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%           { transform: translateY(-6px); }
        }

        /* ── User Bubble ── */
        .user-bubble {
          background: rgba(99, 102, 241, 0.45);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 18px 18px 4px 18px;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
          animation: slideInRight 0.3s ease-out;
          transition: background 0.2s ease;
        }
        .user-bubble:hover {
          background: rgba(99, 102, 241, 0.55);
        }

        /* ── AI Bubble ── */
        .ai-bubble {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 18px 18px 18px 4px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          animation: slideUpFade 0.4s ease;
        }

        /* ── Error/Cancelled Bubble ── */
        .error-bubble {
          background: rgba(251, 146, 60, 0.18);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(251, 146, 60, 0.3);
          border-radius: 18px 18px 18px 4px;
          animation: slideUpFade 0.4s ease;
        }

        /* ── Avatars ── */
        .user-avatar {
          background: rgba(99, 102, 241, 0.6);
          border: 1px solid rgba(255,255,255,0.25);
        }
        .ai-avatar {
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255,255,255,0.2);
        }

        /* ── Typing Dots ── */
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.6);
          animation: typingBounce 1.2s infinite ease-in-out;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        /* ── Text inside bubbles ── */
        .arabic-text {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 18px;
          font-weight: 500;
          text-align: right;
          line-height: 1.8;
          direction: rtl;
        }
        .regular-text {
          font-family: 'Satoshi', sans-serif;
        }
      `}</style>
    </div>
  );
};

export default ChatWindow;
