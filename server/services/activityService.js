const Activity = require('../models/Activity');

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
 * Get recent activities for a user
 */
const getUserActivities = async (userId, limit = 20) => {
  // Get user's groups
  const Group = require('../models/Group');
  const groups = await Group.find({ members: userId }).select('_id');
  const groupIds = groups.map(g => g._id);

  // Get activities from user's groups or involving the user
  const activities = await Activity.find({
    $or: [
      { user: userId },
      { group: { $in: groupIds } }
    ]
  })
    .populate('user', 'name email')
    .populate('group', 'name')
    .populate('data.fromUser', 'name')
    .populate('data.toUser', 'name')
    .sort({ createdAt: -1 })
    .limit(limit);

  return activities;
};

/**
 * Get activities for a group
 */
const getGroupActivities = async (groupId, limit = 20) => {
  return Activity.find({ group: groupId })
    .populate('user', 'name email')
    .populate('data.fromUser', 'name')
    .populate('data.toUser', 'name')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = { logActivity, getUserActivities, getGroupActivities };
