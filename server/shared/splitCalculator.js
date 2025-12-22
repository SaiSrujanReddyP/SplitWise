/**
 * Split Calculator - Handles different expense split types
 * 
 * Supported split types:
 * - equal: Amount divided equally among participants
 * - exact: Each participant owes a specific amount
 * - percentage: Each participant owes a percentage of total
 */

/**
 * Calculate splits based on type
 * @param {number} totalAmount - Total expense amount
 * @param {string} splitType - 'equal', 'exact', or 'percentage'
 * @param {Array} participants - Array of participant objects
 * @param {string} payerId - ID of the person who paid
 * @returns {Array} Array of { userId, amount } representing what each person owes
 */
function calculateSplit(totalAmount, splitType, participants, payerId) {
  switch (splitType) {
    case 'equal':
      return calculateEqualSplit(totalAmount, participants, payerId);
    case 'exact':
      return calculateExactSplit(participants, payerId);
    case 'percentage':
      return calculatePercentageSplit(totalAmount, participants, payerId);
    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}

/**
 * Equal split - divide amount equally
 */
function calculateEqualSplit(totalAmount, participants, payerId) {
  const perPerson = totalAmount / participants.length;
  
  return participants
    .filter(p => p.userId.toString() !== payerId.toString())
    .map(p => ({
      userId: p.userId.toString(),
      amount: Math.round(perPerson * 100) / 100 // Round to 2 decimal places
    }));
}

/**
 * Exact split - each person owes specified amount
 */
function calculateExactSplit(participants, payerId) {
  return participants
    .filter(p => p.userId.toString() !== payerId.toString())
    .map(p => ({
      userId: p.userId.toString(),
      amount: p.amount || 0
    }));
}

/**
 * Percentage split - each person owes a percentage
 */
function calculatePercentageSplit(totalAmount, participants, payerId) {
  return participants
    .filter(p => p.userId.toString() !== payerId.toString())
    .map(p => ({
      userId: p.userId.toString(),
      amount: Math.round((totalAmount * (p.percentage || 0) / 100) * 100) / 100
    }));
}

/**
 * Validate split data
 */
function validateSplit(totalAmount, splitType, participants) {
  if (totalAmount <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }

  if (participants.length === 0) {
    return { valid: false, error: 'At least one participant required' };
  }

  if (splitType === 'exact') {
    const sum = participants.reduce((acc, p) => acc + (p.amount || 0), 0);
    if (sum > totalAmount) {
      return { valid: false, error: 'Exact amounts cannot exceed total' };
    }
  }

  if (splitType === 'percentage') {
    const sum = participants.reduce((acc, p) => acc + (p.percentage || 0), 0);
    if (sum > 100) {
      return { valid: false, error: 'Percentages cannot exceed 100' };
    }
  }

  return { valid: true };
}

module.exports = { calculateSplit, validateSplit };
