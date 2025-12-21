const Activity = require('../models/Activity');
const { buildCursorQuery, paginatedResponse } = require('../utils/pagination');

/**
 * Log an activity
 */
const logActivity = async (type, userId, data) => {
  const activity = new Activity({
    type,
    user: userId,
    group: data.groupId,
    expense: data.expenseId,
    data: {
      description: data.description,
      amount: data.amount,
      fromUser: data.fromUser,
      toUser: data.toUser,
      groupName: data.groupName
    }
  });
  await activity.save();
  return activity;
};

/**
 * Get recent activities for a user (with pagination)
 */
const getUserActivities = async (userId, options = {}) => {
  const { limit = 20, page = 1, cursor = null } = options;

  // Get user's groups
  const Group = require('../models/Group');
  const groups = await Group.find({ members: userId }).select('_id');
  const groupIds = groups.map(g => g._id);

  const query = {
    $or: [
      { user: userId },
      { group: { $in: groupIds } }
    ]
  };

  const cursorQuery = cursor ? buildCursorQuery(cursor, 'next', 'createdAt', -1) : {};
  const finalQuery = { ...query, ...cursorQuery };

  const activities = await Activity.find(finalQuery)
    .populate('user', 'name email')
    .populate('group', 'name')
    .populate('data.fromUser', 'name')
    .populate('data.toUser', 'name')
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = activities.length > limit;
  if (hasMore) activities.pop();

  const total = cursor ? null : await Activity.countDocuments(query);

  return paginatedResponse(activities, { limit, page, cursor, total });
};

/**
 * Get activities for a group (with pagination)
 */
const getGroupActivities = async (groupId, options = {}) => {
  const { limit = 20, page = 1, cursor = null } = options;

  const query = { group: groupId };
  const cursorQuery = cursor ? buildCursorQuery(cursor, 'next', 'createdAt', -1) : {};
  const finalQuery = { ...query, ...cursorQuery };

  const activities = await Activity.find(finalQuery)
    .populate('user', 'name email')
    .populate('data.fromUser', 'name')
    .populate('data.toUser', 'name')
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = activities.length > limit;
  if (hasMore) activities.pop();

  const total = cursor ? null : await Activity.countDocuments(query);

  return paginatedResponse(activities, { limit, page, cursor, total });
};

module.exports = { logActivity, getUserActivities, getGroupActivities };
