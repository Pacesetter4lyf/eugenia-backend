const Lineage = require('../models/lineageModel');
const Profile = require('../models/profileModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { getRelatedProfiles } = require('../utils/relationshipUtils');

// Add a member to lineage
exports.addToLineage = catchAsync(async (req, res, next) => {
  const { lineageId } = req.params;
  const { profileId } = req.body;

  const lineage = await Lineage.findById(lineageId);
  if (!lineage) {
    return next(new AppError('Lineage not found', 404));
  }

  // Check if profile is already a member
  if (lineage.lineageMembers.some(member => member.profileId.toString() === profileId)) {
    return next(new AppError('Profile is already a member of this lineage', 400));
  }

  // Get the target profile
  const targetProfile = await Profile.findById(profileId);
  if (!targetProfile) {
    return next(new AppError('Target profile not found', 404));
  }

  // Add to lineage members
  lineage.lineageMembers.push({
    profileId: targetProfile._id,
    addedAt: Date.now()
  });
  
  // Remove from suggestions if present
  lineage.suggestions = lineage.suggestions.filter(
    id => id.toString() !== profileId
  );

  await lineage.save();

  res.status(200).json({
    status: 'success',
    data: {
      lineage
    }
  });
});

// Remove a member from lineage
exports.removeFromLineage = catchAsync(async (req, res, next) => {
  const { profileId } = req.body;

  // Get the current user's profile
  const currentProfile = await Profile.findOne({ user: req.user.id });
  if (!currentProfile) {
    return next(new AppError('Profile not found', 404));
  }

  // Find the lineage
  const lineage = await Lineage.findOne({ profileId: currentProfile._id });
  if (!lineage) {
    return next(new AppError('No lineage found', 404));
  }

  // Remove the profile from lineage
  lineage.lineageMembers = lineage.lineageMembers.filter(
    member => member.profileId.toString() !== profileId
  );

  await lineage.save();

  res.status(200).json({
    status: 'success',
    data: {
      lineage
    }
  });
});

// Get members of my lineage
exports.getMyLineageMembers = catchAsync(async (req, res, next) => {
  // Get the current user's profile
  const currentProfile = await Profile.findOne({ user: req.user.id });
  if (!currentProfile) {
    return next(new AppError('Profile not found', 404));
  }

  // Find the lineage
  const lineage = await Lineage.findOne({
    profileId: currentProfile._id
  }).populate({
    path: 'lineageMembers.profileId',
    select: 'firstName lastName gender dateOfBirth'
  });

  if (!lineage) {
    return next(new AppError('No lineage found', 404));
  }

  res.status(200).json({
    status: 'success',
    results: lineage.lineageMembers.length,
    data: {
      members: lineage.lineageMembers
    }
  });
});

// Search lineage members
exports.searchLineage = catchAsync(async (req, res, next) => {
  const { searchTerm } = req.query;

  if (!searchTerm) {
    return next(new AppError('Please provide a search term', 400));
  }

  // Get the current user's profile
  const currentProfile = await Profile.findOne({ user: req.user.id });
  if (!currentProfile) {
    return next(new AppError('Profile not found', 404));
  }

  // Find the lineage
  const lineage = await Lineage.findOne({
    profileId: currentProfile._id
  }).populate({
    path: 'lineageMembers.profileId',
    select: 'firstName lastName gender dateOfBirth'
  });

  if (!lineage) {
    return next(new AppError('No lineage found', 404));
  }

  // Search through members' first and last names
  const searchResults = lineage.lineageMembers.filter(member => {
    const profile = member.profileId;
    const fullName = `${profile.firstName} ${profile.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  res.status(200).json({
    status: 'success',
    results: searchResults.length,
    data: {
      members: searchResults
    }
  });
});

// Get my lineage
exports.getMyLineage = catchAsync(async (req, res, next) => {
  // Get the current user's profile
  const currentProfile = await Profile.findOne({ user: req.user.id });
  if (!currentProfile) {
    return next(new AppError('Profile not found', 404));
  }

  // Find or create lineage
  let lineage = await Lineage.findOne({
    profileId: currentProfile._id
  }).populate({
    path: 'lineageMembers.profileId',
    select: 'firstName lastName gender dateOfBirth'
  });

  if (!lineage) {
    lineage = await Lineage.create({
      profileId: currentProfile._id,
      lineageMembers: []
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      lineage
    }
  });
});

exports.removeFromSuggestions = catchAsync(async (req, res, next) => {
  const { lineageId, profileId } = req.params;

  const lineage = await Lineage.findById(lineageId);
  if (!lineage) {
    return next(new AppError('Lineage not found', 404));
  }

  // Remove the profile from suggestions
  lineage.suggestions = lineage.suggestions.filter(
    id => id.toString() !== profileId
  );
  await lineage.save();

  res.status(200).json({
    status: 'success',
    data: {
      lineage
    }
  });
});

exports.refreshSuggestions = catchAsync(async (req, res, next) => {
  const { lineageId } = req.params;

  const lineage = await Lineage.findById(lineageId);
  if (!lineage) {
    return next(new AppError('Lineage not found', 404));
  }

  // Clear existing suggestions
  lineage.suggestions = [];

  // For each member, get their related profiles and add to suggestions
  for (const member of lineage.lineageMembers) {
    const relatedProfiles = await getRelatedProfiles(member.profileId);
    
    // Add to suggestions, excluding current members
    const currentMembers = lineage.lineageMembers.map(m => m.profileId.toString());
    const newSuggestions = relatedProfiles.filter(
      profile => !currentMembers.includes(profile.toString())
    );

    lineage.suggestions = [...new Set([...lineage.suggestions, ...newSuggestions])];
  }

  await lineage.save();

  res.status(200).json({
    status: 'success',
    data: {
      lineage
    }
  });
});
