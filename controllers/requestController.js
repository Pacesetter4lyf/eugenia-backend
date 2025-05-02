const crypto = require('crypto');
const Request = require('../models/requestModel');
const Profile = require('../models/profileModel');
const relationshipController = require('./relationshipController');
const lineageController = require('./lineageController');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * Generate a unique join code for a request
 */
const generateJoinCode = () => {
  return crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase();
};

/**
 * Get all incoming requests for a profile
 */
exports.getIncomingRequests = catchAsync(async (req, res, next) => {
  const requests = await Request.find({
    targetId: req.user.profileId,
    status: 'pending'
  })
    .populate({
      path: 'sourceId',
      select: 'firstName lastName photo gender dateOfBirth'
    })
    .populate({
      path: 'targetId',
      select: 'firstName lastName photo gender dateOfBirth'
    });

  res.status(200).json({
    status: 'success',
    results: requests.length,
    data: {
      requests
    }
  });
});

/**
 * Get all outgoing requests from a profile
 */
exports.getOutgoingRequests = catchAsync(async (req, res, next) => {
  const requests = await Request.find({
    sourceId: req.user.profileId,
    status: 'pending'
  })
    .populate({
      path: 'sourceId',
      select: 'firstName lastName photo gender dateOfBirth'
    })
    .populate({
      path: 'targetId',
      select: 'firstName lastName photo gender dateOfBirth'
    });

  res.status(200).json({
    status: 'success',
    results: requests.length,
    data: {
      requests
    }
  });
});

/**
 * Decline/Reject a request
 */
exports.declineRequest = catchAsync(async (req, res, next) => {
  const request = await Request.findOne({
    _id: req.params.requestId,
    targetId: req.user.profileId,
    status: 'pending'
  });

  if (!request) {
    return next(new AppError('Request not found or already processed', 404));
  }

  request.status = 'rejected';
  await request.save();

  res.status(200).json({
    status: 'success',
    data: {
      request
    }
  });
});

/**
 * Accept/Merge a request
 * This will trigger the appropriate relationship creation based on the request type
 */
exports.mergeRequest = catchAsync(async (req, res, next) => {
  const request = await Request.findOne({
    _id: req.params.requestId,
    targetId: req.user.profileId,
    status: 'pending'
  }).populate('sourceId targetId');

  if (!request) {
    return next(new AppError('Request not found or already processed', 404));
  }

  // Handle different types of requests
  switch (request.code) {
    case 'relationship_request': {
      // Create a relationship request object
      req.body = {
        profileAId: request.sourceId._id,
        profileBId: request.targetId._id,
        scenarios: request.scenarios || []
      };
      req.params.relationshipType = request.appendAs;

      await relationshipController.validateRelationship(req, res, async () => {
        await relationshipController[`${request.appendAs}Of`](req, res, next);
      });
      break;
    }

    case 'lineage_invitation': {
      await lineageController.addToLineage(req, res, next);
      break;
    }

    default:
      return next(new AppError('Invalid request type', 400));
  }

  // Update request status
  request.status = 'accepted';
  await request.save();

  res.status(200).json({
    status: 'success',
    data: {
      request
    }
  });
});

/**
 * Generate a join code for a request
 * This can be used to create a shareable link/code
 */
exports.generateRequestCode = catchAsync(async (req, res, next) => {
  const { sourceId, code, appendAs, scenarios, message } = req.body;

  // Verify source profile exists
  const sourceProfile = await Profile.findById(sourceId);
  if (!sourceProfile) {
    return next(new AppError('Source profile not found', 404));
  }

  // Create a new request with generated join code
  const request = await Request.create({
    sourceId,
    code,
    appendAs,
    scenarios,
    message,
    joinCode: generateJoinCode() // This will use the model's default if not provided
  });

  res.status(201).json({
    status: 'success',
    data: {
      request
    }
  });
});

/**
 * Join using a code
 * This will set the current user's profile as the target and validate the request
 */
exports.joinByCode = catchAsync(async (req, res, next) => {
  const { joinCode } = req.params;

  // Find the request by join code
  const request = await Request.findOne({
    joinCode,
    status: 'pending'
  }).populate('sourceId');

  if (!request) {
    return next(new AppError('Invalid or expired join code', 404));
  }

  // Set the current user's profile as the target
  request.targetId = req.user.profileId;
  await request.save();

  res.status(200).json({
    status: 'success',
    data: {
      request
    }
  });
});
