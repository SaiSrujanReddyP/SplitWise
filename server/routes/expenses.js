const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const expenseController = require('../controllers/expenseController');
const { writeLimiter, searchLimiter } = require('../middleware/rateLimiter');

router.use(auth);

// Write operations have stricter rate limits
router.post('/', writeLimiter, expenseController.createExpense);

// Read operations
router.get('/mine', expenseController.getUserExpenses);
router.get('/search-users', searchLimiter, expenseController.searchUsers);
router.get('/:id', expenseController.getExpenseById);

module.exports = router;
