const Group = require('../models/groupModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Create a new group
exports.createGroup = catchAsync(async (req, res, next) => {
  const { groupName, description } = req.body;
  
  const group = await Group.create({
    groupName,
    description,
    createdBy: req.user._id,
    members: [{ user: req.user._id, isAdmin: true }]
  });

  res.status(201).json({
    status: 'success',
    data: {
      group
    }
  });
});

// Get all groups (excluding soft-deleted ones)
exports.getAllGroups = catchAsync(async (req, res, next) => {
  const groups = await Group.find({ isActive: true })
    .populate('createdBy', 'firstName lastName')
    .populate('members.user', 'firstName lastName');

  res.status(200).json({
    status: 'success',
    results: groups.length,
    data: {
      groups
    }
  });
});

// Get a single group (excluding soft-deleted ones)
exports.getGroup = catchAsync(async (req, res, next) => {
  const group = await Group.findOne({ _id: req.params.id, isActive: true })
    .populate('createdBy', 'firstName lastName')
    .populate('members.user', 'firstName lastName');

  if (!group) {
    return next(new AppError('No group found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      group
    }
  });
});

// Update a group (only active groups can be updated)
exports.updateGroup = catchAsync(async (req, res, next) => {
  const group = await Group.findOne({ _id: req.params.id, isActive: true });

  if (!group) {
    return next(new AppError('No group found with that ID', 404));
  }

  // Check if user is admin or creator
  const isAdmin = group.members.some(
    member => member.user.toString() === req.user._id.toString() && member.isAdmin
  );
  const isCreator = group.createdBy.toString() === req.user._id.toString();

  if (!isAdmin && !isCreator) {
    return next(new AppError('You do not have permission to update this group', 403));
  }

  const updatedGroup = await Group.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      group: updatedGroup
    }
  });
});

// Delete a group (soft delete)
exports.deleteGroup = catchAsync(async (req, res, next) => {
  const group = await Group.findOne({ _id: req.params.id, isActive: true });

  if (!group) {
    return next(new AppError('No group found with that ID', 404));
  }

  // Check if user is admin or creator
  const isAdmin = group.members.some(
    member => member.user.toString() === req.user._id.toString() && member.isAdmin
  );
  const isCreator = group.createdBy.toString() === req.user._id.toString();

  if (!isAdmin && !isCreator) {
    return next(new AppError('Only group admins or creator can delete this group', 403));
  }

  // Soft delete by setting isActive to false
  await Group.findByIdAndUpdate(req.params.id, { isActive: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Add a member to a group (only active groups)
exports.addMember = catchAsync(async (req, res, next) => {
  const { userId } = req.body;
  const group = await Group.findOne({ _id: req.params.id, isActive: true });

  if (!group) {
    return next(new AppError('No group found with that ID', 404));
  }

  // Check if user is admin or creator
  const isAdmin = group.members.some(
    member => member.user.toString() === req.user._id.toString() && member.isAdmin
  );
  const isCreator = group.createdBy.toString() === req.user._id.toString();

  if (!isAdmin && !isCreator) {
    return next(new AppError('You do not have permission to add members to this group', 403));
  }

  // Check if user is already a member
  if (group.members.some(member => member.user.toString() === userId)) {
    return next(new AppError('User is already a member of this group', 400));
  }

  group.members.push({ user: userId });
  await group.save();

  res.status(200).json({
    status: 'success',
    data: {
      group
    }
  });
});

// Remove a member from a group (only active groups)
exports.removeMember = catchAsync(async (req, res, next) => {
  const { userId } = req.body;
  const group = await Group.findOne({ _id: req.params.id, isActive: true });

  if (!group) {
    return next(new AppError('No group found with that ID', 404));
  }

  // Check if user is admin or creator
  const isAdmin = group.members.some(
    member => member.user.toString() === req.user._id.toString() && member.isAdmin
  );
  const isCreator = group.createdBy.toString() === req.user._id.toString();

  if (!isAdmin && !isCreator) {
    return next(new AppError('You do not have permission to remove members from this group', 403));
  }

  // Cannot remove creator
  if (userId === group.createdBy.toString()) {
    return next(new AppError('Cannot remove the group creator', 400));
  }

  group.members = group.members.filter(
    member => member.user.toString() !== userId
  );
  await group.save();

  res.status(200).json({
    status: 'success',
    data: {
      group
    }
  });
});

// Make a member an admin (only active groups)
exports.makeAdmin = catchAsync(async (req, res, next) => {
  const { userId } = req.body;
  const group = await Group.findOne({ _id: req.params.id, isActive: true });

  if (!group) {
    return next(new AppError('No group found with that ID', 404));
  }

  // Only creator can make admins
  if (group.createdBy.toString() !== req.user._id.toString()) {
    return next(new AppError('Only the group creator can make admins', 403));
  }

  const memberIndex = group.members.findIndex(
    member => member.user.toString() === userId
  );

  if (memberIndex === -1) {
    return next(new AppError('User is not a member of this group', 400));
  }

  group.members[memberIndex].isAdmin = true;
  await group.save();

  res.status(200).json({
    status: 'success',
    data: {
      group
    }
  });
});

// Get group members (only active groups)
exports.getMembers = catchAsync(async (req, res, next) => {
  const group = await Group.findOne({ _id: req.params.id, isActive: true })
    .populate('members.user', 'firstName lastName email');

  if (!group) {
    return next(new AppError('No group found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    results: group.members.length,
    data: {
      members: group.members
    }
  });
});

// Get groups I'm invited to (only active groups)
exports.getInvitedGroups = catchAsync(async (req, res, next) => {
  const groups = await Group.find({
    isActive: true,
    'members.user': req.user._id,
    'members.joinedAt': { $exists: false }
  }).populate('createdBy', 'firstName lastName');

  res.status(200).json({
    status: 'success',
    results: groups.length,
    data: {
      groups
    }
  });
});

// Accept group invitation (only active groups)
exports.acceptInvitation = catchAsync(async (req, res, next) => {
  const group = await Group.findOne({ _id: req.params.id, isActive: true });

  if (!group) {
    return next(new AppError('No group found with that ID', 404));
  }

  const memberIndex = group.members.findIndex(
    member => member.user.toString() === req.user._id.toString()
  );

  if (memberIndex === -1) {
    return next(new AppError('You are not invited to this group', 400));
  }

  group.members[memberIndex].joinedAt = Date.now();
  await group.save();

  res.status(200).json({
    status: 'success',
    data: {
      group
    }
  });
});

// Decline group invitation (only active groups)
exports.declineInvitation = catchAsync(async (req, res, next) => {
  const group = await Group.findOne({ _id: req.params.id, isActive: true });

  if (!group) {
    return next(new AppError('No group found with that ID', 404));
  }

  group.members = group.members.filter(
    member => member.user.toString() !== req.user._id.toString()
  );
  await group.save();

  res.status(200).json({
    status: 'success',
    data: {
      group
    }
  });
});

// Restore a soft-deleted group
exports.restoreGroup = catchAsync(async (req, res, next) => {
  const group = await Group.findOne({ _id: req.params.id, isActive: false });

  if (!group) {
    return next(new AppError('No soft-deleted group found with that ID', 404));
  }

  // Check if user is admin or creator
  const isAdmin = group.members.some(
    member => member.user.toString() === req.user._id.toString() && member.isAdmin
  );
  const isCreator = group.createdBy.toString() === req.user._id.toString();

  if (!isAdmin && !isCreator) {
    return next(new AppError('Only group admins or creator can restore this group', 403));
  }

  // Restore by setting isActive to true
  const restoredGroup = await Group.findByIdAndUpdate(
    req.params.id,
    { isActive: true },
    { new: true }
  ).populate('createdBy', 'firstName lastName')
    .populate('members.user', 'firstName lastName');

  res.status(200).json({
    status: 'success',
    data: {
      group: restoredGroup
    }
  });
}); 