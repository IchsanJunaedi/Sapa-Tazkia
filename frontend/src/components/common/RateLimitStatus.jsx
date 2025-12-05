import React, { useState, useEffect } from 'react';
import aiService from '../../api/aiService'; 
import { Zap, AlertCircle, RefreshCw, Sparkles, User, Shield, Info } from 'lucide-react'; 

// ✅ CONFIG: Konstanta Global
const DEFAULT_LIMIT = 7000; 
const DEFAULT_RESET_MS = 12 * 60 * 60 * 1000; 

/**
 * ✅ HELPER: Parser Data (Di luar komponen agar useEffect bersih)
 */
const processStatusData = (incomingData) => {
  if (!incomingData) return null;

  let remaining, limit, userType, resetTime;

  if (incomingData.window_limits) {
    remaining = incomingData.window_limits.remaining;
    limit = incomingData.window_limits.limit;
    resetTime = incomingData.window_limits.reset_time; 
    userType = incomingData.user_type; 
  } else {
    remaining = incomingData.remaining;
    limit = incomingData.limit;
    resetTime = incomingData.resetTime; 
    userType = incomingData.userType;
  }

  let safeLimit = DEFAULT_LIMIT;
  if (limit !== undefined && limit !== null && limit > 100) {
      safeLimit = limit;
  }

  // Fallback Reset Time: Jika null/0, gunakan 12 jam dari sekarang
  const safeResetTime = (resetTime && resetTime > Date.now()) 
      ? resetTime 
      : Date.now() + DEFAULT_RESET_MS;

  return {
    remaining: remaining !== undefined ? remaining : safeLimit,
    limit: safeLimit,
    userType: userType || 'guest',
    resetTime: safeResetTime
  };
};

const RateLimitStatus = ({ className = '', userName = 'Mahasiswa', isGuestMode = false }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // ✅ LOGIC: Connect ke Real AI Service
  useEffect(() => {
    let isMounted = true;

    const handleRealtimeUpdate = (newState) => {
      if (!isMounted) return;
      const cleanData = processStatusData(newState);
      if (cleanData) setStatus(cleanData);
    };

    const fetchInitialStatus = async () => {
      try {
        const response = await aiService.getRateLimitStatus();
        if (isMounted && response.success) {
          setStatus(processStatusData(response.data));
        }
      } catch (error) {
        setStatus({ 
            remaining: DEFAULT_LIMIT, 
            limit: DEFAULT_LIMIT, 
            userType: 'guest', 
            resetTime: Date.now() + DEFAULT_RESET_MS 
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    aiService.addRateLimitListener(handleRealtimeUpdate);
    fetchInitialStatus();

    return () => {
      isMounted = false;
      aiService.removeRateLimitListener(handleRealtimeUpdate);
    };
  }, []);

  if (loading && !status) return null; 
  
  const currentStatus = status || { 
      remaining: DEFAULT_LIMIT, 
      limit: DEFAULT_LIMIT, 
      userType: 'guest',
      resetTime: Date.now() + DEFAULT_RESET_MS 
  };

  const percentage = Math.min(100, Math.max(0, (currentStatus.remaining / currentStatus.limit) * 100));
  const isActuallyGuest = isGuestMode || (!currentStatus.userType || currentStatus.userType === 'guest' || currentStatus.userType === 'ip');
  const userLabel = isActuallyGuest ? 'Mode Tamu' : userName;

  // ✅ THEME: Dynamic Gen Z Colors
  const getTheme = () => {
    if (currentStatus.remaining === 0) {
      return {
        accent: 'from-red-400 to-rose-500',
        badge: 'bg-red-50 text-red-600 border-red-200',
        icon: 'text-red-500',
        glow: 'shadow-red-500/20'
      };
    }
    if (percentage < 25) {
      return {
        accent: 'from-amber-400 to-orange-500',
        badge: 'bg-amber-50 text-amber-600 border-amber-200',
        icon: 'text-amber-500',
        glow: 'shadow-amber-500/20'
      };
    }
    return {
      accent: 'from-emerald-400 to-teal-500',
      badge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      icon: 'text-emerald-500',
      glow: 'shadow-emerald-500/20'
    };
  };

  const theme = getTheme();

  const getResetTimeDisplay = () => {
    if (!currentStatus.resetTime) return 'Besok';
    const date = new Date(currentStatus.resetTime);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div 
      className={`fixed top-20 right-4 z-40 font-sans ${className}`}
      onMouseEnter={() => { setShowTooltip(true); setIsHovered(true); }}
      onMouseLeave={() => { setShowTooltip(false); setIsHovered(false); }}
    >
      {/* --- MAIN GLASS CARD --- */}
      <div className={`
        relative overflow-hidden
        backdrop-blur-xl bg-white/70 
        border border-white/60
        rounded-3xl p-4 w-72
        shadow-[0_8px_32px_rgba(0,0,0,0.08)] ${theme.glow}
        transition-all duration-500 ease-out
        ${isHovered ? 'scale-[1.02] shadow-[0_12px_40px_rgba(0,0,0,0.12)] bg-white/80' : ''}
        cursor-help
      `}>
        
        {/* Decorative Glow Orb */}
        <div className={`
          absolute -top-12 -right-12 w-32 h-32 
          bg-gradient-to-br ${theme.accent} 
          rounded-full opacity-20 blur-3xl
          transition-all duration-700
          ${isHovered ? 'scale-150 opacity-30' : ''}
        `} />

        {/* Header */}
        <div className="relative flex justify-between items-center mb-4">
          <div className={`
            flex items-center gap-2 px-3 py-1.5 
            rounded-full border backdrop-blur-sm
            ${theme.badge}
            transition-all duration-300
          `}>
            {currentStatus.remaining === 0 ? (
              <AlertCircle size={14} className="animate-pulse" />
            ) : (
              <Sparkles size={14} className={`${theme.icon}`} />
            )}
            <span className="text-[11px] font-bold uppercase tracking-wider truncate max-w-[100px]">
              {userLabel}
            </span>
          </div>

          {/* Token Count (Gradient Text) */}
          <div className="flex items-baseline gap-1">
            <span className={`text-xl font-extrabold bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
              {currentStatus.remaining.toLocaleString()}
            </span>
            <span className="text-[10px] text-gray-400 font-semibold">
              /{currentStatus.limit.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative mb-3.5">
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
            <div 
              className={`h-full rounded-full bg-gradient-to-r ${theme.accent} transition-all duration-1000 ease-out shadow-sm`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {/* Glow Line on Bar */}
          <div 
            className={`absolute top-0 h-2 rounded-full bg-gradient-to-r ${theme.accent} blur-[2px] opacity-40 transition-all duration-1000 ease-out pointer-events-none`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Footer Info */}
        <div className="relative flex justify-between items-center">
          <span className="text-[10px] font-semibold text-gray-400">
            {currentStatus.remaining === 0 ? 'Limit Habis' : 'Sisa Token'}
          </span>

          {!isActuallyGuest ? (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 bg-white/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/50 shadow-sm">
              <RefreshCw size={10} className={`${theme.icon}`} /> 
              Reset: {getResetTimeDisplay()}
            </span>
          ) : (
             <span className="flex items-center gap-1.5 text-[10px] text-gray-400 bg-white/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/50">
                <Info size={10} /> Info
             </span>
          )}
        </div>
      </div>

      {/* --- TOOLTIP (Modern Design) --- */}
      {showTooltip && (
        <div className="
          absolute top-full right-0 mt-3 w-80
          backdrop-blur-2xl bg-white/80 
          border border-white/60
          rounded-3xl shadow-2xl p-5
          animate-in fade-in zoom-in-95 origin-top-right
          z-50
        ">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            <div className={`
              p-2.5 rounded-2xl backdrop-blur-sm
              ${isActuallyGuest 
                ? 'bg-gray-100 text-gray-500' 
                : 'bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 border border-blue-100'
              }
            `}>
              {isActuallyGuest ? <Shield size={20} /> : <User size={20} />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-800">Detail Penggunaan</h4>
              <p className="text-[10px] text-gray-500 font-medium">Info kuota harian Anda</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center p-2.5 rounded-xl bg-white/50 border border-white/60">
              <span className="text-xs text-gray-500 font-medium">Status Akun</span>
              <span className={`
                font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wide
                ${isActuallyGuest
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-blue-50 text-blue-600'
                }
              `}>
                {isActuallyGuest ? 'Guest' : 'Mahasiswa'}
              </span>
            </div>

            <div className="bg-gray-50/50 rounded-xl p-3 space-y-2 border border-gray-100/50">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Token Terpakai</span>
                <span className="font-bold text-gray-700">
                  {(currentStatus.limit - currentStatus.remaining).toLocaleString()}
                </span>
              </div>
              <div className="w-full h-px bg-gray-200/50" />
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Total Kuota</span>
                <span className={`font-bold bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
                  {currentStatus.limit.toLocaleString()}
                </span>
              </div>
            </div>

            {isActuallyGuest && (
              <div className="mt-3 pt-1">
                <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100/50">
                  <p className="text-[10px] text-blue-700 font-semibold text-center flex items-center justify-center gap-1.5">
                    <Zap size={12} className="text-blue-500 fill-current" />
                    Login untuk kuota 2x lipat!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RateLimitStatus;