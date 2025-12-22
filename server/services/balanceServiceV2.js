/**
 * Balance Service V2 - Scalable balance management
 * 
 * Design Decisions:
 * 1. Uses separate Balance collection instead of embedded Map
 * 2. Supports both group and direct (non-group) balances
 * 3. Integrates with Redis caching for read performance
 * 4. Uses distributed locks for write consistency
 * 5. Async cache invalidation via job queue
 * 
 * Performance characteristics:
 * - Read: O(1) with cache hit, O(n) cache miss where n = number of balances
 * - Write: O(1) per balance update
 * - Settlement: O(1) single balance update
 */

const Balance = require('../models/Balance');
const User = require('../models/User');
const Group = require('../models/Group');
const { BalanceCalculator } = require('../shared');
const { withLock } = require('../utils/distributedLock');
const { cache, cacheKeys } = require('../config/redis');
const { queueCacheInvalidation, queueActivityLog } = require('./queueService');

const BALANCE_CACHE_TTL = 300; // 5 minutes

/**
 * Update balances after an expense (group expense)
 */
const updateBalances = async (groupId, payerId, splits, expenseId = null) => {
  return withLock(`group:${groupId}`, async () => {
    const operations = [];
    
    for (const split of splits) {
      if (split.userId === payerId.toString()) continue;
      if (split.amount <= 0) continue;

      const debtorId = split.userId;
      const creditorId = payerId.toString();

      // Check for reverse balance (simplification)
      const reverseBalance = await Balance.findOne({
        group: groupId,
        debtor: creditorId,
        creditor: debtorId
      });

      if (reverseBalance && reverseBalance.amount > 0) {
        // Simplify: cancel out mutual debts
        if (reverseBalance.amount >= split.amount) {
          reverseBalance.amount -= split.amount;
          reverseBalance.lastUpdated = new Date();
          reverseBalance.lastExpenseId = expenseId;
          await reverseBalance.save();
        } else {
          const remaining = split.amount - reverseBalance.amount;
          reverseBalance.amount = 0;
          await reverseBalance.save();
          
          // Add remaining to forward balance
          await Balance.findOneAndUpdate(
            { group: groupId, debtor: debtorId, creditor: creditorId },
            { 
              $inc: { amount: remaining },
              $set: { lastUpdated: new Date(), lastExpenseId: expenseId }
            },
            { upsert: true }
          );
        }
      } else {
        // No reverse balance, add to forward
        await Balance.findOneAndUpdate(
          { group: groupId, debtor: debtorId, creditor: creditorId },
          { 
            $inc: { amount: split.amount },
            $set: { lastUpdated: new Date(), lastExpenseId: expenseId }
          },
          { upsert: true }
        );
      }
    }

    // Invalidate caches asynchronously
    const affectedUsers = [payerId, ...splits.map(s => s.userId)];
    for (const userId of affectedUsers) {
      queueCacheInvalidation({ userId, groupId });
    }

    return true;
  });
};

/**
 * Update direct (non-group) balances
 */
const updateDirectBalances = async (payerId, splits, expenseId = null) => {
  return withLock(`direct:${payerId}`, async () => {
    for (const split of splits) {
      if (split.userId === payerId.toString()) continue;
      if (split.amount <= 0) continue;

      const debtorId = split.userId;
      const creditorId = payerId.toString();

      // Check for reverse balance
      const reverseBalance = await Balance.findOne({
        group: null,
        debtor: creditorId,
        creditor: debtorId
      });

      if (reverseBalance && reverseBalance.amount > 0) {
        if (reverseBalance.amount >= split.amount) {
          reverseBalance.amount -= split.amount;
          reverseBalance.lastUpdated = new Date();
          await reverseBalance.save();
        } else {
          const remaining = split.amount - reverseBalance.amount;
          reverseBalance.amount = 0;
          await reverseBalance.save();
          
          await Balance.findOneAndUpdate(
            { group: null, debtor: debtorId, creditor: creditorId },
            { 
              $inc: { amount: remaining },
              $set: { lastUpdated: new Date(), lastExpenseId: expenseId }
            },
            { upsert: true }
          );
        }
      } else {
        await Balance.findOneAndUpdate(
          { group: null, debtor: debtorId, creditor: creditorId },
          { 
            $inc: { amount: split.amount },
            $set: { lastUpdated: new Date(), lastExpenseId: expenseId }
          },
          { upsert: true }
        );
      }
    }

    // Invalidate caches
    const affectedUsers = [payerId, ...splits.map(s => s.userId)];
    for (const userId of affectedUsers) {
      queueCacheInvalidation({ userId });
    }

    return true;
  });
};

/**
 * Get balances for a specific group
 */
const getGroupBalances = async (groupId) => {
  return cache.getOrSet(
    cacheKeys.groupBalances(groupId),
    async () => {
      const balances = await Balance.find({ 
        group: groupId, 
        amount: { $gt: 0 } 
      });

      // Convert to matrix format for compatibility
      const matrix = {};
      for (const b of balances) {
        const debtorId = b.debtor.toString();
        const creditorId = b.creditor.toString();
        if (!matrix[debtorId]) matrix[debtorId] = {};
        matrix[debtorId][creditorId] = b.amount;
      }

      return matrix;
    },
    BALANCE_CACHE_TTL
  );
};

/**
 * Get user's balances across all groups and direct balances
 */
const getUserBalances = async (userId) => {
  return cache.getOrSet(
    cacheKeys.userBalances(userId),
    async () => {
      // Get all balances where user is debtor or creditor
      const [owesBalances, owedBalances] = await Promise.all([
        Balance.find({ debtor: userId, amount: { $gt: 0 } }),
        Balance.find({ creditor: userId, amount: { $gt: 0 } })
      ]);

      // Aggregate by user (combine group and direct balances)
      const owesMap = new Map();
      const owedMap = new Map();

      for (const b of owesBalances) {
        const creditorId = b.creditor.toString();
        owesMap.set(creditorId, (owesMap.get(creditorId) || 0) + b.amount);
      }

      for (const b of owedBalances) {
        const debtorId = b.debtor.toString();
        owedMap.set(debtorId, (owedMap.get(debtorId) || 0) + b.amount);
      }

      // Get user details
      const userIds = new Set([...owesMap.keys(), ...owedMap.keys()]);
      const users = await User.find({ _id: { $in: Array.from(userIds) } })
        .select('name email');
      const userMap = new Map(users.map(u => [u._id.toString(), u]));

      // Build response
      const owes = [];
      const owed = [];
      let totalOwes = 0;
      let totalOwed = 0;

      for (const [creditorId, amount] of owesMap) {
        owes.push({
          to: creditorId,
          amount,
          user: userMap.get(creditorId)
        });
        totalOwes += amount;
      }

      for (const [debtorId, amount] of owedMap) {
        owed.push({
          from: debtorId,
          amount,
          user: userMap.get(debtorId)
        });
        totalOwed += amount;
      }

      return {
        owes,
        owed,
        totalOwes,
        totalOwed,
        netBalance: totalOwed - totalOwes
      };
    },
    BALANCE_CACHE_TTL
  );
};

/**
 * Settle a balance
 */
const settleBalance = async (groupId, debtorId, creditorId, amount) => {
  const isDirectSettlement = groupId === 'direct';
  const lockKey = isDirectSettlement ? `direct:${debtorId}` : `group:${groupId}`;

  return withLock(lockKey, async () => {
    const query = isDirectSettlement
      ? { group: null, debtor: debtorId, creditor: creditorId }
      : { group: groupId, debtor: debtorId, creditor: creditorId };

    const balance = await Balance.findOne(query);

    if (!balance || balance.amount < amount) {
      throw new Error('Invalid settlement amount');
    }

    balance.amount -= amount;
    balance.lastUpdated = new Date();
    await balance.save();

    // Log activity asynchronously
    queueActivityLog('settlement', debtorId, {
      groupId: isDirectSettlement ? null : groupId,
      amount,
      fromUser: debtorId,
      toUser: creditorId,
      description: `Settlement of ${amount.toFixed(2)}`
    });

    // Invalidate caches
    queueCacheInvalidation({ userId: debtorId, groupId: isDirectSettlement ? null : groupId });
    queueCacheInvalidation({ userId: creditorId, groupId: isDirectSettlement ? null : groupId });

    return { settled: true, remainingBalance: balance.amount };
  });
};

/**
 * Get balance details (expenses contributing to a balance)
 */
const getBalanceDetails = async (userId, otherUserId) => {
  const Expense = require('../models/Expense');
  
  const expenses = await Expense.find({
    $or: [
      { paidBy: userId, 'splits.userId': otherUserId },
      { paidBy: otherUserId, 'splits.userId': userId }
    ]
  })
    .populate('paidBy', 'name email')
    .populate('group', 'name')
    .sort({ date: -1, createdAt: -1 })
    .limit(20);

  return expenses.map(e => {
    const split = e.splits.find(s => 
      s.userId.toString() === userId || s.userId.toString() === otherUserId
    );
    return {
      _id: e._id,
      description: e.description,
      amount: e.amount,
      splitAmount: split?.amount || 0,
      paidBy: e.paidBy,
      group: e.group,
      date: e.date || e.createdAt,
      splitType: e.splitType
    };
  });
};

/**
 * Recalculate all balances for a group (for data repair)
 */
const recalculateGroupBalances = async (groupId) => {
  const Expense = require('../models/Expense');
  
  return withLock(`group:${groupId}`, async () => {
    // Clear existing balances
    await Balance.deleteMany({ group: groupId });

    // Get all expenses for the group
    const expenses = await Expense.find({ group: groupId });

    // Recalculate using BalanceCalculator
    const calculator = new BalanceCalculator();

    for (const expense of expenses) {
      for (const split of expense.splits) {
        if (split.userId.toString() !== expense.paidBy.toString()) {
          calculator.addDebt(split.userId.toString(), expense.paidBy.toString(), split.amount);
        }
      }
    }

    // Save new balances
    const balances = calculator.getBalances();
    const operations = [];

    for (const [debtorId, creditors] of Object.entries(balances)) {
      for (const [creditorId, amount] of Object.entries(creditors)) {
        if (amount > 0) {
          operations.push({
            insertOne: {
              document: {
                group: groupId,
                debtor: debtorId,
                creditor: creditorId,
                amount,
                lastUpdated: new Date()
              }
            }
          });
        }
      }
    }

    if (operations.length > 0) {
      await Balance.bulkWrite(operations);
    }

    // Invalidate cache
    await cache.invalidate(cacheKeys.groupBalances(groupId));

    return balances;
  });
};

/**
 * Migrate from embedded balances to Balance collection
 */
const migrateGroupBalances = async (groupId) => {
  const group = await Group.findById(groupId);
  if (!group || !group.balances) return;

  const operations = [];

  // Convert Map to Balance documents
  for (const [debtorId, creditors] of group.balances.entries()) {
    for (const [creditorId, amount] of creditors.entries()) {
      if (amount > 0) {
        operations.push({
          updateOne: {
            filter: { group: groupId, debtor: debtorId, creditor: creditorId },
            update: { $set: { amount, lastUpdated: new Date() } },
            upsert: true
          }
        });
      }
    }
  }

  if (operations.length > 0) {
    await Balance.bulkWrite(operations);
  }

  // Mark group as migrated
  group.useNewBalances = true;
  await group.save();

  return operations.length;
};

module.exports = {
  updateBalances,
  updateDirectBalances,
  getGroupBalances,
  getUserBalances,
  settleBalance,
  getBalanceDetails,
  recalculateGroupBalances,
  migrateGroupBalances
};
