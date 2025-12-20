const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const balanceController = require('../controllers/balanceController');

router.use(auth);

router.get('/', balanceController.getBalances);
router.get('/settlements', balanceController.getSettlementSuggestions);
router.get('/details/:userId', balanceController.getBalanceDetails);
router.post('/settle', balanceController.settle);

module.exports = router;
