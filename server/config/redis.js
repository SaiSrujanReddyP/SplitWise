const Redis = require('ioredis');

/**
 * Redis Configuration
 * 
 * Design Decision: Redis for caching and distributed locking
 * - Caches frequently accessed data (user balances, group members)
 * - Provides distributed locks for multi-instance deployments
 * - Supports pub/sub for cache invalidation across instances
 * 
 * Falls back gracefully if Redis is unavailable (cache miss = DB query)
 */

let redis = null;
let isConnected = false;

const initRedis = () => {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.log('⚠️  REDIS_URL not set - running without cache (not recommended for production)');
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true
    });

    redis.on('connect', () => {
      isConnected = true;
      console.log('✅ Redis connected');
    });

    redis.on('error', (err) => {
      console.error('Redis error:', err.message);
      isConnected = false;
    });

    redis.on('close', () => {
      isConnected = false;
    });

    // Attempt connection
    redis.connect().catch(err => {
      console.error('Redis connection failed:', err.message);
    });

    return redis;
  } catch (err) {
    console.error('Redis initialization failed:', err.message);
    return null;
  }
};

const getRedis = () => redis;
const isRedisConnected = () => isConnected;

/**
 * Cache wrapper with automatic fallback
 */
const cache = {
  /**
   * Get cached value or execute fallback
   * @param {string} key - Cache key
   * @param {Function} fallback - Async function to get value if not cached
   * @param {number} ttl - Time to live in seconds (default 5 minutes)
   */
  async getOrSet(key, fallback, ttl = 300) {
    if (!isConnected || !redis) {
      return fallback();
    }

    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }

      const value = await fallback();
      await redis.setex(key, ttl, JSON.stringify(value));
      return value;
    } catch (err) {
      console.error('Cache error:', err.message);
      return fallback();
    }
  },

  /**
   * Invalidate cache key(s)
   */
  async invalidate(...keys) {
    if (!isConnected || !redis) return;
    
    try {
      await redis.del(...keys);
    } catch (err) {
      console.error('Cache invalidation error:', err.message);
    }
  },

  /**
   * Invalidate all keys matching pattern
   */
  async invalidatePattern(pattern) {
    if (!isConnected || !redis) return;
    
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      console.error('Cache pattern invalidation error:', err.message);
    }
  },

  /**
   * Set a value directly
   */
  async set(key, value, ttl = 300) {
    if (!isConnected || !redis) return;
    
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (err) {
      console.error('Cache set error:', err.message);
    }
  },

  /**
   * Get a value directly
   */
  async get(key) {
    if (!isConnected || !redis) return null;
    
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      console.error('Cache get error:', err.message);
      return null;
    }
  }
};

// Cache key generators
const cacheKeys = {
  userBalances: (userId) => `balances:user:${userId}`,
  groupBalances: (groupId) => `balances:group:${groupId}`,
  groupMembers: (groupId) => `group:members:${groupId}`,
  userGroups: (userId) => `user:groups:${userId}`,
  settlements: (userId) => `settlements:${userId}`,
  groupSettlements: (groupId) => `settlements:group:${groupId}`
};

module.exports = { initRedis, getRedis, isRedisConnected, cache, cacheKeys };
