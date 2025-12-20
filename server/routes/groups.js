const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const groupController = require('../controllers/groupController');
const expenseController = require('../controllers/expenseController');
const balanceController = require('../controllers/balanceController');

router.use(auth);

router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);
router.get('/:id', groupController.getGroupById);
router.post('/:id/members', groupController.addMember);
router.get('/:groupId/expenses', expenseController.getExpensesByGroup);
router.get('/:groupId/balances', balanceController.getGroupBalances);
router.get('/:groupId/settlements', balanceController.getGroupSettlementSuggestions);

module.exports = router;
