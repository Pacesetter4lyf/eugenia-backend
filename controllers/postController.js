const Post = require('../models/postModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.createPost = catchAsync(async (req, res, next) => {
  const poster = req.user.userDataId;
  const lineage = req.user.lineage;
  const reqPost = req.body.postDetails;
  const isEditing = req.body.isEditing;
  // console.log('reqPost', reqPost);

  const {
    isForPerson,
    title,
    isCommentsTurnedOff,
    isNotVisibleByLineage,
    postBox,
    personId,
    id
  } = reqPost;

  let postDetails = {
    postBox,
    isForPerson,
    title,
    isCommentsTurnedOff,
    postBox,
    poster
  };

  if (reqPost.isForPerson) {
    postDetails.personId = personId;
    postDetails.isNotVisibleByLineage = isNotVisibleByLineage;
  } else {
    postDetails.forLineage = lineage;
  }

  let post;
  if (!isEditing) {
    post = await Post.create(postDetails);
  } else {
    delete postDetails.isForPerson;
    delete postDetails.personId;
    post = await Post.findByIdAndUpdate(id, postDetails, { new: true });
  }

  // Populate the personId field
  await post
    .populate('poster', 'firstName lastName _id lineage id')
    .execPopulate();

  res.status(200).json({
    status: 'success',
    data: {
      data: post
    }
  });
});

exports.getAllPosts = catchAsync(async (req, res, next) => {
  const userDataId = req.user.userDataId;
  const lineage = req.user.lineage;

  // if forPerson, get if personId is in lineage
  // if for lineage, get it
  // get all where the user is the creator of the post
  const pipeline = [
    {
      $lookup: {
        from: 'userdatas',
        localField: 'personId',
        foreignField: '_id',
        as: 'personId'
      }
    },
    {
      $lookup: {
        from: 'userdatas',
        localField: 'poster',
        foreignField: '_id',
        as: 'poster'
      }
    },
    {
      $addFields: {
        personId: { $arrayElemAt: ['$personId', 0] },
        poster: { $arrayElemAt: ['$poster', 0] }
      }
    },
    {
      $match: {
        $or: [
          {
            isForPerson: true,
            'personId.lineage': { $in: lineage }
          },
          {
            isForPerson: false,
            forLineage: { $in: lineage }
          },
          {
            poster: userDataId
          }
        ]
      }
    },
    // dfvdfv
    {
      $lookup: {
        from: 'userdatas', // Replace with the actual User Model collection name
        localField: 'comments.userId',
        foreignField: '_id',
        as: 'commentUsers'
      }
    },
    {
      $addFields: {
        comments: {
          $map: {
            input: '$comments',
            as: 'comment',
            in: {
              $mergeObjects: [
                '$$comment',
                {
                  userId: {
                    $cond: {
                      if: { $eq: ['$$comment.commentUsers', []] }, // Check if the user array is empty
                      then: {}, // If empty, provide an empty object
                      else: {
                        firstName: {
                          $arrayElemAt: ['$commentUsers.firstName', 0]
                        },
                        lastName: {
                          $arrayElemAt: ['$commentUsers.lastName', 0]
                        },
                        id: {
                          $arrayElemAt: ['$commentUsers._id', 0]
                        }
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    },
    {
      $project: {
        id: '$_id',
        title: 1,
        datePosted: 1,
        postBox: 1,
        comments: 1,
        likes: 1,
        // personId: 1,
        isLineageResource: 1,
        personId: '$personId._id',
        poster: {
          id: '$poster._id',
          firstName: '$poster.firstName',
          lastName: '$poster.lastName',
          adminableBy: '$poster.adminableBy',
          lineage: '$poster.lineage'
        }
      }
    }
  ];

  const post = await Post.aggregate(pipeline);

  res.status(200).json({
    status: 'success',
    data: {
      data: post
    }
  });
});

exports.getPost = catchAsync(async (req, res, next) => {
  const postId = req.params.id;
  const post = await Post.findById(postId);

  // .populate(
  //   'poster',
  //   'firstName lastName _id lineage id'
  // );

  const populateOptions = [
    { path: 'poster', select: 'firstName lastName _id lineage id adminableBy' },
    { path: 'comments.userId', select: 'firstName _id id' }
  ];
  await post.populate(populateOptions).execPopulate();

  res.status(200).json({
    status: 'success',
    data: {
      data: post
    }
  });
});

exports.updatePost = catchAsync(async (req, res, next) => {
  const postId = req.params.id;
  const userId = req.user.userDataId;
  const newComment = req.body.comment;

  const toBeUpdated = {
    userId,
    comment: newComment
  };
  console.log('newc', toBeUpdated);

  let updated;
  if (newComment) {
    updated = await Post.findByIdAndUpdate(
      postId,
      { $push: { comments: toBeUpdated } },
      { new: true }
    );
  } else {
    updated = await Post.findById(postId);
  }

  const populateOptions = [
    { path: 'poster', select: 'firstName lastName _id lineage id adminableBy' },
    { path: 'comments.userId', select: 'firstName _id id' }
  ];
  await updated.populate(populateOptions).execPopulate();
  // await updated
  //   .populate('poster', 'firstName lastName _id lineage id')
  //   .execPopulate();
  console.log('updated  ', updated);
  res.status(200).json({
    status: 'success',
    data: {
      data: updated
    }
  });
});

exports.like = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const todo = req.body.like;
  const userDataId = req.user.userDataId;

  let operation;
  if (todo === 'like') {
    operation = { $push: { likes: userDataId } };
  } else {
    operation = { $pull: { likes: userDataId } };
  }

  const response = await Post.findOneAndUpdate({ _id: id }, operation, {
    new: true
  });
  console.log(todo);

  res.status(200).json({
    status: 'success',
    data: {
      data: response.likes
    }
  });
});

exports.patchPost = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const todo = req.body.todo;
  const value = req.body.value;
  const userDataId = req.user.userDataId;

  let response;
  if (todo === 'enableComment') {
    response = await Post.findOneAndUpdate(
      { _id: id },
      { isCommentsTurnedOff: value },
      {
        new: true
      }
    );
  } else if (todo === 'lineageResource') {
    response = await Post.findOneAndUpdate(
      { _id: id },
      { isLineageResource: value },
      {
        new: true
      }
    );
  }

  console.log(todo);
  const populateOptions = [
    { path: 'poster', select: 'firstName lastName _id lineage id adminableBy' },
    { path: 'comments.userId', select: 'firstName _id id' }
  ];
  await response.populate(populateOptions).execPopulate();

  res.status(200).json({
    status: 'success',
    data: {
      data: response
    }
  });
});

exports.deletePost = catchAsync(async (req, res, next) => {
  const resource = '1234';
  res.status(200).json({
    status: 'success',
    data: {
      data: resource
    }
  });
});
