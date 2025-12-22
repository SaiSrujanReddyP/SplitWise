const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const groupController = require('../controllers/groupController');
const expenseController = require('../controllers/expenseController');
const balanceController = require('../controllers/balanceController');
const { writeLimiter } = require('../middleware/rateLimiter');

router.use(auth);

// Write operations
router.post('/', writeLimiter, groupController.createGroup);
router.post('/:id/members', writeLimiter, groupController.addMember);
router.delete('/:id', writeLimiter, groupController.deleteGroup);

// Read operations
router.get('/', groupController.getGroups);
router.get('/:id', groupController.getGroupById);
router.get('/:groupId/expenses', expenseController.getExpensesByGroup);
router.get('/:groupId/balances', balanceController.getGroupBalances);
router.get('/:groupId/settlements', balanceController.getGroupSettlementSuggestions);

module.exports = router;
