// frontend/src/components/common/RateLimitStatus.jsx
import React, { useState, useEffect, useCallback } from 'react';
import aiService from '../../services/aiService';

/**
 * RateLimitStatus Component
 * Menampilkan status rate limit pengguna dengan progress bar dan informasi detail
 */
const RateLimitStatus = ({ 
  position = 'top-right', // 'top-right', 'top-left', 'bottom-right', 'bottom-left', 'inline'
  showDetailed = false,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
  className = '',
  onLimitWarning = null,
  onLimitExceeded = null
}) => {
  const [rateLimit, setRateLimit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Fetch rate limit status
  const fetchRateLimitStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const status = await aiService.getRateLimitStatus();
      
      if (status.success) {
        const rateLimitData = status.data;
        setRateLimit(rateLimitData);
        setLastUpdated(new Date());
        
        // Trigger callbacks based on rate limit state
        if (onLimitWarning && aiService.shouldShowRateLimitWarning()) {
          onLimitWarning(rateLimitData);
        }
        
        if (onLimitExceeded && rateLimitData.window_limits?.remaining === 0) {
          onLimitExceeded(rateLimitData);
        }
      } else {
        setError('Failed to get rate limit status');
      }
    } catch (err) {
      console.error('Error fetching rate limit status:', err);
      setError(err.message || 'Failed to load rate limit status');
      
      // Set fallback state
      setRateLimit({
        user_type: 'unknown',
        window_limits: {
          remaining: 10,
          limit: 10,
          reset_time: Date.now() + 60000,
          allowed: true
        },
        token_bucket: {
          tokens: 5,
          allowed: true
        }
      });
    } finally {
      setLoading(false);
    }
  }, [onLimitWarning, onLimitExceeded]);

  // Initialize and set up auto-refresh
  useEffect(() => {
    // Initial fetch
    fetchRateLimitStatus();
    
    // Set up auto-refresh if enabled
    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(fetchRateLimitStatus, refreshInterval);
    }
    
    // Set up rate limit listener for real-time updates
    const handleRateLimitUpdate = (newState) => {
      if (newState.lastUpdated) {
        setRateLimit(prev => ({
          ...prev,
          window_limits: {
            ...prev?.window_limits,
            remaining: newState.remaining,
            limit: newState.limit,
            reset_time: newState.resetTime
          },
          user_type: newState.userType
        }));
        setLastUpdated(new Date());
      }
    };
    
    aiService.addRateLimitListener(handleRateLimitUpdate);
    
    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      aiService.removeRateLimitListener(handleRateLimitUpdate);
    };
  }, [fetchRateLimitStatus, autoRefresh, refreshInterval]);

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!rateLimit?.window_limits) return 0;
    const { remaining, limit } = rateLimit.window_limits;
    return Math.max(0, ((limit - remaining) / limit) * 100);
  };

  // Get progress bar color based on usage
  const getProgressColor = () => {
    const percentage = getProgressPercentage();
    if (percentage >= 90) return '#dc2626'; // red-600
    if (percentage >= 75) return '#ea580c'; // orange-600
    if (percentage >= 50) return '#ca8a04'; // yellow-600
    return '#16a34a'; // green-600
  };

  // Format time until reset
  const formatTimeUntilReset = (resetTime) => {
    if (!resetTime) return 'Unknown';
    
    const now = Date.now();
    const diff = resetTime - now;
    
    if (diff <= 0) return 'Reset soon';
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `Reset in ${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `Reset in ${minutes}m ${seconds % 60}s`;
    return `Reset in ${seconds}s`;
  };

  // Get user type display name
  const getUserTypeDisplay = (userType) => {
    const types = {
      guest: 'Guest',
      user: 'User',
      premium: 'Premium',
      admin: 'Admin'
    };
    return types[userType] || userType;
  };

  // Get user type badge color
  const getUserTypeBadgeColor = (userType) => {
    const colors = {
      guest: 'bg-gray-100 text-gray-800 border-gray-300',
      user: 'bg-blue-100 text-blue-800 border-blue-300',
      premium: 'bg-purple-100 text-purple-800 border-purple-300',
      admin: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[userType] || colors.guest;
  };

  // Loading state
  if (loading && !rateLimit) {
    return (
      <div className={`rate-limit-status loading ${getPositionClasses(position)} ${className}`}>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span>Loading limits...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !rateLimit) {
    return (
      <div className={`rate-limit-status error ${getPositionClasses(position)} ${className}`}>
        <div className="flex items-center space-x-2 text-sm text-red-600">
          <span>⚠️</span>
          <span>Limit status unavailable</span>
        </div>
      </div>
    );
  }

  const { user_type, window_limits, token_bucket } = rateLimit || {};
  const progressPercentage = getProgressPercentage();
  const progressColor = getProgressColor();
  const isNearLimit = progressPercentage >= 75;
  const isExceeded = window_limits?.remaining === 0;

  // Main component render
  return (
    <div 
      className={`rate-limit-status ${getPositionClasses(position)} ${className} ${
        isExceeded ? 'exceeded' : isNearLimit ? 'warning' : 'normal'
      }`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={() => setShowTooltip(!showTooltip)}
    >
      {/* Compact View */}
      <div className="compact-view">
        <div className="flex items-center space-x-2">
          {/* User Type Badge */}
          <span className={`user-badge px-2 py-1 text-xs font-medium rounded-full border ${getUserTypeBadgeColor(user_type)}`}>
            {getUserTypeDisplay(user_type)}
          </span>
          
          {/* Progress Bar */}
          <div className="progress-container flex-1 max-w-xs">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 font-medium">
                {window_limits?.remaining ?? '?'}/{window_limits?.limit ?? '?'}
              </span>
              <span className="text-gray-500 text-xs">
                {formatTimeUntilReset(window_limits?.reset_time)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor: progressColor
                }}
              ></div>
            </div>
          </div>
          
          {/* Status Icon */}
          <div className="status-icon">
            {isExceeded ? (
              <span className="text-red-500 text-lg">⏳</span>
            ) : isNearLimit ? (
              <span className="text-orange-500 text-lg">⚠️</span>
            ) : (
              <span className="text-green-500 text-lg">✅</span>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Tooltip */}
      {showTooltip && showDetailed && (
        <div className="detailed-tooltip animate-in fade-in-50 zoom-in-95">
          <div className="tooltip-content">
            <div className="tooltip-header">
              <h4 className="font-semibold text-gray-900">Rate Limit Status</h4>
              <span className={`user-type-badge ${getUserTypeBadgeColor(user_type)}`}>
                {getUserTypeDisplay(user_type)}
              </span>
            </div>
            
            <div className="tooltip-body">
              {/* Window Limits */}
              <div className="limit-section">
                <h5 className="font-medium text-gray-700 mb-2">Window Limits</h5>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-medium">{window_limits?.remaining ?? 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Limit:</span>
                    <span className="font-medium">{window_limits?.limit ?? 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reset:</span>
                    <span className="font-medium text-xs">
                      {formatTimeUntilReset(window_limits?.reset_time)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${
                      window_limits?.allowed ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {window_limits?.allowed ? 'Allowed' : 'Blocked'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Token Bucket */}
              {token_bucket && (
                <div className="limit-section">
                  <h5 className="font-medium text-gray-700 mb-2">Token Bucket</h5>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tokens:</span>
                      <span className="font-medium">{token_bucket.tokens ?? 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${
                        token_bucket.allowed ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {token_bucket.allowed ? 'Allowed' : 'Blocked'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Last Updated */}
              {lastUpdated && (
                <div className="last-updated text-xs text-gray-500 mt-3 pt-2 border-t">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="tooltip-actions mt-3 flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchRateLimitStatus();
                  }}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded transition-colors"
                >
                  Refresh
                </button>
                {user_type === 'guest' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Trigger sign up flow - you can customize this
                      if (window.authContext?.setAuthModalOpen) {
                        window.authContext.setAuthModalOpen(true);
                      }
                    }}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-2 rounded transition-colors"
                  >
                    Get Higher Limits
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function for position classes
const getPositionClasses = (position) => {
  const positions = {
    'top-right': 'fixed top-4 right-4',
    'top-left': 'fixed top-4 left-4',
    'bottom-right': 'fixed bottom-4 right-4',
    'bottom-left': 'fixed bottom-4 left-4',
    'inline': 'relative'
  };
  return positions[position] || positions['top-right'];
};

// CSS Styles (akan di-import di file CSS global atau menggunakan CSS modules)
// Berikut adalah styles yang diperlukan:
const styles = `
.rate-limit-status {
  z-index: 40;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.rate-limit-status.fixed {
  position: fixed;
}

.rate-limit-status.relative {
  position: relative;
}

.rate-limit-status .compact-view {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
  cursor: pointer;
  min-width: 280px;
}

.rate-limit-status:hover .compact-view {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.rate-limit-status.warning .compact-view {
  border-color: #ea580c;
  background: #fffbeb;
}

.rate-limit-status.exceeded .compact-view {
  border-color: #dc2626;
  background: #fef2f2;
}

.rate-limit-status .user-badge {
  font-size: 0.7rem;
  white-space: nowrap;
}

.rate-limit-status .progress-container {
  min-width: 120px;
}

.rate-limit-status .detailed-tooltip {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  z-index: 50;
}

.rate-limit-status.inline .detailed-tooltip {
  position: absolute;
  top: 100%;
  right: 0;
}

.rate-limit-status .tooltip-content {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
  min-width: 280px;
  max-width: 320px;
}

.rate-limit-status .tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}

.rate-limit-status .tooltip-header h4 {
  margin: 0;
  font-size: 0.9rem;
}

.rate-limit-status .user-type-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
}

.rate-limit-status .limit-section {
  margin-bottom: 12px;
}

.rate-limit-status .limit-section h5 {
  margin: 0 0 8px 0;
  font-size: 0.8rem;
}

.rate-limit-status .last-updated {
  border-top: 1px solid #f3f4f6;
}

.rate-limit-status .tooltip-actions {
  display: flex;
  gap: 8px;
}

.rate-limit-status .tooltip-actions button {
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

/* Animation classes */
.animate-in {
  animation-duration: 0.2s;
  animation-timing-function: ease-out;
}

.fade-in-50 {
  animation-name: fadeIn50;
}

@keyframes fadeIn50 {
  from { opacity: 0; }
  to { opacity: 1; }
}

.zoom-in-95 {
  animation-name: zoomIn95;
}

@keyframes zoomIn95 {
  from { 
    opacity: 0;
    transform: scale(0.95);
  }
  to { 
    opacity: 1;
    transform: scale(1);
  }
}

/* Responsive design */
@media (max-width: 640px) {
  .rate-limit-status.fixed {
    position: relative;
    top: auto;
    right: auto;
    bottom: auto;
    left: auto;
    margin-bottom: 16px;
  }
  
  .rate-limit-status .compact-view {
    min-width: auto;
  }
  
  .rate-limit-status .detailed-tooltip {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    margin-top: 0;
    width: 90vw;
    max-width: 300px;
  }
}
`;

// Export the styles for global inclusion
export const RateLimitStyles = styles;

export default RateLimitStatus;