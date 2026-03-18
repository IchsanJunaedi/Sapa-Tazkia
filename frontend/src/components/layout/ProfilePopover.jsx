import React, { useState } from 'react';
import { LogOut, HelpCircle, ChevronRight, Settings } from 'lucide-react';

const HELP_ITEMS = [
  { label: 'Help center' },
  { label: 'Terms & policies' },
  { label: 'Team dev' },
  { label: 'Report a bug' },
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

          {/* Help — with flyout on hover */}
          <div
            className="relative"
            onMouseEnter={() => setHelpOpen(true)}
            onMouseLeave={() => setHelpOpen(false)}
          >
            <button
              onClick={() => setHelpOpen((v) => !v)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/10"
            >
              <HelpCircle size={15} className="text-gray-300" />
              <span className="flex-1 text-left">Help</span>
              <ChevronRight size={14} className="text-gray-400" />
            </button>

            {/* Flyout sub-menu — positioned to the right of the main popover */}
            {helpOpen && (
              <div
                className="absolute top-0 w-52 rounded-xl shadow-2xl border border-white/10 bg-[#1e2a4a] p-1.5"
                style={{ left: '100%', marginLeft: '4px', zIndex: 60 }}
              >
                {HELP_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/10"
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
