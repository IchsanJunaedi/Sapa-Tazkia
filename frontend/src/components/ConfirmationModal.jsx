import React from 'react';
import { Trash2, X, Loader2 } from 'lucide-react';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Hapus", 
  cancelText = "Batal",
  isDeleting = false 
}) => {
  if (!isOpen) return null;

  return (
    // 1. BACKDROP: Gelap dengan Blur Effect (Modern)
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300">
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm" 
        onClick={onClose}
      ></div>

      {/* 2. MODAL CARD: Rounded besar, Shadow halus, Animasi Scale */}
      <div className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl transform transition-all scale-100 overflow-hidden border border-white/20">
        
        {/* Dekorasi Background Atas (Gradient Halus) */}
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-orange-50 to-white opacity-80"></div>

        {/* Tombol Close di Pojok */}
        <button 
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="relative px-6 pt-8 pb-6 flex flex-col items-center text-center">
          
          {/* 3. ICON BESAR dengan Circle Background */}
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/50">
            <div className="h-14 w-14 bg-red-100 rounded-full flex items-center justify-center text-red-500 shadow-sm">
               <Trash2 size={28} strokeWidth={2.5} />
            </div>
          </div>

          {/* 4. TYPOGRAPHY: Heading Bold & Clean */}
          <h3 className="text-xl font-bold text-gray-800 mb-2 tracking-tight">
            {title}
          </h3>
          
          <p className="text-sm text-gray-500 mb-8 leading-relaxed px-2">
            {message}
          </p>

          {/* 5. ACTION BUTTONS: Modern Pills */}
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all duration-200 disabled:opacity-50"
            >
              {cancelText}
            </button>
            
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/30 active:scale-95 transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Proses...</span>
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;