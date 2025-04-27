const Favourite = require('../models/favouriteModel');
const Profile = require('../models/profileModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Add a member to favourites
exports.addToFavourites = catchAsync(async (req, res, next) => {
  const { profileId } = req.body;

  // Get the current user's profile
  const currentProfile = await Profile.findOne({ user: req.user.id });
  if (!currentProfile) {
    return next(new AppError('Profile not found', 404));
  }

  // Get the target profile
  const targetProfile = await Profile.findById(profileId);
  if (!targetProfile) {
    return next(new AppError('Target profile not found', 404));
  }

  // Find or create favourites for the current user
  let favourites = await Favourite.findOne({ profileId: currentProfile._id });
  if (!favourites) {
    favourites = await Favourite.create({
      profileId: currentProfile._id,
      favourites: [],
      suggestions: []
    });
  }

  // Check if profile is already in favourites
  if (favourites.favourites.some(member => member.profileId.toString() === profileId)) {
    return next(new AppError('Profile is already in your favourites', 400));
  }

  // Add the profile to favourites
  favourites.favourites.push({
    profileId: targetProfile._id,
    addedAt: Date.now()
  });

  await favourites.save();

  res.status(200).json({
    status: 'success',
    data: {
      favourites
    }
  });
});

// Remove a member from favourites
exports.removeFromFavourites = catchAsync(async (req, res, next) => {
  const { profileId } = req.body;

  // Get the current user's profile
  const currentProfile = await Profile.findOne({ user: req.user.id });
  if (!currentProfile) {
    return next(new AppError('Profile not found', 404));
  }

  // Find the favourites
  const favourites = await Favourite.findOne({ profileId: currentProfile._id });
  if (!favourites) {
    return next(new AppError('No favourites found', 404));
  }

  // Remove the profile from favourites
  favourites.favourites = favourites.favourites.filter(
    member => member.profileId.toString() !== profileId
  );

  await favourites.save();

  res.status(200).json({
    status: 'success',
    data: {
      favourites
    }
  });
});

// Get my favourites
exports.getMyFavourites = catchAsync(async (req, res, next) => {
  // Get the current user's profile
  const currentProfile = await Profile.findOne({ user: req.user.id });
  if (!currentProfile) {
    return next(new AppError('Profile not found', 404));
  }

  // Find or create favourites
  let favourites = await Favourite.findOne({ profileId: currentProfile._id })
    .populate({
      path: 'favourites.profileId',
      select: 'firstName lastName gender dateOfBirth'
    });

  if (!favourites) {
    favourites = await Favourite.create({
      profileId: currentProfile._id,
      favourites: [],
      suggestions: []
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      favourites
    }
  });
});

// Remove a suggested member
exports.removeSuggestedMember = catchAsync(async (req, res, next) => {
  const { profileId } = req.body;

  // Get the current user's profile
  const currentProfile = await Profile.findOne({ user: req.user.id });
  if (!currentProfile) {
    return next(new AppError('Profile not found', 404));
  }

  // Find the favourites
  const favourites = await Favourite.findOne({ profileId: currentProfile._id });
  if (!favourites) {
    return next(new AppError('No favourites found', 404));
  }

  // Remove the profile from suggestions
  favourites.suggestions = favourites.suggestions.filter(
    member => member.profileId.toString() !== profileId
  );

  await favourites.save();

  res.status(200).json({
    status: 'success',
    data: {
      favourites
    }
  });
}); 