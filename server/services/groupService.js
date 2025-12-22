const Group = require('../models/Group');
const User = require('../models/User');
const { cache, cacheKeys } = require('../config/redis');
const { buildCursorQuery, paginatedResponse } = require('../utils/pagination');
const { queueActivityLog, queueCacheInvalidation } = require('./queueService');

const GROUP_CACHE_TTL = 300; // 5 minutes

const createGroup = async (name, creatorId, memberEmails = []) => {
  const members = [creatorId];
  
  // Add members by email
  for (const email of memberEmails) {
    const user = await User.findOne({ email });
    if (user && !members.includes(user._id.toString())) {
      members.push(user._id);
    }
  }

  const group = new Group({
    name,
    members,
    createdBy: creatorId,
    balances: {},
    useNewBalances: true
  });

  await group.save();

  // Log activity asynchronously
  queueActivityLog('group_created', creatorId, {
    groupId: group._id,
    groupName: name
  });

  // Invalidate user's groups cache
  queueCacheInvalidation({ userId: creatorId });

  return group.populate('members', 'name email');
};

const getGroups = async (userId, options = {}) => {
  const { limit = 20, page = 1, cursor = null } = options;

  // Try cache first for simple queries
  if (!cursor && page === 1 && limit === 20) {
    const cached = await cache.get(cacheKeys.userGroups(userId));
    if (cached) return cached;
  }

  const query = { members: userId };
  const cursorQuery = cursor ? buildCursorQuery(cursor, 'next', 'createdAt', -1) : {};
  const finalQuery = { ...query, ...cursorQuery };

  const groups = await Group.find(finalQuery)
    .populate('members', 'name email')
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = groups.length > limit;
  if (hasMore) groups.pop();

  const total = cursor ? null : await Group.countDocuments(query);
  const result = paginatedResponse(groups, { limit, page, cursor, total });

  // Cache first page
  if (!cursor && page === 1 && limit === 20) {
    await cache.set(cacheKeys.userGroups(userId), result, GROUP_CACHE_TTL);
  }

  return result;
};

const getGroupById = async (groupId, userId) => {
  // Try cache first
  const cacheKey = `group:${groupId}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    // Verify user is member
    if (cached.members.some(m => m._id === userId || m._id?.toString() === userId)) {
      return cached;
    }
  }

  const group = await Group.findOne({ _id: groupId, members: userId })
    .populate('members', 'name email')
    .populate('createdBy', 'name email');
  
  if (!group) {
    throw new Error('Group not found');
  }

  // Cache the group
  await cache.set(cacheKey, group.toObject(), GROUP_CACHE_TTL);
  
  return group;
};

const addMember = async (groupId, userId, memberEmail) => {
  const group = await Group.findOne({ _id: groupId, members: userId });
  if (!group) {
    throw new Error('Group not found');
  }

  const newMember = await User.findOne({ email: memberEmail });
  if (!newMember) {
    throw new Error('User not found');
  }

  if (group.members.includes(newMember._id)) {
    throw new Error('User already in group');
  }

  group.members.push(newMember._id);
  await group.save();

  // Log activity asynchronously
  queueActivityLog('member_added', userId, {
    groupId: group._id,
    groupName: group.name
  });

  // Invalidate caches
  queueCacheInvalidation({ userId: newMember._id.toString(), groupId: group._id.toString() });
  await cache.invalidate(`group:${groupId}`);
  
  return group.populate('members', 'name email');
};

const deleteGroup = async (groupId, userId) => {
  const group = await Group.findOne({ _id: groupId });
  if (!group) {
    throw new Error('Group not found');
  }

  // Only creator can delete the group (compare as strings)
  const creatorId = group.createdBy?._id?.toString() || group.createdBy?.toString();
  if (creatorId !== userId.toString()) {
    throw new Error('Only the group creator can delete this group');
  }

  await Group.deleteOne({ _id: groupId });

  // Log activity
  queueActivityLog('group_deleted', userId, {
    groupId: group._id,
    groupName: group.name
  });

  // Invalidate caches for all members
  for (const memberId of group.members) {
    queueCacheInvalidation({ userId: memberId.toString() });
  }
  await cache.invalidate(`group:${groupId}`);
};

module.exports = { createGroup, getGroups, getGroupById, addMember, deleteGroup };
