import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, ArrowRight, Mic, Paperclip } from 'lucide-react';

const ChatInput = ({ onSend, disabled = false }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Additional Actions */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center space-x-2">
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
              title="Voice input"
            >
              <Mic size={16} />
            </button>
          </div>
          
          <span className="text-xs text-gray-400">
            {input.length}/2000
          </span>
        </div>

        {/* Input Area */}
        <div className="flex items-end space-x-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Tanyakan sesuatu kepada Sapa Tazkia..."
            disabled={disabled}
            rows={1}
            maxLength={2000}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none font-normal text-[15px] leading-relaxed tracking-wide placeholder-gray-400 bg-white transition-all duration-200"
            style={{ minHeight: '48px' }}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className="flex-shrink-0 w-12 h-12 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95"
            title="Kirim pesan"
          >
            {disabled ? 
              <Loader2 size={20} className="animate-spin" /> : 
              <Send size={20} />
            }
          </button>
        </div>

        {/* Helper Text */}
        <div className="mt-2 px-1">
          <p className="text-xs text-gray-400 text-center">
            Tekan Enter untuk mengirim, Shift + Enter untuk baris baru
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;