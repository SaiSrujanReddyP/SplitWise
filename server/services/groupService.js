const Group = require('../models/Group');
const User = require('../models/User');

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
    balances: {}
  });

  await group.save();
  return group.populate('members', 'name email');
};

const getGroups = async (userId) => {
  return Group.find({ members: userId })
    .populate('members', 'name email')
    .populate('createdBy', 'name email');
};

const getGroupById = async (groupId, userId) => {
  const group = await Group.findOne({ _id: groupId, members: userId })
    .populate('members', 'name email')
    .populate('createdBy', 'name email');
  
  if (!group) {
    throw new Error('Group not found');
  }
  
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
  
  return group.populate('members', 'name email');
};

module.exports = { createGroup, getGroups, getGroupById, addMember };
