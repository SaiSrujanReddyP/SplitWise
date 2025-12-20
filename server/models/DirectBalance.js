const mongoose = require('mongoose');

/**
 * DirectBalance - Tracks balances between users outside of groups
 * Used for non-group expenses (direct user-to-user splits)
 */
const directBalanceSchema = new mongoose.Schema({
  debtor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creditor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index for efficient lookups
directBalanceSchema.index({ debtor: 1, creditor: 1 }, { unique: true });
directBalanceSchema.index({ debtor: 1 });
directBalanceSchema.index({ creditor: 1 });

module.exports = mongoose.model('DirectBalance', directBalanceSchema);
