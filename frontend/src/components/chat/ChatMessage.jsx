import React, { useState, useEffect } from 'react';
import { User, Bot, Download, Copy, CheckCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ==========================================
// 🛠️ HELPER FUNCTIONS (FORMATTING)
// ==========================================

// ✅ 1. Clean content dari teks yang tidak diinginkan
const cleanMessageContent = (text) => {
  if (!text) return '';
  return text.replace(/Invalid Date\s*$/, '').trim();
};

// ✅ Shared Arabic detection regex
const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

// ✅ Full markdown renderer — used for completed bot messages only (not during typing animation)
const MarkdownRenderer = ({ content }) => {
  const hasArabic = arabicRegex.test(content);

  return (
    <div className={`markdown-body${hasArabic ? ' rtl' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            if (!inline && match) {
              return (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ borderRadius: '8px', fontSize: '0.875rem', marginBottom: '0.75rem' }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              );
            }
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            );
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          p({ children }) {
            const text = typeof children === 'string' ? children : '';
            if (arabicRegex.test(text)) {
              return (
                <p dir="rtl" style={{ unicodeBidi: 'plaintext', textAlign: 'right', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", fontSize: '18px', fontWeight: '500', lineHeight: '1.8', marginBottom: '0.5rem' }}>
                  {children}
                </p>
              );
            }
            return <p>{children}</p>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// ✅ 2. Deteksi dan format teks Arabic
const formatMessageWithArabic = (text) => {

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
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-500 ml-3' : 'bg-gradient-to-br from-gray-400 to-gray-600 mr-3'
          }`}>
          {isUser ?
            <User size={16} className="text-white" /> :
            <Bot size={16} className="text-white" />
          }
        </div>

        {/* Message Content */}
        <div className="flex-1">
          <div className={`relative px-4 py-3 rounded-2xl ${isUser
              ? 'bg-blue-500 text-white rounded-tr-sm'
              : 'glass-effect text-gray-800 rounded-tl-sm'
            }`}>

            <div className={`
              ${isUser
                ? 'font-medium text-[15px] leading-relaxed'
                : 'font-normal text-[15px] leading-[1.7] tracking-wide'
              }
            `}>
              {isUser ? (
                // User messages: always plain text, no markdown
                displayContent
              ) : isTyping ? (
                // Bot messages during typing animation: plain text to avoid markdown flicker
                // (partial markdown like **text or ```code can look broken mid-animation)
                formatMessageContent(displayContent)
              ) : (
                // Bot messages after animation completes: full markdown
                // Use message.content (not displayContent) — both are equal at this point,
                // but message.content is the canonical source and avoids stale partial text
                // if the component re-renders during the final animation tick.
                <div style={{ opacity: 1, transition: 'opacity 0.15s ease-in' }}>
                  <MarkdownRenderer content={cleanMessageContent(message.content)} />
                </div>
              )}
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
      <style>{`
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
        .markdown-body p { margin-bottom: 0.75rem; line-height: 1.7; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
          font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: #1f2937;
        }
        .markdown-body h1 { font-size: 1.25rem; }
        .markdown-body h2 { font-size: 1.125rem; }
        .markdown-body h3 { font-size: 1rem; }
        .markdown-body ul, .markdown-body ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .markdown-body ul { list-style-type: disc; }
        .markdown-body ol { list-style-type: decimal; }
        .markdown-body li { margin-bottom: 0.25rem; line-height: 1.6; }
        .markdown-body table { width: 100%; border-collapse: collapse; margin-bottom: 0.75rem; font-size: 0.875rem; }
        .markdown-body th, .markdown-body td { border: 1px solid rgba(0,0,0,0.15); padding: 0.4rem 0.75rem; text-align: left; }
        .markdown-body th { background: rgba(0,0,0,0.06); font-weight: 600; }
        .markdown-body tr:nth-child(even) { background: rgba(0,0,0,0.03); }
        .markdown-body blockquote { border-left: 3px solid rgba(0,0,0,0.2); padding-left: 0.75rem; margin: 0.5rem 0; color: rgba(0,0,0,0.6); font-style: italic; }
        .markdown-body .inline-code { background: rgba(0,0,0,0.08); padding: 0.1rem 0.35rem; border-radius: 4px; font-family: 'Courier New', Courier, monospace; font-size: 0.875em; color: #c7254e; }
        .markdown-body a { color: #2563eb; text-decoration: underline; }
        .markdown-body a:hover { color: #1d4ed8; }
        .markdown-body hr { border: none; border-top: 1px solid rgba(0,0,0,0.1); margin: 1rem 0; }
        .markdown-body.rtl { direction: rtl; text-align: right; }
        .markdown-body strong { font-weight: 600; color: #111827; }
        .markdown-body em { font-style: italic; }
      `}</style>
    </div>
  );
};

export default ChatMessage;