const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/groups', require('./groups'));
router.use('/expenses', require('./expenses'));
router.use('/balances', require('./balances'));
router.use('/activities', require('./activities'));

module.exports = router;
