const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const balanceController = require('../controllers/balanceController');
const { writeLimiter } = require('../middleware/rateLimiter');

router.use(auth);

// Read operations
router.get('/', balanceController.getBalances);
router.get('/settlements', balanceController.getSettlementSuggestions);
router.get('/details/:userId', balanceController.getBalanceDetails);

// Write operations have stricter rate limits
router.post('/settle', writeLimiter, balanceController.settle);

module.exports = router;
