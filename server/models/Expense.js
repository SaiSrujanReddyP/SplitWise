const mongoose = require('mongoose');

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

module.exports = mongoose.model('Expense', expenseSchema);
