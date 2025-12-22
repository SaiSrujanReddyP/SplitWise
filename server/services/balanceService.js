/**
 * Balance Service - Unified interface for balance management
 * 
 * This service provides backwards compatibility while using the new
 * scalable Balance collection under the hood.
 * 
 * Design Decision: Facade pattern
 * - Maintains existing API for controllers
 * - Delegates to balanceServiceV2 for actual operations
 * - Supports gradual migration from embedded to separate collection
 */

const Group = require('../models/Group');
const Balance = require('../models/Balance');
const DirectBalance = require('../models/DirectBalance');
const User = require('../models/User');
const { BalanceCalculator } = require('../shared');
const { withLock } = require('../utils/distributedLock');
const { cache, cacheKeys } = require('../config/redis');
const balanceServiceV2 = require('./balanceServiceV2');

// Use V2 service by default (set to false for legacy behavior)
const USE_V2 = process.env.USE_BALANCE_V2 !== 'false';

/**
 * Convert Mongoose Map to plain object for BalanceCalculator
 */
const mapToObject = (map) => {
  if (!map) return {};
  const obj = {};
  for (const [key, value] of map.entries()) {
    if (value instanceof Map) {
      obj[key] = mapToObject(value);
    } else {
      obj[key] = value;
    }
  }
  return obj;
};

/**
 * Convert plain object to Mongoose Map
 */
const objectToMap = (obj) => {
  const map = new Map();
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      map.set(key, objectToMap(value));
    } else {
      map.set(key, value);
    }
  }
  return map;
};

/**
 * Update group balances after an expense
 */
const updateBalances = async (groupId, payerId, splits, expenseId = null) => {
  if (USE_V2) {
    return balanceServiceV2.updateBalances(groupId, payerId, splits, expenseId);
  }

  // Legacy implementation using embedded Map
  return withLock(`group:${groupId}`, async () => {
    const group = await Group.findById(groupId);
    if (!group) throw new Error('Group not found');

    const calculator = new BalanceCalculator();
    calculator.loadBalances(mapToObject(group.balances));

    for (const split of splits) {
      calculator.addDebt(split.userId, payerId, split.amount);
    }

    group.balances = objectToMap(calculator.getBalances());
    await group.save();

    return calculator.getBalances();
  });
};

/**
 * Update direct (non-group) balances between users
 */
const updateDirectBalances = async (payerId, splits, expenseId = null) => {
  if (USE_V2) {
    return balanceServiceV2.updateDirectBalances(payerId, splits, expenseId);
  }

  // Legacy implementation using DirectBalance collection
  for (const split of splits) {
    if (split.userId === payerId.toString()) continue;
    
    const debtorId = split.userId;
    const creditorId = payerId.toString();
    const amount = split.amount;

    const reverseBalance = await DirectBalance.findOne({
      debtor: creditorId,
      creditor: debtorId
    });

    if (reverseBalance && reverseBalance.amount > 0) {
      if (reverseBalance.amount >= amount) {
        reverseBalance.amount -= amount;
        reverseBalance.lastUpdated = new Date();
        await reverseBalance.save();
      } else {
        const remaining = amount - reverseBalance.amount;
        reverseBalance.amount = 0;
        await reverseBalance.save();
        
        await DirectBalance.findOneAndUpdate(
          { debtor: debtorId, creditor: creditorId },
          { $inc: { amount: remaining }, lastUpdated: new Date() },
          { upsert: true, new: true }
        );
      }
    } else {
      await DirectBalance.findOneAndUpdate(
        { debtor: debtorId, creditor: creditorId },
        { $inc: { amount: amount }, lastUpdated: new Date() },
        { upsert: true, new: true }
      );
    }
  }
};

/**
 * Get balances for a group
 */
const getGroupBalances = async (groupId) => {
  if (USE_V2) {
    return balanceServiceV2.getGroupBalances(groupId);
  }

  const group = await Group.findById(groupId).populate('members', 'name email');
  if (!group) throw new Error('Group not found');
  return mapToObject(group.balances);
};

/**
 * Get user's balances across all groups AND direct balances
 */
const getUserBalances = async (userId) => {
  if (USE_V2) {
    return balanceServiceV2.getUserBalances(userId);
  }

  // Legacy implementation
  const groups = await Group.find({ members: userId }).populate('members', 'name email');
  
  const calculator = new BalanceCalculator();
  
  for (const group of groups) {
    const groupBalances = mapToObject(group.balances);
    for (const [debtor, creditors] of Object.entries(groupBalances)) {
      for (const [creditor, amount] of Object.entries(creditors)) {
        calculator.addDebt(debtor, creditor, amount);
      }
    }
  }

  const directOwes = await DirectBalance.find({ debtor: userId, amount: { $gt: 0 } });
  const directOwed = await DirectBalance.find({ creditor: userId, amount: { $gt: 0 } });

  for (const db of directOwes) {
    calculator.addDebt(db.debtor.toString(), db.creditor.toString(), db.amount);
  }
  for (const db of directOwed) {
    calculator.addDebt(db.debtor.toString(), db.creditor.toString(), db.amount);
  }

  const userBalances = calculator.getUserBalances(userId);
  
  const userIds = new Set();
  for (const group of groups) {
    for (const member of group.members) {
      userIds.add(member._id.toString());
    }
  }
  for (const db of directOwes) userIds.add(db.creditor.toString());
  for (const db of directOwed) userIds.add(db.debtor.toString());

  const users = await User.find({ _id: { $in: Array.from(userIds) } }).select('name email');
  const allUsers = new Map();
  for (const user of users) {
    allUsers.set(user._id.toString(), { id: user._id.toString(), name: user.name, email: user.email });
  }

  return {
    owes: userBalances.owes.map(item => ({
      ...item,
      user: allUsers.get(item.to)
    })),
    owed: userBalances.owed.map(item => ({
      ...item,
      user: allUsers.get(item.from)
    })),
    totalOwes: userBalances.totalOwes,
    totalOwed: userBalances.totalOwed,
    netBalance: userBalances.netBalance
  };
};

/**
 * Settle a balance
 */
const settleBalance = async (groupId, debtorId, creditorId, amount) => {
  if (USE_V2) {
    return balanceServiceV2.settleBalance(groupId, debtorId, creditorId, amount);
  }

  const activityService = require('./activityService');
  
  if (groupId === 'direct') {
    const directBalance = await DirectBalance.findOne({
      debtor: debtorId,
      creditor: creditorId
    });

    if (!directBalance || directBalance.amount < amount) {
      throw new Error('Invalid settlement amount');
    }

    directBalance.amount -= amount;
    directBalance.lastUpdated = new Date();
    await directBalance.save();

    await activityService.logActivity('settlement', debtorId, {
      amount,
      fromUser: debtorId,
      toUser: creditorId,
      description: `Direct settlement of ${amount.toFixed(2)}`
    });

    return { settled: true };
  }

  const result = await withLock(`group:${groupId}`, async () => {
    const group = await Group.findById(groupId);
    if (!group) throw new Error('Group not found');

    const calculator = new BalanceCalculator();
    calculator.loadBalances(mapToObject(group.balances));

    const success = calculator.settleDebt(debtorId, creditorId, amount);
    if (!success) throw new Error('Invalid settlement amount');

    group.balances = objectToMap(calculator.getBalances());
    await group.save();

    return { balances: calculator.getBalances(), groupName: group.name };
  });

  await activityService.logActivity('settlement', debtorId, {
    groupId,
    amount,
    fromUser: debtorId,
    toUser: creditorId,
    groupName: result.groupName,
    description: `Settlement of ${amount.toFixed(2)}`
  });

  return result.balances;
};

/**
 * Get balance details (which expenses contributed to a balance)
 */
const getBalanceDetails = async (userId, otherUserId) => {
  if (USE_V2) {
    return balanceServiceV2.getBalanceDetails(userId, otherUserId);
  }

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

module.exports = {
  updateBalances,
  updateDirectBalances,
  getGroupBalances,
  getUserBalances,
  settleBalance,
  getBalanceDetails,
  mapToObject,
  objectToMap
};
