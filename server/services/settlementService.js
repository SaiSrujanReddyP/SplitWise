/**
 * Settlement Service - Converts net balances into minimal payment transactions
 * 
 * Uses a greedy algorithm to minimize the number of transactions needed
 * to settle all debts within a group.
 * 
 * Algorithm:
 * 1. Calculate net balance for each user (positive = owed money, negative = owes money)
 * 2. Separate into creditors (positive) and debtors (negative)
 * 3. Greedily match largest debtor with largest creditor
 * 4. Create transaction for min(debt, credit), adjust balances, repeat
 * 
 * Time Complexity: O(n²) where n = number of users
 * Space Complexity: O(n)
 */

const Group = require('../models/Group');
const { mapToObject } = require('./balanceService');

/**
 * Calculate net balances for all users in a group
 * Positive = user is owed money, Negative = user owes money
 */
function calculateNetBalances(balances) {
  const netBalances = {};

  for (const [debtor, creditors] of Object.entries(balances)) {
    for (const [creditor, amount] of Object.entries(creditors)) {
      // Debtor owes money (negative)
      netBalances[debtor] = (netBalances[debtor] || 0) - amount;
      // Creditor is owed money (positive)
      netBalances[creditor] = (netBalances[creditor] || 0) + amount;
    }
  }

  return netBalances;
}

/**
 * Generate minimal settlement transactions using greedy algorithm
 * 
 * @param {Object} balances - Balance matrix from group
 * @returns {Array} Array of { from, to, amount } transactions
 */
function generateSettlements(balances) {
  const netBalances = calculateNetBalances(balances);
  const transactions = [];

  // Separate into creditors and debtors
  const creditors = []; // People who are owed money (positive balance)
  const debtors = [];   // People who owe money (negative balance)

  for (const [userId, balance] of Object.entries(netBalances)) {
    if (balance > 0.01) {
      creditors.push({ userId, amount: balance });
    } else if (balance < -0.01) {
      debtors.push({ userId, amount: -balance }); // Store as positive for easier math
    }
  }

  // Sort by amount descending (greedy: settle largest amounts first)
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Greedy matching
  let i = 0; // creditor index
  let j = 0; // debtor index

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    // Transaction amount is the minimum of what's owed and what's due
    const amount = Math.min(creditor.amount, debtor.amount);

    if (amount > 0.01) {
      transactions.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Math.round(amount * 100) / 100
      });
    }

    // Reduce balances
    creditor.amount -= amount;
    debtor.amount -= amount;

    // Move to next if settled
    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }

  return transactions;
}

/**
 * Get settlement suggestions for a group
 */
async function getGroupSettlements(groupId) {
  const group = await Group.findById(groupId).populate('members', 'name email');
  if (!group) {
    throw new Error('Group not found');
  }

  const balances = mapToObject(group.balances);
  const settlements = generateSettlements(balances);

  // Enrich with user names
  const userMap = {};
  group.members.forEach(m => {
    userMap[m._id.toString()] = { name: m.name, email: m.email };
  });

  return settlements.map(s => ({
    ...s,
    fromUser: userMap[s.from] || { name: 'Unknown' },
    toUser: userMap[s.to] || { name: 'Unknown' }
  }));
}

/**
 * Get global settlement suggestions across all groups for a user
 */
async function getUserSettlements(userId) {
  const Group = require('../models/Group');
  const groups = await Group.find({ members: userId }).populate('members', 'name email');

  // Aggregate all balances
  const globalBalances = {};
  const userMap = {};

  for (const group of groups) {
    const balances = mapToObject(group.balances);
    
    // Build user map
    group.members.forEach(m => {
      userMap[m._id.toString()] = { name: m.name, email: m.email };
    });

    // Merge balances
    for (const [debtor, creditors] of Object.entries(balances)) {
      if (!globalBalances[debtor]) globalBalances[debtor] = {};
      for (const [creditor, amount] of Object.entries(creditors)) {
        globalBalances[debtor][creditor] = (globalBalances[debtor][creditor] || 0) + amount;
      }
    }
  }

  const settlements = generateSettlements(globalBalances);

  return settlements.map(s => ({
    ...s,
    fromUser: userMap[s.from] || { name: 'Unknown' },
    toUser: userMap[s.to] || { name: 'Unknown' }
  }));
}

module.exports = {
  generateSettlements,
  getGroupSettlements,
  getUserSettlements,
  calculateNetBalances
};
