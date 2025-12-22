const { getRedis, isRedisConnected } = require('../config/redis');

/**
 * Distributed Lock Manager
 * 
 * Design Decision: Redis-based distributed locking for horizontal scaling
 * - Uses Redlock algorithm for distributed mutex
 * - Falls back to in-memory locks when Redis unavailable
 * - Per-resource locking allows parallel operations on different resources
 * - Automatic lock extension for long-running operations
 * 
 * Why Redlock?
 * - Industry standard for distributed locking
 * - Handles network partitions and Redis failures gracefully
 * - Supports lock extension for operations that take longer than expected
 */

// In-memory fallback for single-instance deployments
const memoryLocks = new Map();

let redlock = null;

const initDistributedLock = async () => {
  const redis = getRedis();
  
  if (!redis) {
    console.log('⚠️  Using in-memory locks (single instance only)');
    return;
  }

  try {
    // Redlock v5 uses ES modules, dynamically import it
    const { default: Redlock } = await import('redlock');
    
    redlock = new Redlock([redis], {
      // Retry settings
      retryCount: 10,
      retryDelay: 200, // ms
      retryJitter: 200, // ms
      
      // Lock settings
      automaticExtensionThreshold: 500 // ms before expiry to auto-extend
    });

    redlock.on('error', (err) => {
      // Ignore resource unavailable errors (lock contention)
      if (err.name !== 'ResourceLockedError') {
        console.error('Redlock error:', err.message);
      }
    });

    console.log('✅ Distributed lock manager initialized');
  } catch (err) {
    console.log('⚠️  Redlock initialization failed, using in-memory locks:', err.message);
  }
};

/**
 * Execute function with distributed lock
 * 
 * @param {string} resource - Resource identifier (e.g., 'group:123')
 * @param {Function} fn - Async function to execute while holding lock
 * @param {number} ttl - Lock time-to-live in ms (default 5000)
 */
const withLock = async (resource, fn, ttl = 5000) => {
  const lockKey = `lock:${resource}`;

  // Use distributed lock if available
  if (redlock && isRedisConnected()) {
    let lock;
    try {
      lock = await redlock.acquire([lockKey], ttl);
      const result = await fn();
      return result;
    } finally {
      if (lock) {
        try {
          await lock.release();
        } catch (err) {
          // Lock may have expired, ignore
        }
      }
    }
  }

  // Fallback to in-memory lock
  return withMemoryLock(lockKey, fn);
};

/**
 * In-memory lock fallback
 */
const withMemoryLock = async (key, fn) => {
  // Wait for existing lock
  while (memoryLocks.has(key)) {
    await memoryLocks.get(key);
  }

  // Create lock promise
  let releaseLock;
  const lockPromise = new Promise(resolve => {
    releaseLock = resolve;
  });
  memoryLocks.set(key, lockPromise);

  try {
    return await fn();
  } finally {
    memoryLocks.delete(key);
    releaseLock();
  }
};

/**
 * Check if resource is locked (for monitoring)
 */
const isLocked = (resource) => {
  return memoryLocks.has(`lock:${resource}`);
};

/**
 * Get active lock count (for monitoring)
 */
const getActiveLockCount = () => {
  return memoryLocks.size;
};

module.exports = {
  initDistributedLock,
  withLock,
  isLocked,
  getActiveLockCount
};
