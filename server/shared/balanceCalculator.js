/**
 * Balance Calculator - Core balance logic for expense sharing
 * 
 * Maintains net balances between users using the formula:
 * balance[A][B] = amount A owes B
 * 
 * Balances are automatically simplified (mutual debts cancel out)
 */

class BalanceCalculator {
  constructor() {
    // balances[debtor][creditor] = amount debtor owes creditor
    this.balances = {};
  }

  /**
   * Initialize from existing balance data
   */
  loadBalances(balanceData) {
    this.balances = JSON.parse(JSON.stringify(balanceData || {}));
  }

  /**
   * Get current balances
   */
  getBalances() {
    return JSON.parse(JSON.stringify(this.balances));
  }

  /**
   * Add a debt: debtor owes creditor the specified amount
   * Automatically simplifies by canceling mutual debts
   */
  addDebt(debtorId, creditorId, amount) {
    if (debtorId === creditorId || amount <= 0) return;

    const debtor = debtorId.toString();
    const creditor = creditorId.toString();

    // Initialize nested objects if needed
    if (!this.balances[debtor]) this.balances[debtor] = {};
    if (!this.balances[creditor]) this.balances[creditor] = {};

    // Check if creditor already owes debtor (reverse debt)
    const reverseDebt = this.balances[creditor]?.[debtor] || 0;

    if (reverseDebt > 0) {
      // Simplify: cancel out mutual debts
      if (reverseDebt >= amount) {
        // Reverse debt is larger, reduce it
        this.balances[creditor][debtor] = reverseDebt - amount;
        if (this.balances[creditor][debtor] === 0) {
          delete this.balances[creditor][debtor];
        }
      } else {
        // New debt is larger, flip the direction
        delete this.balances[creditor][debtor];
        this.balances[debtor][creditor] = amount - reverseDebt;
      }
    } else {
      // No reverse debt, simply add
      this.balances[debtor][creditor] = (this.balances[debtor][creditor] || 0) + amount;
    }

    // Clean up empty objects
    this.cleanup();
  }

  /**
   * Settle a debt: reduce what debtor owes creditor
   */
  settleDebt(debtorId, creditorId, amount) {
    const debtor = debtorId.toString();
    const creditor = creditorId.toString();

    if (!this.balances[debtor]?.[creditor]) return false;

    const currentDebt = this.balances[debtor][creditor];
    if (amount > currentDebt) return false;

    this.balances[debtor][creditor] = currentDebt - amount;
    if (this.balances[debtor][creditor] === 0) {
      delete this.balances[debtor][creditor];
    }

    this.cleanup();
    return true;
  }


  /**
   * Get what a specific user owes to others
   */
  getUserOwes(userId) {
    const user = userId.toString();
    const owes = [];
    
    if (this.balances[user]) {
      for (const [creditor, amount] of Object.entries(this.balances[user])) {
        if (amount > 0) {
          owes.push({ to: creditor, amount });
        }
      }
    }
    
    return owes;
  }

  /**
   * Get what others owe to a specific user
   */
  getUserOwed(userId) {
    const user = userId.toString();
    const owed = [];
    
    for (const [debtor, creditors] of Object.entries(this.balances)) {
      if (creditors[user] && creditors[user] > 0) {
        owed.push({ from: debtor, amount: creditors[user] });
      }
    }
    
    return owed;
  }

  /**
   * Get total amount user owes
   */
  getTotalOwes(userId) {
    return this.getUserOwes(userId).reduce((sum, item) => sum + item.amount, 0);
  }

  /**
   * Get total amount owed to user
   */
  getTotalOwed(userId) {
    return this.getUserOwed(userId).reduce((sum, item) => sum + item.amount, 0);
  }

  /**
   * Get net balance for user (positive = owed to them, negative = they owe)
   */
  getNetBalance(userId) {
    return this.getTotalOwed(userId) - this.getTotalOwes(userId);
  }

  /**
   * Get all balances involving a user
   */
  getUserBalances(userId) {
    return {
      owes: this.getUserOwes(userId),
      owed: this.getUserOwed(userId),
      totalOwes: this.getTotalOwes(userId),
      totalOwed: this.getTotalOwed(userId),
      netBalance: this.getNetBalance(userId)
    };
  }

  /**
   * Clean up empty objects
   */
  cleanup() {
    for (const debtor of Object.keys(this.balances)) {
      if (Object.keys(this.balances[debtor]).length === 0) {
        delete this.balances[debtor];
      }
    }
  }
}

module.exports = { BalanceCalculator };
