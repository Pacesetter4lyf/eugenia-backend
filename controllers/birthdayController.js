const Profile = require('../models/profileModel');
const Group = require('../models/groupModel');
const Lineage = require('../models/lineageModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getBirthdays = catchAsync(async (req, res, next) => {
  const { filter, groupId, lineageId } = req.query;
  let query = {};

  // If filtering by group
  if (filter === 'group' && groupId) {
    const group = await Group.findById(groupId);
    if (!group) {
      return next(new AppError('Group not found', 404));
    }
    query = { _id: { $in: group.members.map(member => member.user) } };
  }
  // If filtering by lineage
  else if (filter === 'lineage' && lineageId) {
    const lineage = await Lineage.findById(lineageId);
    if (!lineage) {
      return next(new AppError('Lineage not found', 404));
    }
    query = {
      _id: { $in: lineage.lineageMembers.map(member => member.profileId) }
    };
  }

  // Get profiles with birthdays
  const profiles = await Profile.find(query)
    .select('firstName lastName dateOfBirth userId')
    .populate({
      path: 'userId',
      select: 'username'
    });

  // Calculate days remaining and days passed for each birthday
  const today = new Date();
  const currentYear = today.getFullYear();

  const birthdays = profiles.map(profile => {
    const birthday = new Date(profile.dateOfBirth);
    const birthdayThisYear = new Date(
      currentYear,
      birthday.getMonth(),
      birthday.getDate()
    );

    const timeDifference = birthdayThisYear.getTime() - today.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      username: profile.userId.username,
      birthday: profile.dateOfBirth,
      daysRemaining:
        daysDifference >= 0 ? daysDifference : daysDifference + 365,
      daysPassed:
        365 - (daysDifference >= 0 ? daysDifference : daysDifference + 365)
    };
  });

  res.status(200).json({
    status: 'success',
    results: birthdays.length,
    data: {
      birthdays
    }
  });
});
