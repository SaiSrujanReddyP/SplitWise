const mongoose = require('mongoose');

/**
 * Balance Model - Separate collection for scalable balance tracking
 * 
 * Design Decision: Moving from embedded Map in Group to separate collection
 * - Enables efficient indexing and querying
 * - Supports horizontal scaling via sharding on groupId
 * - Allows atomic updates without loading entire group document
 * - Better for aggregation queries across multiple groups
 */
const balanceSchema = new mongoose.Schema({
  // For group balances
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true },
  
  // For direct (non-group) balances, group will be null
  debtor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creditor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, default: 0 },
  
  // Metadata for auditing
  lastExpenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound indexes for efficient queries
// Primary lookup: find balance between two users in a group
balanceSchema.index({ group: 1, debtor: 1, creditor: 1 }, { unique: true });

// Find all balances where user is debtor (what they owe)
balanceSchema.index({ debtor: 1, amount: 1 });

// Find all balances where user is creditor (what they're owed)
balanceSchema.index({ creditor: 1, amount: 1 });

// Find all balances in a group (for group balance view)
balanceSchema.index({ group: 1, amount: 1 });

// For direct balances (group is null)
balanceSchema.index({ group: 1, debtor: 1 });
balanceSchema.index({ group: 1, creditor: 1 });

module.exports = mongoose.model('Balance', balanceSchema);
