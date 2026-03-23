import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
};

const NotificationDropdown = () => {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        title="Notifikasi"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl
          bg-gray-900 border border-white/10 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-semibold text-white">Notifikasi</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-white/40 text-sm py-8">Belum ada notifikasi</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`px-4 py-3 cursor-pointer border-b border-white/5 transition-colors
                    ${n.isRead ? 'opacity-60' : 'hover:bg-white/5'}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0 mt-1.5" />}
                    <div className={!n.isRead ? '' : 'pl-4'}>
                      <p className="text-sm text-white font-medium">{n.announcement?.title}</p>
                      <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                        {n.announcement?.message?.substring(0, 80)}{n.announcement?.message?.length > 80 ? '...' : ''}
                      </p>
                      <p className="text-[10px] text-white/30 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
