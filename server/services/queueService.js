/**
 * Queue Service - Background job processing
 * 
 * Design Decision: Async processing for non-critical operations
 * - Activity logging doesn't need to block API response
 * - Balance recalculation can be eventually consistent
 * - Notifications can be sent asynchronously
 * 
 * Benefits:
 * - Faster API response times
 * - Better fault tolerance (retries on failure)
 * - Decoupled components
 */

const { activityQueue, balanceQueue, notificationQueue } = require('../utils/queue');

/**
 * Initialize queue handlers
 */
const initQueues = () => {
  // Activity logging handler
  activityQueue.process('log', async (data) => {
    const Activity = require('../models/Activity');
    
    const activity = new Activity({
      type: data.type,
      user: data.userId,
      group: data.groupId,
      expense: data.expenseId,
      data: {
        description: data.description,
        amount: data.amount,
        fromUser: data.fromUser,
        toUser: data.toUser,
        groupName: data.groupName
      }
    });
    
    await activity.save();
  });

  // Balance recalculation handler
  balanceQueue.process('recalculate', async (data) => {
    const { recalculateGroupBalances } = require('./balanceServiceV2');
    await recalculateGroupBalances(data.groupId);
  });

  // Cache invalidation handler
  balanceQueue.process('invalidateCache', async (data) => {
    const { cache, cacheKeys } = require('../config/redis');
    
    if (data.userId) {
      await cache.invalidate(cacheKeys.userBalances(data.userId));
      await cache.invalidate(cacheKeys.settlements(data.userId));
    }
    
    if (data.groupId) {
      await cache.invalidate(cacheKeys.groupBalances(data.groupId));
      await cache.invalidate(cacheKeys.groupSettlements(data.groupId));
    }
  });

  // Notification handler (placeholder for email/push notifications)
  notificationQueue.process('send', async (data) => {
    // TODO: Implement actual notification sending
    // - Email via SendGrid/SES
    // - Push via Firebase/OneSignal
    console.log(`📧 Notification: ${data.type} to ${data.userId}`);
  });

  console.log('✅ Job queues initialized');
};

/**
 * Queue an activity log (non-blocking)
 */
const queueActivityLog = async (type, userId, data) => {
  return activityQueue.add('log', {
    type,
    userId,
    ...data
  });
};

/**
 * Queue balance recalculation
 */
const queueBalanceRecalculation = async (groupId) => {
  return balanceQueue.add('recalculate', { groupId });
};

/**
 * Queue cache invalidation
 */
const queueCacheInvalidation = async (data) => {
  return balanceQueue.add('invalidateCache', data);
};

/**
 * Queue notification
 */
const queueNotification = async (type, userId, data) => {
  return notificationQueue.add('send', {
    type,
    userId,
    ...data
  });
};

module.exports = {
  initQueues,
  queueActivityLog,
  queueBalanceRecalculation,
  queueCacheInvalidation,
  queueNotification
};
