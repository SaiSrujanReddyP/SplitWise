const activityService = require('../services/activityService');

const getActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = await activityService.getUserActivities(req.userId, limit);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getGroupActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = await activityService.getGroupActivities(req.params.groupId, limit);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getActivities, getGroupActivities };
