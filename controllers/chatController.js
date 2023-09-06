const Chat = require('./../models/chatModel');
const UserData = require('./../models/userDataModel');
const factory = require('./handlerFactory');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

const popOptions = {
  //   path: 'user',
  //   select: 'firstName lastName -_id'
};

exports.createChat = catchAsync(async (req, res, next) => {
  console.log(req.body);

  const receiver = await UserData.findById(req.body.to);
  if (!receiver) {
    return next(new AppError('No document found with that ID', 404));
  }
  const { userDataId } = req.user;
  req.body.from = userDataId
  
  let doc = await Chat.create(req.body);

  doc = await doc
    .populate({
      path: 'from to',
      select: 'firstName'
    })
    .execPopulate();

  let { message, createdAt, editedAt } = doc;
  let newDoc = {
    message,
    createdAt,
    editedAt,
    from: doc.from.firstName,
    to: doc.to.firstName,
    sentByUser: true
  };

  res.status(201).json({
    status: 'success',
    data: {
      data: newDoc
    }
  });
});
exports.updateChat = factory.updateOne(Chat, popOptions);
exports.deleteChat = factory.deleteOne(Chat);

exports.getChat = catchAsync(async (req, res, next) => {
  const { userDataId } = req.user;
  const toId = req.params.id;

  if (!userDataId) {
    next(new AppError('Please provide a userId', 400));
  }

  const chat = await Chat.aggregate([
    {
      $match: {
        $or: [
          {
            $and: [
              { from: new ObjectId(userDataId) },
              { to: new ObjectId(toId) }
            ]
          },
          {
            $and: [
              { from: new ObjectId(toId) },
              { to: new ObjectId(userDataId) }
            ]
          }
        ]
      }
    },
    {
      $addFields: {
        sentByUser: { $eq: ['$from', new ObjectId(userDataId)] },
        toId: {
          $cond: {
            if: { $eq: ['$from', new ObjectId(userDataId)] },
            then: '$to',
            else: '$from'
          }
        }
      }
    },

    {
      $lookup: {
        from: 'userdatas',
        localField: 'from',
        foreignField: '_id',
        as: 'from'
      }
    },
    {
      $lookup: {
        from: 'userdatas',
        localField: 'to',
        foreignField: '_id',
        as: 'to'
      }
    },
    {
      $lookup: {
        from: 'userdatas',
        localField: 'toId',
        foreignField: '_id',
        as: 'toIdName'
      }
    },
    {
      $addFields: {
        from: { $arrayElemAt: ['$from.firstName', 0] },
        to: { $arrayElemAt: ['$to.firstName', 0] },
        toIdName: { $arrayElemAt: ['$toIdName.firstName', 0] }
      }
    },

    {
      $project: {
        _id: 0,
        message: 1,
        createdAt: 1,
        sentByUser: 1,
        toId: 1,
        from: 1,
        to: 1,
        toIdName: 1
      }
    }
  ]);

  // console.log('chat', userDataId, chat);

  res.status(200).json({
    status: 'success',
    results: chat.length,
    data: {
      data: chat
    }
  });
});

exports.getAllChats = catchAsync(async (req, res, next) => {
  const { userDataId } = req.user;

  if (!userDataId) {
    next(new AppError('Please provide a userId', 400));
  }

  //   const chat = await Chat.find({
  //     from: userDataId
  //   }).populate({ path: 'to', select: 'firstName' });

  const chat = await Chat.aggregate([
    { $sort: { createdAt: 1 } },
    {
      $match: {
        $or: [
          { from: { $eq: new ObjectId(userDataId) } },
          { to: { $eq: new ObjectId(userDataId) } }
        ]
      }
    },
    {
      $addFields: {
        groupKey: {
          $concat: [
            { $min: [{ $toString: '$to' }, { $toString: '$from' }] },
            { $max: [{ $toString: '$to' }, { $toString: '$from' }] }
          ]
        },
        fieldValue: {
          $cond: {
            if: { $ne: [{ $toString: '$to' }, { $toString: userDataId }] },
            then: '$to',
            else: '$from'
          }
        }
      }
    },
    {
      $group: {
        _id: '$groupKey',
        total: { $sum: 1 },
        lastMessage: { $last: '$message' },
        lastMessageDate: { $last: '$createdAt' },
        to: { $last: '$fieldValue' }, // this is the person i am chatting with
        lastMessageBy: { $last: '$from' }
      }
    },

    {
      $lookup: {
        from: 'userdatas',
        localField: 'to',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $lookup: {
        from: 'userdatas',
        localField: 'lastMessageBy',
        foreignField: '_id',
        as: 'lastMessageSender'
      }
    },
    {
      $addFields: {
        name: {
          $ifNull: [{ $arrayElemAt: ['$user.firstName', 0] }, 'deleted user']
        },
        lastMessageBy: { $arrayElemAt: ['$lastMessageSender.firstName', 0] }
      }
    },
    {
      $project: {
        _id: 0,
        user: 0,
        lastMessageSender: 0
      }
    }
  ]);

  console.log('chts ', chat);
  //   console.log('chat ', userDataId, chat);

  res.status(200).json({
    status: 'success',
    results: chat.length,
    data: {
      data: chat
    }
  });
});
