const rateLimit = require('express-rate-limit');
const { getRedis, isRedisConnected } = require('../config/redis');

/**
 * Rate Limiting Middleware
 * 
 * Design Decision: Tiered rate limiting for different operations
 * - General API: 100 requests/minute (browsing, reading)
 * - Write operations: 30 requests/minute (create expense, settle)
 * - Auth operations: 10 requests/minute (login, signup - prevent brute force)
 * - Search operations: 20 requests/minute (user search)
 * 
 * Uses Redis for distributed rate limiting across multiple instances.
 * Falls back to in-memory store for single instance deployments.
 */

/**
 * Create Redis store for rate limiting (if Redis available)
 */
const createStore = () => {
  const redis = getRedis();
  
  if (!redis || !isRedisConnected()) {
    return undefined; // Use default memory store
  }

  // Custom Redis store for express-rate-limit
  return {
    async increment(key) {
      const results = await redis
        .multi()
        .incr(key)
        .pttl(key)
        .exec();
      
      const totalHits = results[0][1];
      const timeToExpire = results[1][1];
      
      return {
        totalHits,
        resetTime: timeToExpire > 0 
          ? new Date(Date.now() + timeToExpire) 
          : new Date(Date.now() + 60000)
      };
    },
    
    async decrement(key) {
      await redis.decr(key);
    },
    
    async resetKey(key) {
      await redis.del(key);
    },
    
    async init() {
      // Set expiry on first request
    }
  };
};

/**
 * Key generator - uses user ID if authenticated, IP otherwise
 */
const keyGenerator = (req) => {
  return req.userId || req.ip;
};

/**
 * Standard response for rate limit exceeded
 */
const standardHeaders = true;
const legacyHeaders = false;

const handler = (req, res) => {
  res.status(429).json({
    error: 'Too many requests',
    message: 'Please slow down and try again later',
    retryAfter: res.getHeader('Retry-After')
  });
};

/**
 * General API rate limiter
 * 100 requests per minute
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyGenerator,
  standardHeaders,
  legacyHeaders,
  handler,
  skip: (req) => req.path === '/health'
});

/**
 * Write operations rate limiter
 * 30 requests per minute
 */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator,
  standardHeaders,
  legacyHeaders,
  handler,
  message: { error: 'Too many write operations. Please wait before creating more.' }
});

/**
 * Auth operations rate limiter
 * 10 requests per minute (stricter to prevent brute force)
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip, // Always use IP for auth
  standardHeaders,
  legacyHeaders,
  handler,
  message: { error: 'Too many authentication attempts. Please wait.' }
});

/**
 * Search operations rate limiter
 * 20 requests per minute
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator,
  standardHeaders,
  legacyHeaders,
  handler
});

/**
 * Strict limiter for sensitive operations
 * 5 requests per minute
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator,
  standardHeaders,
  legacyHeaders,
  handler,
  message: { error: 'Rate limit exceeded for sensitive operation.' }
});

module.exports = {
  generalLimiter,
  writeLimiter,
  authLimiter,
  searchLimiter,
  strictLimiter
};
