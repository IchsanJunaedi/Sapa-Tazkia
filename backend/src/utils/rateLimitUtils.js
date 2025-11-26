class RateLimitUtils {
  static estimateTokenCount(message) {
    // Simple estimation: ~4 characters per token
    return Math.ceil(message.length / 4);
  }

  static calculateCostEstimate(tokens, model = 'gpt-3.5-turbo') {
    const costPerToken = {
      'gpt-3.5-turbo': 0.000002,
      'gpt-4': 0.00003,
      'gpt-4-turbo': 0.00001
    };
    
    return tokens * (costPerToken[model] || costPerToken['gpt-3.5-turbo']);
  }

  static getRetryAfterTime(window, limitType) {
    const windows = {
      minute: 60,
      hour: 3600,
      day: 86400
    };
    
    return windows[window] || 60;
  }

  static generateRateLimitKey(prefix, identifier, window) {
    const timestamp = Math.floor(Date.now() / 60000); // Minute precision
    return `${prefix}:${identifier}:${window}:${timestamp}`;
  }

  static isRateLimitError(error) {
    return error.status === 429 || 
           error.code === 'RATE_LIMIT_EXCEEDED' ||
           error.message?.includes('rate limit');
  }
}

module.exports = RateLimitUtils;