const mongoose = require('mongoose');

/**
 * Expense Model
 * 
 * Indexes optimized for common query patterns:
 * - Get expenses by group (group detail page)
 * - Get expenses by payer (user's expenses)
 * - Get expenses involving a user (balance calculation)
 * - Sort by date (most recent first)
 */
const expenseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  amount: { type: Number, required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  splitType: { type: String, enum: ['equal', 'exact', 'percentage'], default: 'equal' },
  date: { type: Date, default: Date.now },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,      // For exact split
    percentage: Number   // For percentage split
  }],
  splits: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number
  }]
}, { timestamps: true });

// Indexes for scalability
// Get expenses by group, sorted by date
expenseSchema.index({ group: 1, date: -1 });

// Get expenses paid by user, sorted by date
expenseSchema.index({ paidBy: 1, date: -1 });

// Get expenses involving a user (as participant)
expenseSchema.index({ 'splits.userId': 1, date: -1 });

// Combined index for balance details query
expenseSchema.index({ paidBy: 1, 'splits.userId': 1, date: -1 });

// Text index for search (optional)
expenseSchema.index({ description: 'text' });

module.exports = mongoose.model('Expense', expenseSchema);
