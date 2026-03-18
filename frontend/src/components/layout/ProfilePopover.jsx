import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, HelpCircle, ChevronRight, ChevronDown, Settings } from 'lucide-react';

const HELP_ITEMS = [
  { label: 'Help center', path: '/help' },
  { label: 'Terms & policies', path: '/terms' },
  { label: 'Team dev', path: null },
  { label: 'Report a bug', path: '/report-bug' },
];

export default function ProfilePopover({
  getUserName,
  getUserEmail,
  position,
  onLogout,
  onSettingsClick,
  onClose,
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const closeTimerRef = useRef(null);
  const navigate = useNavigate();
  const isMobile = window.innerWidth < 640;

  const handleHelpEnter = () => {
    if (isMobile) return;
    clearTimeout(closeTimerRef.current);
    setHelpOpen(true);
  };

  const handleHelpLeave = () => {
    if (isMobile) return;
    closeTimerRef.current = setTimeout(() => setHelpOpen(false), 150);
  };

  return (
    <>
      {/* Backdrop — closes popover on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Main popover */}
      <div
        className="fixed z-50 w-64 rounded-xl shadow-2xl border border-white/10 bg-[#1e2a4a] text-white"
        style={{ left: `${position.x}px`, top: `${position.y - 10}px` }}
      >
        {/* Account info */}
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-sm font-semibold truncate">{getUserName()}</p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{getUserEmail()}</p>
        </div>

        {/* Menu items */}
        <div className="p-1.5 space-y-0.5">

          {/* Settings */}
          <button
            onClick={() => { onSettingsClick(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/10"
          >
            <Settings size={15} className="text-gray-300" />
            <span>Settings</span>
          </button>

          {/* Help — hover flyout on desktop, accordion on mobile */}
          <div
            className="relative"
            onMouseEnter={handleHelpEnter}
            onMouseLeave={handleHelpLeave}
          >
            <button
              onClick={() => setHelpOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/10"
            >
              <HelpCircle size={15} className="text-gray-300" />
              <span className="flex-1 text-left">Help</span>
              {isMobile
                ? <ChevronDown size={14} className={`text-gray-400 transition-transform ${helpOpen ? 'rotate-180' : ''}`} />
                : <ChevronRight size={14} className="text-gray-400" />
              }
            </button>

            {/* Desktop: flyout to the right */}
            {helpOpen && !isMobile && (
              <div
                className="absolute top-0 w-52 rounded-xl shadow-2xl border border-white/10 bg-[#1e2a4a] p-1.5"
                style={{ left: '100%', marginLeft: '4px', zIndex: 60 }}
                onMouseEnter={handleHelpEnter}
                onMouseLeave={handleHelpLeave}
              >
                {HELP_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { if (item.path) { navigate(item.path); onClose(); } }}
                    disabled={!item.path}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      item.path ? 'hover:bg-white/10' : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {/* Mobile: expand inline (accordion) */}
            {helpOpen && isMobile && (
              <div className="mt-0.5 ml-3 border-l border-white/10 pl-3 space-y-0.5">
                {HELP_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { if (item.path) { navigate(item.path); onClose(); } }}
                    disabled={!item.path}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors text-gray-300 ${
                      item.path ? 'hover:bg-white/10' : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Log out */}
        <div className="p-1.5 border-t border-white/10">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-red-400 hover:bg-red-500/10"
          >
            <LogOut size={15} />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </>
  );
}
