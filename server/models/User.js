const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Model
 * 
 * Indexes for:
 * - Login by email (unique)
 * - User search by name/email
 */
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false }
}, { timestamps: true });

// Indexes
// Note: email already has unique index from schema definition (unique: true)
// Text search for user search feature
userSchema.index({ name: 'text', email: 'text' });

// Name index for search
userSchema.index({ name: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
