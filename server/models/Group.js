const mongoose = require('mongoose');

/**
 * Group Model
 * 
 * Design Decision: Keep embedded balances for backwards compatibility
 * but also support the new Balance collection for scalability.
 * 
 * Migration path:
 * 1. New expenses update both embedded and Balance collection
 * 2. Reads prefer Balance collection when available
 * 3. Eventually remove embedded balances
 */
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Legacy: Stores balance matrix (kept for backwards compatibility)
  // balances[debtorId][creditorId] = amount
  balances: { type: Map, of: Map, default: {} },
  // Flag to indicate if using new Balance collection
  useNewBalances: { type: Boolean, default: true }
}, { timestamps: true });

// Indexes
// Find groups by member (most common query)
groupSchema.index({ members: 1 });

// Find groups by creator
groupSchema.index({ createdBy: 1 });

// Find groups by name (for search)
groupSchema.index({ name: 'text' });

module.exports = mongoose.model('Group', groupSchema);
