import React from 'react';

/**
 * Premium loading fallback for React.lazy Suspense boundaries.
 * Shows animated skeleton with Sapa Tazkia branding.
 */
const LoadingFallback = () => {
  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Animated Logo Pulse */}
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 animate-pulse" />
          <div className="absolute inset-0 w-12 h-12 rounded-2xl border border-purple-500/30 animate-ping opacity-30" />
        </div>

        {/* Loading Text */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#71717a] font-medium tracking-wide">
            Memuat
          </span>
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingFallback;
