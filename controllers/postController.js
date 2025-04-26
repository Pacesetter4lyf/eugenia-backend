const Post = require('../models/postModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Get all posts with filtering
exports.getAllPosts = catchAsync(async (req, res, next) => {
  const { filter, personId } = req.query;
  const userId = req.user.id;

  let query = Post.find();

  // Apply filters based on the frontend requirements
  switch (filter) {
    case 'createdByMe':
      query = query.where('author').equals(userId);
      break;
    case 'createdForMe':
      query = query.where('forPerson').equals(req.user.profileId);
      break;
    case 'createdFor':
      if (!personId) {
        return next(
          new AppError(
            'Please provide a person ID for the "createdFor" filter',
            400
          )
        );
      }
      query = query.where('forPerson').equals(personId);
      break;
    case 'groupPosts':
      query = query.where('isGroupPost').equals(true);
      break;
    default:
      break;
  }

  // Populate author and forPerson details
  query = query
    .populate('author', 'firstName lastName')
    .populate('forPerson', 'firstName lastName')
    .sort('-createdAt');

  const posts = await query;

  res.status(200).json({
    status: 'success',
    results: posts.length,
    data: {
      posts
    }
  });
});

// Get a single post
exports.getPost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id)
    .populate('author', 'firstName lastName')
    .populate('forPerson', 'firstName lastName')
    .populate('comments.user', 'firstName lastName');

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      post
    }
  });
});

// Create a new post
exports.createPost = catchAsync(async (req, res, next) => {
  const { title, content, forPerson, isGroupPost, group } = req.body;

  const post = await Post.create({
    title,
    content,
    author: req.user.profileId,
    forPerson,
    isGroupPost,
    group
  });

  res.status(201).json({
    status: 'success',
    data: {
      post
    }
  });
});

// Toggle comments on/off for a post
exports.toggleComments = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  // Check if the user is the author
  if (post.author.toString() !== req.user.id) {
    return next(
      new AppError('You can only toggle comments on your own posts', 403)
    );
  }

  const updatedPost = await Post.findByIdAndUpdate(
    req.params.id,
    { commentsEnabled: !post.commentsEnabled },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      post: updatedPost
    }
  });
});

// Set a post as a group resource
exports.setAsGroupResource = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  // Check if the user is the author
  if (post.author.toString() !== req.user.id) {
    return next(
      new AppError('You can only set your own posts as group resources', 403)
    );
  }

  const updatedPost = await Post.findByIdAndUpdate(
    req.params.id,
    { isGroupResource: true },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      post: updatedPost
    }
  });
});

// Update the addComment function to check if comments are enabled
exports.addComment = catchAsync(async (req, res, next) => {
  const { content } = req.body;

  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  // Check if comments are enabled
  if (!post.commentsEnabled) {
    return next(new AppError('Comments are disabled for this post', 403));
  }

  const updatedPost = await Post.findByIdAndUpdate(
    req.params.id,
    {
      $push: {
        comments: {
          user: req.user.id,
          content
        }
      },
      lastCommentDate: Date.now()
    },
    {
      new: true,
      runValidators: true
    }
  ).populate('comments.user', 'firstName lastName');

  res.status(200).json({
    status: 'success',
    data: {
      post: updatedPost
    }
  });
});

// Update a post
exports.updatePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  // Check if the user is the author
  if (post.author.toString() !== req.user.id) {
    return next(new AppError('You can only update your own posts', 403));
  }

  const updatedPost = await Post.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      post: updatedPost
    }
  });
});

// Delete a post
exports.deletePost = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(new AppError('No post found with that ID', 404));
  }

  // Check if the user is the author
  if (post.author.toString() !== req.user.id) {
    return next(new AppError('You can only delete your own posts', 403));
  }

  await Post.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});
