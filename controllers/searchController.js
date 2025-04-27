const Profile = require('../models/profileModel');
const Group = require('../models/groupModel');
const Lineage = require('../models/lineageModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.search = catchAsync(async (req, res, next) => {
  const { searchTerm, filter, groupId, lineageId } = req.query;

  if (!searchTerm) {
    return next(new AppError('Please provide a search term', 400));
  }

  let query = {};
  let profiles = [];

  // Build the search query
  const searchQuery = {
    $or: [
      { firstName: { $regex: searchTerm, $options: 'i' } },
      { lastName: { $regex: searchTerm, $options: 'i' } }
    ]
  };

  // Apply filters based on the filter type
  if (filter === 'group' && groupId) {
    const group = await Group.findById(groupId);
    if (!group) {
      return next(new AppError('Group not found', 404));
    }
    query = {
      ...searchQuery,
      _id: { $in: group.members.map(member => member.user) }
    };
  } else if (filter === 'lineage' && lineageId) {
    const lineage = await Lineage.findById(lineageId);
    if (!lineage) {
      return next(new AppError('Lineage not found', 404));
    }
    query = {
      ...searchQuery,
      _id: { $in: lineage.lineageMembers.map(member => member.profileId) }
    };
  } else {
    // Search all profiles
    query = searchQuery;
  }

  // Execute the search
  profiles = await Profile.find(query)
    .select('firstName lastName gender dateOfBirth userId')
    .populate({
      path: 'userId',
      select: 'username'
    });

  // Format the results
  const results = profiles.map(profile => ({
    id: profile._id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    username: profile.userId.username
  }));

  res.status(200).json({
    status: 'success',
    results: results.length,
    data: {
      results
    }
  });
}); 