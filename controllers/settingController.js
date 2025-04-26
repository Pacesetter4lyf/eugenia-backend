const Profile = require('../models/profileModel');
const Media = require('../models/mediaModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// PUT: Update visibility settings
exports.updateVisibilitySettings = catchAsync(async (req, res, next) => {
  const { userId } = req.user; // Assuming userId is available in req.user
  const { visibility } = req.body;

  if (!visibility) {
    return next(
      new AppError('Please provide visibility settings to update.', 400)
    );
  }

  // Update visibility in the Profile model
  const updatedProfile = await Profile.findOneAndUpdate(
    { userId },
    { visibility },
    { new: true, runValidators: true }
  );

  if (!updatedProfile) {
    return next(new AppError('Profile not found for the user.', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      visibility: updatedProfile.visibility
    }
  });
});

// GET: Retrieve visibility settings
exports.getVisibilitySettings = catchAsync(async (req, res, next) => {
  const { userId } = req.user; // Assuming userId is available in req.user

  // Get visibility settings from Profile model
  const profile = await Profile.findOne({ userId }).select('visibility');
  if (!profile) {
    return next(new AppError('Profile not found for the user.', 404));
  }

  // Get media items with their viewableBy field
  const mediaItems = await Media.find({ user: userId }).select(
    'name viewableBy'
  );

  res.status(200).json({
    status: 'success',
    data: {
      profileVisibility: profile.visibility,
      mediaVisibility: mediaItems
    }
  });
});
