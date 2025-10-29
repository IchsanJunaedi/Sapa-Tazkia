import React from 'react';
// Menghapus 'Square' yang tidak digunakan untuk mengatasi peringatan ESLint
import { MessageSquare, PenSquare, User, Settings } from 'lucide-react'; 

// Sidebar ini dirancang agar terlihat seperti desain target (ringkas dan ikonik)
const Sidebar = () => {  
  return (
    // Memastikan Sidebar memiliki tinggi penuh dan latar belakang berbeda (krem/peach)
    <div className="w-20 bg-amber-50 border-r border-gray-200 flex flex-col h-screen p-3 shadow-xl">
      
      {/* Tombol Pengaturan (Settings) - Paling Atas Kiri */}
      <div className="flex justify-center mb-8">
        <button className="p-2 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors">
          <Settings size={24} />
        </button>
      </div>

      {/* Login Mahasiswa Button (Diganti menjadi ikon User) */}
      <div className="flex justify-center mb-10">
        <button 
          className="w-12 h-12 bg-blue-500 text-white rounded-xl shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center group relative"
          title="Login Mahasiswa"
          // Tambahkan onClick handler yang sesuai di sini
        >
          <User size={20} />
          {/* Tooltip sederhana untuk aksesibilitas */}
          <span className="absolute left-full ml-3 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
            Login Mahasiswa
          </span>
        </button>
      </div>

      {/* New Chat Button */}
      <div className="flex justify-center space-y-3">
        <button 
          // onClick={onNewChat} // Dihapus karena Sidebar di Landing Page statis
          className="w-12 h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center justify-center group relative"
          title="New Chat"
        >
          <PenSquare size={20} />
           <span className="absolute left-full ml-3 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
            New
          </span>
        </button>
      </div>
      
      {/* Chat History/Chats Button */}
      <div className="flex justify-center">
        <button 
          className="w-12 h-12 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors flex items-center justify-center group relative"
          title="Chats"
        >
          <MessageSquare size={20} />
          <span className="absolute left-full ml-3 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block">
            Chats
          </span>
        </button>
      </div>

      {/* Follow us on (Paling Bawah) */}
      <div className="mt-auto flex justify-center flex-col items-center">
        <p className="text-xs text-gray-500 rotate-90 mb-6 hidden">Follow us</p>
        <div className="space-y-2">
          {/* Placeholder untuk ikon Follow us, dibuat lebih ringkas */}
          <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
          <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
          <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
