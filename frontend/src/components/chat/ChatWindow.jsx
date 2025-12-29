import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, Clock, User, Bot, Download, Copy, CheckCheck, RotateCcw } from 'lucide-react';

// ==========================================
// 🛠️ HELPER FUNCTIONS (FORMATTING)
// ==========================================

// 1. Clean content dari teks yang tidak diinginkan
const cleanMessageContent = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/Invalid Date\s*$/, '').trim();
};

// 2. Deteksi dan format teks Arabic
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

// 3. Format teks dengan link clickable (Support Markdown & Raw URL)
const formatMessageWithLinks = (text) => {
  if (typeof text !== 'string') return text;

  // Regex untuk Markdown [label](url)
  const markdownRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  // Regex untuk URL mentah (mendukung domain umum)
  const rawUrlRegex = /(https?:\/\/[^\s<]+[^.,\s<)])|(\b(?:[a-z0-9-]+\.)+(?:ac\.id|id|com|net|org|edu|gov)\b(?:[^\s,.<)]*[^\s,.<)])?)/gi;

  const parts = [];
  let lastIndex = 0;
  const matches = [];

  // Cari semua Link Markdown
  let match;
  while ((match = markdownRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      label: match[1],
      url: match[2],
      type: 'markdown'
    });
  }

  // Cari semua URL mentah yang tidak berada di dalam Link Markdown
  while ((match = rawUrlRegex.exec(text)) !== null) {
    const isOverlapping = matches.some(m =>
      (match.index >= m.index && match.index < m.index + m.length) ||
      (m.index >= match.index && m.index < match.index + match[0].length)
    );

    if (!isOverlapping) {
      matches.push({
        index: match.index,
        length: match[0].length,
        label: match[0],
        url: match[0],
        type: 'raw'
      });
    }
  }

  // Urutkan berdasarkan posisi index
  matches.sort((a, b) => a.index - b.index);

  // Susun output
  matches.forEach((m, i) => {
    if (m.index > lastIndex) {
      parts.push(text.substring(lastIndex, m.index));
    }

    const href = m.url.startsWith('http') ? m.url : `https://${m.url}`;

    parts.push(
      <a
        key={`link-${m.index}-${i}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline decoration-blue-500/30 hover:decoration-blue-700 transition-all font-medium px-0.5"
      >
        {m.label}
      </a>
    );

    lastIndex = m.index + m.length;
  });

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

// 4. Format teks dengan bold untuk **teks**
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
            {formatMessageWithLinks(line.substring(currentIndex, boldStart))}
          </span>
        );
      }

      const boldEnd = line.indexOf('**', boldStart + 2);
      if (boldEnd === -1) break;

      const boldText = line.substring(boldStart + 2, boldEnd);
      parts.push(
        <strong key={`${lineIndex}-bold-${boldStart}`} className="font-semibold text-gray-900">
          {formatMessageWithLinks(boldText)}
        </strong>
      );

      currentIndex = boldEnd + 2;
      boldStart = line.indexOf('**', currentIndex);
    }

    if (currentIndex < line.length) {
      parts.push(
        <span key={`${lineIndex}-end`}>
          {formatMessageWithLinks(line.substring(currentIndex))}
        </span>
      );
    }

    return (
      <div key={lineIndex} className="mb-2 last:mb-0">
        {parts.length > 0 ? parts : formatMessageWithLinks(line)}
      </div>
    );
  });
};

// 5. Gabungkan semua formatter
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
// 💬 INTERNAL COMPONENT: Single Chat Message
// ==========================================

// ✅ UPDATE: Terima prop onDownloadPDF dan onRetry
const SingleChatMessage = ({ message, onDownloadPDF, onRetry }) => {
  const isUser = message.role === 'user';
  const isCancelledOrError = message.isCancelled || message.isError;
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

    // 4. Jika Streaming / Selesai Streaming -> Langsung tampilkan (bypass typewriter)
    if (message.isStreaming || message.isStreamComplete) {
      setDisplayContent(fullContent);
      setIsTyping(false);
      return;
    }

    // 5. Jika Pesan Baru (Non-Stream) -> Jalankan Efek Mengetik
    setDisplayContent('');
    setIsTyping(true);

    let index = 0;
    const speed = 10; // Kecepatan ketik
    const charsPerTick = 3;

    const intervalId = setInterval(() => {
      index += charsPerTick;

      if (index <= fullContent.length) {
        setDisplayContent(fullContent.slice(0, index));
      } else {
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 group w-full`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-500 ml-3' : 'bg-gradient-to-br from-gray-400 to-gray-600 mr-3'
          }`}>
          {isUser ?
            <User size={16} className="text-white" /> :
            <Bot size={16} className="text-white" />
          }
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className={`relative px-4 py-3 rounded-2xl shadow-sm ${isUser
            ? 'bg-blue-500 text-white rounded-tr-sm'
            : isCancelledOrError
              ? 'bg-orange-50 text-gray-600 rounded-tl-sm border border-orange-200'
              : 'glass-effect text-gray-800 rounded-tl-sm bg-white border border-gray-100'
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
                className="glass-effect-copy absolute -bottom-2 -right-2 p-1.5 border border-gray-300 rounded-lg shadow-sm hover:bg-white/50 transition-all duration-300 opacity-0 group-hover:opacity-100 backdrop-blur-sm bg-white"
                title="Salin teks"
              >
                {copied ?
                  <CheckCheck size={14} className="text-green-500" /> :
                  <Copy size={14} className="text-gray-600" />
                }
              </button>
            )}

            {/* ✅ PDF Download Button (UPDATED) */}
            {/* Cek hasPdfButton (dari ChatPage) atau hasPDF (legacy) */}
            {(message.hasPdfButton || message.hasPDF) && !isTyping && (
              <button
                onClick={onDownloadPDF} // ✅ Panggil fungsi download
                className="glass-effect-download mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-white/30 hover:bg-white/40 rounded-lg transition-all duration-300 text-sm font-medium text-gray-700 backdrop-blur-sm border border-white/20 hover:text-orange-600 hover:border-orange-200"
              >
                <Download size={16} />
                <span>Download Transkrip PDF</span>
              </button>
            )}
          </div>

          {/* Timestamp + Retry Button */}
          <div className={`flex items-center mt-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <p className="text-xs text-gray-400">
              {new Date(message.createdAt || message.timestamp || Date.now()).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>

            {/* ✅ NEW: Retry Button untuk cancelled/error messages */}
            {isCancelledOrError && !isTyping && onRetry && (
              <button
                onClick={onRetry}
                className="ml-2 p-1.5 bg-orange-100 hover:bg-orange-200 rounded-lg transition-all duration-200 group/retry"
                title="Coba lagi"
              >
                <RotateCcw size={14} className="text-orange-600 group-hover/retry:rotate-[-45deg] transition-transform duration-200" />
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

// ==========================================
// 🚀 MAIN COMPONENT: Chat Window Container
// ==========================================

// ✅ UPDATE: Terima prop onDownloadPDF dan onRetry
const ChatWindow = ({ messages, isLoading, error, onDownloadPDF, onRetry }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, error]);

  // --- ERROR RENDERER ---
  const renderErrorState = () => {
    if (!error) return null;

    const isRateLimit = error.code === 'rate_limit_exceeded' || error.status === 429;

    if (isRateLimit) {
      return (
        <div className="flex justify-center my-6 animate-in fade-in slide-in-from-bottom-4 w-full">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-w-md shadow-sm w-full mx-4">
            <div className="flex items-start space-x-3">
              <div className="bg-red-100 p-2 rounded-full flex-shrink-0">
                <Clock className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-800">Batas Penggunaan Tercapai</h3>
                <p className="text-sm text-red-700 mt-1">
                  {error.message || "Kuota token harian Anda telah habis."}
                </p>
                <div className="mt-3 flex items-center space-x-2 text-xs text-red-600 font-medium">
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

    // Generic Error
    return (
      <div className="flex justify-center my-4 w-full px-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-center shadow-sm max-w-lg w-full">
          <AlertCircle className="w-5 h-5 text-orange-500 mr-2 flex-shrink-0" />
          <span className="text-sm text-gray-700">{error.message || "Terjadi kesalahan sistem"}</span>
        </div>
      </div>
    );
  };

  // --- EMPTY STATE (Tampilan Awal) ---
  if (messages.length === 0 && !error && !isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-0 animate-in fade-in duration-700 opacity-100">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6 shadow-sm animate-bounce-slow">
          <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Sapa Tazkia AI
        </h2>
        <p className="text-gray-500 max-w-sm leading-relaxed">
          Tanyakan apa saja tentang Tazkia. <br />
        </p>
      </div>
    );
  }

  // --- CONTENT STATE (Daftar Pesan) ---
  return (
    <div className="flex flex-col space-y-2 pb-4 w-full">

      {messages.map((msg, index) => (
        <SingleChatMessage
          key={index}
          message={msg}
          onDownloadPDF={onDownloadPDF}
          onRetry={onRetry}  // ✅ Pass Retry handler ke child
        />
      ))}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 pl-2">
          <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
            <Loader2 size={16} className="animate-spin text-orange-500" />
            <span className="text-sm text-gray-500 font-medium">Sedang berpikir...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {renderErrorState()}

      {/* Invisible element for auto-scroll */}
      <div ref={messagesEndRef} className="h-1" />

      {/* CSS Styles - Moved to Window level to avoid redundancy */}
      <style>{`
        .glass-effect {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(229, 231, 235, 0.5);
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

export default ChatWindow;