/**
 * Lock Manager - Group-level write lock utility for Node.js
 * 
 * Ensures sequential write operations on a per-group basis using async functions.
 * This prevents race conditions when multiple users modify the same group's
 * balances simultaneously.
 * 
 * Design Decisions:
 * - Uses a Map to store lock queues per group (memory efficient)
 * - Each group has its own queue, allowing parallel operations on different groups
 * - Uses Promise-based queue to ensure FIFO ordering
 * - Automatically cleans up empty queues to prevent memory leaks
 * 
 * Usage:
 *   const result = await lockManager.withLock(groupId, async () => {
 *     // Your write operation here
 *     return someResult;
 *   });
 */

class LockManager {
  constructor() {
    // Map of groupId -> Promise (the current lock holder's promise)
    this.locks = new Map();
  }

  /**
   * Execute a function with an exclusive lock on the specified group
   * 
   * @param {string} groupId - The group to lock
   * @param {Function} fn - Async function to execute while holding the lock
   * @returns {Promise} Result of the function
   */
  async withLock(groupId, fn) {
    const key = groupId.toString();
    
    // Wait for any existing lock to release
    while (this.locks.has(key)) {
      try {
        await this.locks.get(key);
      } catch (e) {
        // Previous operation failed, but we can still proceed
      }
    }

    // Create our lock promise
    let releaseLock;
    const lockPromise = new Promise((resolve) => {
      releaseLock = resolve;
    });

    this.locks.set(key, lockPromise);

    try {
      // Execute the protected operation
      const result = await fn();
      return result;
    } finally {
      // Release the lock
      this.locks.delete(key);
      releaseLock();
    }
  }

  /**
   * Check if a group is currently locked
   */
  isLocked(groupId) {
    return this.locks.has(groupId.toString());
  }

  /**
   * Get the number of active locks (for monitoring)
   */
  getActiveLockCount() {
    return this.locks.size;
  }
}

// Singleton instance
const lockManager = new LockManager();

module.exports = lockManager;
