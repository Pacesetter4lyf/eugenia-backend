const JoinCode = require('./../models/joinCodeModel');
const UserData = require('../models/userDataModel');
const factory = require('./handlerFactory');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');

const { ObjectId } = require('mongodb');

// exports.createJoinCode = catchAsync(async (req, res, next) => {});

exports.createJoinCode = catchAsync(async (req, res, next) => {
  const doc = await JoinCode.create({
    ...req.body,
    generatedBy: req.user.userDataId
  });

  res.status(201).json({
    status: 'success',
    data: {
      data: doc
    }
  });
});

exports.getAllCodes = catchAsync(async (req, res, next) => {
  const lineage = req.user.lineage;
  // be sure that the lineage of the person who created the request data
  // matches the lineage of the current user
  const usersInLineage = await UserData.find({
    lineage: { $in: lineage }
  }).distinct('_id');
  const records = await JoinCode.find({
    $or: [
      {
        generatedBy: {
          $in: usersInLineage
        }
      },
      {
        nodeTo: {
          $in: usersInLineage
        }
      },
      {
        userData: {
          $in: usersInLineage
        }
      }
    ]
  });

  //   console.log('records ', records, lineage, usersInLineage);
  res.status(200).json({
    status: 'success',
    data: {
      data: records
    }
  });
});

exports.incomingRequest = catchAsync(async (req, res, next) => {
  const lineage = req.user.lineage;
  // be sure that the lineage of the person who created the request data
  // matches the lineage of the current user
  const records = await JoinCode.find().populate({
    path: 'nodeTo',
    select: 'lineage',
    match: { lineage: { $in: lineage } }
  });
  res.status(200).json({
    status: 'success',
    data: {
      data: records
    }
  });
});

exports.deleteCode = factory.deleteOne(JoinCode);

exports.updateJoinRequest = catchAsync(async (req, res, next) => {
  // if nodeTo is myself, delete all the row

  const { id } = req.params;
  let updatedCode = {
    ...req.body,
    sentBy: req.user.userDataId
  };

  const relationship = await JoinCode.findByIdAndUpdate(id, updatedCode);

  res.status(200).json({
    status: 'success',
    data: {
      data: relationship
    }
  });
});

exports.findCode = catchAsync(async (req, res, next) => {
  const { code } = req.params;
  const lineage = req.user.lineage;

  const codeDetails = await JoinCode.findOne({ status: 'created', code: code });

  res.status(200).json({
    status: 'success',
    data: {
      data: codeDetails
    }
  });
});

exports.plantDetails = catchAsync(async (req, res, next) => {
  // copy the contents of the userData
  // save the contents into the nodeTo
  // dislodge the linkages of the userData
  // replace instances of the userData id with the id of the nodeTo
  // dislodge the linkages of the nodeTo
  // attach the linkages of the nodeTo using the append mode
  // you can then manually buikd relationships between
  // change status to merged
  const session = req.session;

  // Start the transaction
  await session.startTransaction();

  const { id } = req.params;
  let codeDetails = await JoinCode.findById(id).session(session);
  codeDetails = codeDetails.toObject();
  req.codeDetails = codeDetails;

  const { code } = req.params;
  const lineage = req.user.lineage;

  await JoinCode.findByIdAndDelete(id).session(session);

  next();
});
//cancelRequest
