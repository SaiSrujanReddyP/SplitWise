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
const Balance = require('../models/Balance');
const User = require('../models/User');
const { cache, cacheKeys } = require('../config/redis');

const USE_V2 = process.env.USE_BALANCE_V2 !== 'false';
const SETTLEMENT_CACHE_TTL = 300; // 5 minutes

/**
 * Convert Mongoose Map to plain object
 */
const mapToObject = (map) => {
  if (!map) return {};
  const obj = {};
  for (const [key, value] of map.entries()) {
    if (value instanceof Map) {
      obj[key] = mapToObject(value);
    } else {
      obj[key] = value;
    }
  }
  return obj;
};

/**
 * Calculate net balances for all users from balance matrix
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
 * Calculate net balances from Balance collection documents
 */
function calculateNetBalancesFromDocs(balanceDocs) {
  const netBalances = {};

  for (const b of balanceDocs) {
    const debtor = b.debtor.toString();
    const creditor = b.creditor.toString();
    const amount = b.amount;

    netBalances[debtor] = (netBalances[debtor] || 0) - amount;
    netBalances[creditor] = (netBalances[creditor] || 0) + amount;
  }

  return netBalances;
}

/**
 * Generate minimal settlement transactions using greedy algorithm
 * 
 * @param {Object} netBalances - Net balance per user
 * @returns {Array} Array of { from, to, amount } transactions
 */
function generateSettlementsFromNetBalances(netBalances) {
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
 * Generate settlements from balance matrix (legacy format)
 */
function generateSettlements(balances) {
  const netBalances = calculateNetBalances(balances);
  return generateSettlementsFromNetBalances(netBalances);
}

/**
 * Get settlement suggestions for a group
 */
async function getGroupSettlements(groupId) {
  // Try cache first
  const cached = await cache.get(cacheKeys.groupSettlements(groupId));
  if (cached) return cached;

  const group = await Group.findById(groupId).populate('members', 'name email');
  if (!group) {
    throw new Error('Group not found');
  }

  let settlements;

  if (USE_V2) {
    // Use new Balance collection
    const balanceDocs = await Balance.find({ group: groupId, amount: { $gt: 0 } });
    const netBalances = calculateNetBalancesFromDocs(balanceDocs);
    settlements = generateSettlementsFromNetBalances(netBalances);
  } else {
    // Use legacy embedded balances
    const balances = mapToObject(group.balances);
    settlements = generateSettlements(balances);
  }

  // Enrich with user names
  const userMap = {};
  group.members.forEach(m => {
    userMap[m._id.toString()] = { name: m.name, email: m.email };
  });

  const result = settlements.map(s => ({
    ...s,
    fromUser: userMap[s.from] || { name: 'Unknown' },
    toUser: userMap[s.to] || { name: 'Unknown' }
  }));

  // Cache the result
  await cache.set(cacheKeys.groupSettlements(groupId), result, SETTLEMENT_CACHE_TTL);

  return result;
}

/**
 * Get global settlement suggestions across all groups for a user
 */
async function getUserSettlements(userId) {
  // Try cache first
  const cached = await cache.get(cacheKeys.settlements(userId));
  if (cached) return cached;

  let settlements;
  const userMap = {};

  if (USE_V2) {
    // Get all balances where user is involved
    const [owesBalances, owedBalances] = await Promise.all([
      Balance.find({ debtor: userId, amount: { $gt: 0 } }),
      Balance.find({ creditor: userId, amount: { $gt: 0 } })
    ]);

    // Combine all balances
    const allBalances = [...owesBalances, ...owedBalances];
    
    // Get unique user IDs
    const userIds = new Set();
    allBalances.forEach(b => {
      userIds.add(b.debtor.toString());
      userIds.add(b.creditor.toString());
    });

    // Fetch user details
    const users = await User.find({ _id: { $in: Array.from(userIds) } }).select('name email');
    users.forEach(u => {
      userMap[u._id.toString()] = { name: u.name, email: u.email };
    });

    const netBalances = calculateNetBalancesFromDocs(allBalances);
    settlements = generateSettlementsFromNetBalances(netBalances);
  } else {
    // Legacy: aggregate from all groups
    const groups = await Group.find({ members: userId }).populate('members', 'name email');
    const globalBalances = {};

    for (const group of groups) {
      const balances = mapToObject(group.balances);
      
      group.members.forEach(m => {
        userMap[m._id.toString()] = { name: m.name, email: m.email };
      });

      for (const [debtor, creditors] of Object.entries(balances)) {
        if (!globalBalances[debtor]) globalBalances[debtor] = {};
        for (const [creditor, amount] of Object.entries(creditors)) {
          globalBalances[debtor][creditor] = (globalBalances[debtor][creditor] || 0) + amount;
        }
      }
    }

    settlements = generateSettlements(globalBalances);
  }

  const result = settlements.map(s => ({
    ...s,
    fromUser: userMap[s.from] || { name: 'Unknown' },
    toUser: userMap[s.to] || { name: 'Unknown' }
  }));

  // Cache the result
  await cache.set(cacheKeys.settlements(userId), result, SETTLEMENT_CACHE_TTL);

  return result;
}

module.exports = {
  generateSettlements,
  generateSettlementsFromNetBalances,
  getGroupSettlements,
  getUserSettlements,
  calculateNetBalances,
  calculateNetBalancesFromDocs
};
