class RateLimitExceededError extends Error {
  constructor(message, rateLimitInfo = {}) {
    super(message);
    this.name = 'RateLimitExceededError';
    this.status = 429;
    this.code = 'RATE_LIMIT_EXCEEDED';
    this.rateLimitInfo = rateLimitInfo;
  }
}

class TokenBucketExhaustedError extends Error {
  constructor(message, retryAfter = null) {
    super(message);
    this.name = 'TokenBucketExhaustedError';
    this.status = 429;
    this.code = 'TOKEN_BUCKET_EXHAUSTED';
    this.retryAfter = retryAfter;
  }
}

const rateLimitErrorHandler = (err, req, res, next) => {
  if (err instanceof RateLimitExceededError || err instanceof TokenBucketExhaustedError) {
    return res.status(429).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        retryAfter: err.retryAfter || err.rateLimitInfo?.retryAfter,
        limit: err.rateLimitInfo?.limit,
        resetTime: err.rateLimitInfo?.resetTime
      }
    });
  }
  next(err);
};

module.exports = {
  RateLimitExceededError,
  TokenBucketExhaustedError,
  rateLimitErrorHandler
};