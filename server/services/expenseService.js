const Expense = require('../models/Expense');
const Group = require('../models/Group');
const User = require('../models/User');
const { calculateSplit, validateSplit } = require('../../shared');
const balanceService = require('./balanceService');
const activityService = require('./activityService');
const { buildCursorQuery, paginatedResponse } = require('../utils/pagination');

const createExpense = async (data) => {
  const { description, amount, paidBy, groupId, splitType, participants, date } = data;

  let group = null;
  let expenseParticipants = participants || [];

  // If groupId provided, verify group exists and payer is a member
  if (groupId) {
    group = await Group.findOne({ _id: groupId, members: paidBy });
    if (!group) {
      throw new Error('Group not found or you are not a member');
    }

    // If no participants specified, use all group members
    if (expenseParticipants.length === 0) {
      expenseParticipants = group.members.map(m => ({ userId: m.toString() }));
    }
  } else {
    // Non-group expense - participants must be specified
    if (expenseParticipants.length === 0) {
      throw new Error('Participants required for non-group expenses');
    }
  }

  // Validate split
  const validation = validateSplit(amount, splitType || 'equal', expenseParticipants);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Calculate splits
  const splits = calculateSplit(amount, splitType || 'equal', expenseParticipants, paidBy);

  // Create expense
  const expense = new Expense({
    description,
    amount,
    paidBy,
    group: groupId || null,
    splitType: splitType || 'equal',
    date: date ? new Date(date) : new Date(),
    participants: expenseParticipants,
    splits
  });

  await expense.save();

  // Update balances
  if (groupId) {
    await balanceService.updateBalances(groupId, paidBy, splits, expense._id);
  } else {
    // Non-group expense - update direct balances
    await balanceService.updateDirectBalances(paidBy, splits, expense._id);
  }

  // Log activity
  await activityService.logActivity('expense_added', paidBy, {
    groupId,
    expenseId: expense._id,
    description,
    amount,
    groupName: group?.name
  });

  return expense.populate(['paidBy', 'participants.userId', 'splits.userId']);
};

const getExpensesByGroup = async (groupId, userId, options = {}) => {
  const { limit = 20, page = 1, cursor = null } = options;

  const group = await Group.findOne({ _id: groupId, members: userId });
  if (!group) {
    throw new Error('Group not found');
  }

  const query = { group: groupId };
  const cursorQuery = cursor ? buildCursorQuery(cursor, 'next', 'date', -1) : {};
  const finalQuery = { ...query, ...cursorQuery };

  const expenses = await Expense.find(finalQuery)
    .populate('paidBy', 'name email')
    .populate('participants.userId', 'name email')
    .sort({ date: -1, createdAt: -1 })
    .limit(limit + 1);

  const hasMore = expenses.length > limit;
  if (hasMore) expenses.pop();

  // Get total for offset pagination
  const total = cursor ? null : await Expense.countDocuments(query);

  return paginatedResponse(expenses, { limit, page, cursor, total });
};

const getExpenseById = async (expenseId, userId) => {
  const expense = await Expense.findById(expenseId)
    .populate('paidBy', 'name email')
    .populate('participants.userId', 'name email')
    .populate('group');

  if (!expense) {
    throw new Error('Expense not found');
  }

  // Verify user has access
  if (expense.group && !expense.group.members.map(m => m.toString()).includes(userId.toString())) {
    throw new Error('Access denied');
  }

  return expense;
};

const getUserExpenses = async (userId, options = {}) => {
  const { limit = 20, page = 1, cursor = null } = options;

  const query = {
    $or: [
      { paidBy: userId },
      { 'participants.userId': userId },
      { 'splits.userId': userId }
    ]
  };

  const cursorQuery = cursor ? buildCursorQuery(cursor, 'next', 'date', -1) : {};
  const finalQuery = { ...query, ...cursorQuery };

  const expenses = await Expense.find(finalQuery)
    .populate('paidBy', 'name email')
    .populate('group', 'name')
    .populate('participants.userId', 'name email')
    .sort({ date: -1, createdAt: -1 })
    .limit(limit + 1);

  const hasMore = expenses.length > limit;
  if (hasMore) expenses.pop();

  const total = cursor ? null : await Expense.countDocuments(query);

  return paginatedResponse(expenses, { limit, page, cursor, total });
};

const searchUsers = async (query, excludeUserId) => {
  if (!query || query.length < 2) return [];
  
  return User.find({
    _id: { $ne: excludeUserId },
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } }
    ]
  })
    .select('name email')
    .limit(10);
};

module.exports = { 
  createExpense, 
  getExpensesByGroup, 
  getExpenseById, 
  getUserExpenses,
  searchUsers 
};
