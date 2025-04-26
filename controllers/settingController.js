const Profile = require('../models/profileModel');
const Media = require('../models/mediaModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// PUT: Update visibility settings
exports.updateVisibilitySettings = catchAsync(async (req, res, next) => {
  const { profileId } = req.user;
  const { type, field, value, mediaId } = req.body;

  if (!type || !value) {
    return next(
      new AppError(
        'Please provide type and value for the visibility update.',
        400
      )
    );
  }

  let result;

  if (type === 'profile') {
    // Update profile visibility
    if (!field) {
      return next(
        new AppError(
          'Please provide the field to update in profile visibility.',
          400
        )
      );
    }

    // Validate field exists in profile visibility
    const profile = await Profile.findById(profileId);
    if (!profile.visibility[field]) {
      return next(
        new AppError(`Invalid field: ${field} for profile visibility`, 400)
      );
    }

    // Update the specific field in profile visibility
    const update = {};
    update[`visibility.${field}`] = value;

    result = await Profile.findByIdAndUpdate(
      profileId,
      { $set: update },
      { new: true, runValidators: true }
    );
  } else if (type === 'media') {
    // Update media visibility
    if (!mediaId) {
      return next(
        new AppError('Please provide mediaId for media visibility update.', 400)
      );
    }

    // Update media visibility
    result = await Media.findOneAndUpdate(
      { _id: mediaId, user: profileId },
      { viewableBy: value },
      { new: true, runValidators: true }
    );

    if (!result) {
      return next(
        new AppError(
          'Media not found or you do not have permission to update it.',
          404
        )
      );
    }
  } else {
    return next(
      new AppError('Invalid type. Must be either "profile" or "media".', 400)
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      result
    }
  });
});

// GET: Retrieve visibility settings
exports.getVisibilitySettings = catchAsync(async (req, res, next) => {
  const { profileId } = req.user; // Assuming profileId is available in req.user

  // Get visibility settings from Profile model
  const profile = await Profile.findOne({ _id: profileId }).select(
    'visibility'
  );
  if (!profile) {
    return next(new AppError('Profile not found for the user.', 404));
  }

  // Get media items with their viewableBy field
  const mediaItems = await Media.find({ user: profileId }).select(
    'name _id viewableBy'
  );

  res.status(200).json({
    status: 'success',
    data: {
      profileVisibility: profile.visibility,
      mediaVisibility: mediaItems
    }
  });
});
