const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Stores balance matrix: balances[debtorId][creditorId] = amount
  balances: { type: Map, of: Map, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
