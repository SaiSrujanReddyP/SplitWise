const authService = require('../services/authService');

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.signup(name, email, password);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

module.exports = { signup, login };
