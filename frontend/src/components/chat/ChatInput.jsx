import React, { useState, useRef, useLayoutEffect } from 'react';
import { Plus, ArrowUp } from 'lucide-react';

const ChatInput = ({ onSend, disabled }) => {
    const [input, setInput] = useState('');
    const textareaRef = useRef(null);
    const formRef = useRef(null);

    const MAX_CHARS = 250;
    const isTooLong = input.length > MAX_CHARS;

    const adjustHeightAndShape = () => {
        const textarea = textareaRef.current;
        const form = formRef.current;
        if (textarea && form) {
            textarea.style.height = 'auto';
            const currentHeight = textarea.scrollHeight;
            textarea.style.height = `${Math.min(currentHeight, 150)}px`;
            form.style.borderRadius = currentHeight > 52 ? '1.5rem' : '9999px';
        }
    };

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (input.trim() && !isTooLong && !disabled) {
            onSend(input.trim());
            setInput('');
            if (textareaRef.current && formRef.current) {
                textareaRef.current.style.height = 'auto';
                formRef.current.style.borderRadius = '9999px';
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
        <div className="px-4 pb-5 pt-3 md:px-6 md:pb-6 md:pt-4 border-t border-white/10 flex justify-center bg-transparent backdrop-blur-xl">
            <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="w-full max-w-3xl flex items-end p-2 bg-white/10 backdrop-blur-lg border border-white/20 transition-all duration-200 ease-out relative"
                style={{ borderRadius: '9999px' }}
            >
                {/* Attach button */}
                <button
                    type="button"
                    className="p-2 mb-1 mr-2 flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all duration-200"
                    title="Attach"
                    disabled={disabled}
                >
                    <Plus size={20} />
                </button>

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    placeholder="Message Sapa Tazkia"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    rows={1}
                    className="flex-1 py-3 px-2 text-base text-white placeholder-white/40 focus:outline-none bg-transparent resize-none max-h-[150px]"
                    style={{ lineHeight: '1.5', minHeight: '44px' }}
                />

                {/* Send button + tooltip wrapper */}
                <div className="relative group mb-1 ml-2 flex-shrink-0">
                    <button
                        type="submit"
                        disabled={!isButtonEnabled}
                        className={`h-10 w-10 flex items-center justify-center rounded-full transition-all duration-300 ${
                            isButtonEnabled
                                ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/50 hover:from-indigo-400 hover:to-blue-500 hover:shadow-indigo-400/70 hover:scale-105 active:scale-95'
                                : 'bg-white/10 cursor-not-allowed text-white/25'
                        }`}
                        aria-label="Send Message"
                    >
                        <ArrowUp size={20} />
                    </button>

                    {isTooLong && (
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-max px-3 py-1.5 bg-gray-900/90 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg z-50 backdrop-blur-sm border border-white/10">
                            Message is too long
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/90"></div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

export default ChatInput;
