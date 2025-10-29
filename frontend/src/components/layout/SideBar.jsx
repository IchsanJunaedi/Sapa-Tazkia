import React from 'react';
import { MessageSquare, PenSquare, User, LogOut } from 'lucide-react';

const Sidebar = ({ user, chatHistory, onNewChat, onSelectChat, currentChatId }) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">Sapa Tazkia</h1>
      </div>

      {/* User Profile */}
      {user ? (
        <div className="p-4 bg-blue-500 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.fullName}</p>
              <p className="text-xs opacity-90 truncate">{user.nim}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <button className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2">
            <User size={18} />
            <span>Login Mahasiswa</span>
          </button>
        </div>
      )}

      {/* New Chat Button */}
      <div className="p-4">
        <button 
          onClick={onNewChat}
          className="w-full border-2 border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2"
        >
          <PenSquare size={18} />
          <span>New</span>
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2">
          <div className="flex items-center space-x-2 text-gray-600 mb-2">
            <MessageSquare size={16} />
            <span className="text-sm font-medium">Chats</span>
          </div>
          
          {chatHistory && chatHistory.length > 0 ? (
            <div className="space-y-1">
              {chatHistory.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    currentChatId === chat.id 
                      ? 'bg-blue-50 border border-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {chat.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(chat.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Belum ada chat</p>
          )}
        </div>
      </div>

      {/* Footer - Social Media */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Follow us on</p>
        <div className="flex space-x-3">
          <div className="w-6 h-6 bg-gray-800 rounded-full"></div>
          <div className="w-6 h-6 bg-gray-800 rounded-full"></div>
          <div className="w-6 h-6 bg-gray-800 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;