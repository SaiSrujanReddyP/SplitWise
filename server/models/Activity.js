const mongoose = require('mongoose');

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

// Index for efficient queries
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ group: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
