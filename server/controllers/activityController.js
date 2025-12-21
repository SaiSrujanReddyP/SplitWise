const activityService = require('../services/activityService');
const { parsePaginationParams } = require('../utils/pagination');

const getActivities = async (req, res) => {
  try {
    const { limit, page, cursor } = parsePaginationParams(req.query);
    const result = await activityService.getUserActivities(
      req.userId, 
      { limit, page, cursor }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getGroupActivities = async (req, res) => {
  try {
    const { limit, page, cursor } = parsePaginationParams(req.query);
    const result = await activityService.getGroupActivities(
      req.params.groupId, 
      { limit, page, cursor }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getActivities, getGroupActivities };
