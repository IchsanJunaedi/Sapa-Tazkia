import React, { useState, useRef, useLayoutEffect } from 'react';
import { Plus, ArrowUp } from 'lucide-react';

const ChatInput = ({ onSend, disabled }) => {
    const [input, setInput] = useState('');
    const textareaRef = useRef(null);
    const formRef = useRef(null);

    // Batas Maksimal 250 Karakter
    const MAX_CHARS = 250;
    const isTooLong = input.length > MAX_CHARS;

    const adjustHeightAndShape = () => {
        const textarea = textareaRef.current;
        const form = formRef.current;
        
        if (textarea && form) {
            textarea.style.height = 'auto'; 
            const currentHeight = textarea.scrollHeight;
            textarea.style.height = `${Math.min(currentHeight, 150)}px`;

            if (currentHeight > 52) {
                form.style.borderRadius = '1.5rem'; 
            } else {
                form.style.borderRadius = '30px'; 
            }
        }
    };

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        
        if (input.trim() && !isTooLong && !disabled) {
            onSend(input.trim());
            setInput('');
            
            if (textareaRef.current && formRef.current) {
                textareaRef.current.style.height = 'auto';
                formRef.current.style.borderRadius = '30px';
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    useLayoutEffect(() => {
        adjustHeightAndShape();
    }, [input]);

    const isButtonEnabled = input.trim() && !isTooLong && !disabled;

    return (
        <div className="p-4 md:p-6 border-t border-gray-200 flex justify-center bg-[#fef6e4]">
            <form 
                ref={formRef}
                onSubmit={handleSubmit} 
                // ✅ [FIX 1] Hapus 'overflow-hidden' agar tooltip bisa keluar dari kotak
                className="w-full max-w-3xl flex items-end p-2 bg-white border border-gray-300 shadow-xl transition-all duration-200 ease-out relative"
                style={{ borderRadius: '30px' }} 
            >
                <button type="button" className="p-2 mb-1 mr-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0 h-10 w-10 flex items-center justify-center" title="Attach" disabled={disabled}>
                    <Plus size={20} />
                </button>
                
                <textarea
                    ref={textareaRef}
                    placeholder="Message Sapa Tazkia"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    rows={1}
                    // ✅ [FIX 2] Hapus logic warna merah. Tetap gray-700 selamanya.
                    className="flex-1 py-3 px-2 text-base text-gray-700 placeholder-gray-500 focus:outline-none bg-white resize-none max-h-[150px]"
                    style={{ 
                        lineHeight: '1.5', 
                        minHeight: '44px' 
                    }}
                />
                
                {/* Wrapper div untuk Logic Tooltip & Button */}
                <div className="relative group mb-1 ml-2 flex-shrink-0">
                    <button
                        type="submit"
                        disabled={!isButtonEnabled}
                        className={`h-10 w-10 flex items-center justify-center rounded-full transition-colors shadow-md ${
                            isButtonEnabled 
                            ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                            : 'bg-gray-300 cursor-not-allowed text-gray-500'
                        }`}
                        aria-label="Send Message"
                    >
                        <ArrowUp size={20} />
                    </button>

                    {/* Tooltip: Sekarang posisinya aman karena overflow form sudah dibuka */}
                    {isTooLong && (
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-max px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg z-50">
                            Message is too long
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

export default ChatInput;