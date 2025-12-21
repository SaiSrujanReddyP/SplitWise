const mongoose = require('mongoose');

/**
 * Activity Model - Audit trail for all operations
 * 
 * Indexes optimized for:
 * - User's activity feed (dashboard)
 * - Group activity feed
 * - Recent activities (sorted by time)
 */
const activitySchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['expense_added', 'settlement', 'group_created', 'member_added'],
    required: true 
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
  data: {
    description: String,
    amount: Number,
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    groupName: String
  }
}, { timestamps: true });

// Indexes for efficient queries
// User's activity feed (most common query)
activitySchema.index({ user: 1, createdAt: -1 });

// Group activity feed
activitySchema.index({ group: 1, createdAt: -1 });

// Activity type filtering
activitySchema.index({ type: 1, createdAt: -1 });

// Combined for user + type queries
activitySchema.index({ user: 1, type: 1, createdAt: -1 });

// TTL index - auto-delete activities older than 1 year (optional)
// activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('Activity', activitySchema);
