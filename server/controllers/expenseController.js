const expenseService = require('../services/expenseService');

const createExpense = async (req, res) => {
  try {
    const expense = await expenseService.createExpense({
      ...req.body,
      paidBy: req.userId
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getExpensesByGroup = async (req, res) => {
  try {
    const expenses = await expenseService.getExpensesByGroup(req.params.groupId, req.userId);
    res.json(expenses);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const expense = await expenseService.getExpenseById(req.params.id, req.userId);
    res.json(expense);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

const getUserExpenses = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const expenses = await expenseService.getUserExpenses(req.userId, limit);
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const searchUsers = async (req, res) => {
  try {
    const users = await expenseService.searchUsers(req.query.q, req.userId);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createExpense, getExpensesByGroup, getExpenseById, getUserExpenses, searchUsers };
