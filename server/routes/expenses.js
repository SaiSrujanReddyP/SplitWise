const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const expenseController = require('../controllers/expenseController');

router.use(auth);

router.post('/', expenseController.createExpense);
router.get('/mine', expenseController.getUserExpenses);
router.get('/search-users', expenseController.searchUsers);
router.get('/:id', expenseController.getExpenseById);

module.exports = router;
