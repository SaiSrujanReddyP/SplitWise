const groupService = require('../services/groupService');

const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const group = await groupService.createGroup(name, req.userId, members);
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getGroups = async (req, res) => {
  try {
    const groups = await groupService.getGroups(req.userId);
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getGroupById = async (req, res) => {
  try {
    const group = await groupService.getGroupById(req.params.id, req.userId);
    res.json(group);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

const addMember = async (req, res) => {
  try {
    const { email } = req.body;
    const group = await groupService.addMember(req.params.id, req.userId, email);
    res.json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { createGroup, getGroups, getGroupById, addMember };
