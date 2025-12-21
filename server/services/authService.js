const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signup = async (name, email, password) => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error('Email already registered');
  }

  const user = new User({ name, email, password });
  await user.save();

  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );

  return { user: { id: user._id, name: user.name, email: user.email }, token };
};

const login = async (email, password) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );

  return { user: { id: user._id, name: user.name, email: user.email }, token };
};

module.exports = { signup, login };
