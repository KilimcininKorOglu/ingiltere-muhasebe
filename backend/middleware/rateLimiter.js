/**
 * Rate Limiter Middleware
 * Provides rate limiting functionality to protect against abuse.
 * Uses an in-memory sliding window approach.
 * 
 * For production, consider using Redis for distributed rate limiting.
 * 
 * @module middleware/rateLimiter
 */

const { HTTP_STATUS, ERROR_CODES } = require('../utils/errorCodes');

/**
 * Rate limiter configuration
 * @typedef {Object} RateLimitConfig
 * @property {number} windowMs - Time window in milliseconds
 * @property {number} maxRequests - Maximum requests per window
 * @property {string} [keyGenerator] - Key generation strategy
 * @property {boolean} [skipFailedRequests] - Skip counting failed requests
 * @property {boolean} [skipSuccessfulRequests] - Skip counting successful requests
 */

/**
 * Default configuration for rate limiting
 */
const DEFAULT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  skipFailedRequests: false,
  skipSuccessfulRequests: false
};

/**
 * In-memory store for rate limit tracking.
 * Structure: Map<key, { count: number, resetTime: number, timestamps: number[] }>
 * @type {Map<string, Object>}
 */
const requestStore = new Map();

/**
 * Cleanup interval reference
 * @type {NodeJS.Timer|null}
 */
let cleanupTimer = null;

/**
 * Cleanup interval in milliseconds (5 minutes)
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Generates a rate limit key from the request.
 * Default uses IP address, can be customized.
 * 
 * @param {Object} req - Express request object
 * @param {string} [type='ip'] - Key type ('ip', 'user', 'combined')
 * @returns {string} Rate limit key
 */
function generateKey(req, type = 'ip') {
  const ip = req.ip || 
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
    req.connection?.remoteAddress ||
    'unknown';

  switch (type) {
    case 'user':
      return req.user ? `user:${req.user.id}` : `ip:${ip}`;
    case 'combined':
      return req.user ? `user:${req.user.id}:ip:${ip}` : `ip:${ip}`;
    case 'ip':
    default:
      return `ip:${ip}`;
  }
}

/**
 * Gets remaining requests for a key within the time window.
 * Uses sliding window algorithm.
 * 
 * @param {string} key - Rate limit key
 * @param {number} windowMs - Time window in milliseconds
 * @param {number} maxRequests - Maximum allowed requests
 * @returns {{ remaining: number, resetTime: number, isLimited: boolean }}
 */
function getRateLimitInfo(key, windowMs, maxRequests) {
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = requestStore.get(key);

  if (!record) {
    record = { timestamps: [], resetTime: now + windowMs };
    requestStore.set(key, record);
  }

  // Filter out timestamps outside the current window (sliding window)
  record.timestamps = record.timestamps.filter(ts => ts > windowStart);

  // Update reset time
  if (record.timestamps.length === 0) {
    record.resetTime = now + windowMs;
  } else {
    record.resetTime = record.timestamps[0] + windowMs;
  }

  const remaining = Math.max(0, maxRequests - record.timestamps.length);
  const isLimited = record.timestamps.length >= maxRequests;

  return {
    remaining,
    resetTime: record.resetTime,
    isLimited,
    total: maxRequests,
    current: record.timestamps.length
  };
}

/**
 * Records a request for rate limiting.
 * 
 * @param {string} key - Rate limit key
 */
function recordRequest(key) {
  const now = Date.now();
  let record = requestStore.get(key);

  if (!record) {
    record = { timestamps: [], resetTime: now + DEFAULT_CONFIG.windowMs };
    requestStore.set(key, record);
  }

  record.timestamps.push(now);
  
  // Start cleanup if not running
  startCleanup();
}

/**
 * Cleans up expired entries from the store.
 * 
 * @returns {number} Number of entries cleaned
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of requestStore.entries()) {
    // Remove records with no recent timestamps
    const windowStart = now - DEFAULT_CONFIG.windowMs;
    const activeTimestamps = record.timestamps.filter(ts => ts > windowStart);
    
    if (activeTimestamps.length === 0) {
      requestStore.delete(key);
      cleaned++;
    } else {
      record.timestamps = activeTimestamps;
    }
  }

  // Stop cleanup if store is empty
  if (requestStore.size === 0) {
    stopCleanup();
  }

  return cleaned;
}

/**
 * Starts the cleanup interval.
 */
function startCleanup() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  }
}

/**
 * Stops the cleanup interval.
 */
function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Clears the rate limit store.
 * Primarily used for testing.
 */
function clearStore() {
  requestStore.clear();
  stopCleanup();
}

/**
 * Gets the current size of the rate limit store.
 * 
 * @returns {number} Number of tracked keys
 */
function getStoreSize() {
  return requestStore.size;
}

/**
 * Creates a rate limiter middleware with custom configuration.
 * 
 * @param {RateLimitConfig} [config] - Rate limit configuration
 * @returns {Function} Express middleware function
 */
function createRateLimiter(config = {}) {
  const options = { ...DEFAULT_CONFIG, ...config };

  return (req, res, next) => {
    const key = generateKey(req, options.keyGenerator || 'ip');
    const info = getRateLimitInfo(key, options.windowMs, options.maxRequests);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', info.total);
    res.setHeader('X-RateLimit-Remaining', info.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetTime / 1000));

    if (info.isLimited) {
      const retryAfter = Math.ceil((info.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED.code,
          message: ERROR_CODES.RATE_LIMIT_EXCEEDED.message
        },
        meta: {
          retryAfter,
          limit: info.total,
          remaining: 0,
          resetTime: new Date(info.resetTime).toISOString()
        }
      });
    }

    // Record this request
    recordRequest(key);

    // Update remaining header after recording
    res.setHeader('X-RateLimit-Remaining', Math.max(0, info.remaining - 1));

    next();
  };
}

/**
 * Standard rate limiter for general API endpoints.
 * 100 requests per minute.
 */
const standardLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100
});

/**
 * Strict rate limiter for sensitive endpoints like login/register.
 * 10 requests per minute.
 */
const strictLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10
});

/**
 * Very strict rate limiter for password reset and similar endpoints.
 * 3 requests per minute.
 */
const veryStrictLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 3
});

/**
 * Login-specific rate limiter.
 * 5 attempts per 15 minutes.
 */
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5
});

module.exports = {
  // Factory function
  createRateLimiter,
  
  // Pre-configured limiters
  standardLimiter,
  strictLimiter,
  veryStrictLimiter,
  loginLimiter,
  
  // Utility functions
  generateKey,
  getRateLimitInfo,
  recordRequest,
  cleanupExpiredEntries,
  clearStore,
  getStoreSize,
  startCleanup,
  stopCleanup,
  
  // Configuration
  DEFAULT_CONFIG
};
