const balanceService = require('../services/balanceService');
const settlementService = require('../services/settlementService');

const getBalances = async (req, res) => {
  try {
    const balances = await balanceService.getUserBalances(req.userId);
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getGroupBalances = async (req, res) => {
  try {
    const balances = await balanceService.getGroupBalances(req.params.groupId);
    res.json(balances);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

const settle = async (req, res) => {
  try {
    const { groupId, creditorId, amount } = req.body;
    const balances = await balanceService.settleBalance(groupId, req.userId, creditorId, amount);
    res.json({ message: 'Settlement recorded', balances });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getSettlementSuggestions = async (req, res) => {
  try {
    const settlements = await settlementService.getUserSettlements(req.userId);
    res.json(settlements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getGroupSettlementSuggestions = async (req, res) => {
  try {
    const settlements = await settlementService.getGroupSettlements(req.params.groupId);
    res.json(settlements);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

const getBalanceDetails = async (req, res) => {
  try {
    const details = await balanceService.getBalanceDetails(req.userId, req.params.userId);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { 
  getBalances, 
  getGroupBalances, 
  settle, 
  getSettlementSuggestions, 
  getGroupSettlementSuggestions,
  getBalanceDetails 
};
