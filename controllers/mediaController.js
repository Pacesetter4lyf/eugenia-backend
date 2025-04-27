// eslint-disable-next-line node/no-missing-require
const { base } = require('@uploadcare/upload-client');
const {
  deleteFile,
  UploadcareSimpleAuthSchema
} = require('@uploadcare/rest-client');
const multer = require('multer');
const Media = require('../models/mediaModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');
const Lineage = require('../models/lineageModel');
const Group = require('../models/groupModel');

const multerStorage = multer.memoryStorage();
const upload = multer({
  storage: multerStorage
});
exports.parseFile = upload.single('file');

const uploadFileToUploadCare = async req => {
  if (req.file) {
    const result = await base(req.file.buffer, {
      publicKey: process.env.UPLOAD_CARE_PUBLIC_KEY,
      store: 'auto',
      metadata: {
        subsystem: 'uploader',
        tag: 'user profile'
      }
    });
    if (result && result.file) {
      // console.log(result, req.file);
      const baseMimeType = req.file.mimetype.split('/')[0];
      req.body.url = `https://ucarecdn.com/${result.file}/`;
      req.body.mediaType = baseMimeType;
    }
  }
};
const deleteUploadCareFile = async resourceUrl => {
  const uploadcareSimpleAuthSchema = new UploadcareSimpleAuthSchema({
    publicKey: process.env.UPLOAD_CARE_PUBLIC_KEY,
    secretKey: process.env.UPLOAD_CARE_PRIVATE_KEY
  });
  try {
    await deleteFile(
      {
        uuid: resourceUrl.split('/')[3]
      },
      { authSchema: uploadcareSimpleAuthSchema }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log('error occured deleting the file');
  }
};

exports.checkAndUploadFile = async (req, res, next) => {
  if (req.file) await uploadFileToUploadCare(req);
  next();
};

exports.revalidateImageUrl = catchAsync(async (req, res, next) => {
  // if the request has a file, then get the url of the original file and delete it
  if (req.file) {
    const oldMedia = await Media.findById(req.params.id);
    const mediaUrl = oldMedia.url;
    await deleteUploadCareFile(mediaUrl);
    await uploadFileToUploadCare(req);
  }
  next();
});

exports.checkAndDeleteFromUploadCare = catchAsync(async (req, res, next) => {
  if (req.body.url) {
    const resourceUrl = req.body.url;
    await deleteUploadCareFile(resourceUrl);
  } else {
    const media = await Media.findById(req.params.id);
    const resourceUrl = media.url;
    await deleteUploadCareFile(resourceUrl);
  }
  next();
});

exports.getMyMedia = catchAsync(async (req, res, next) => {
  //   req.user.id = '65f1234567890abcd1234567'
  // get all the media where user is the current user
  //   const media = await Media.find({ user: req.user.id });
  const media = await Media.find({ user: '65f1234567890abcd1234567' }).select(
    '-viewableBy -hiddenTo'
  );
  res.status(200).json({
    status: 'success',
    data: {
      data: media
    }
  });
});

exports.getTheirMedia = catchAsync(async (req, res, next) => {
  // see whether user is authorised to view the media and is so get the media
  // get all the media for the requested user
  const { user } = req.params;
  const media = await Media.find({ user }).select('-viewableBy -hiddenTo');
  res.status(200).json({
    status: 'success',
    data: {
      data: media
    }
  });
});

exports.getMedia = factory.getOne(Media);
exports.getAllMedias = factory.getAll(Media);
exports.createMedia = factory.createOne(Media);
exports.updateMedia = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('No media found with that ID', 404));
  }

  // Check if user is the owner
  if (media.user.toString() !== req.user.id) {
    return next(
      new AppError('You do not have permission to update this media', 403)
    );
  }

  const updatedMedia = await Media.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      media: updatedMedia
    }
  });
});
exports.deleteMedia = catchAsync(async (req, res, next) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    return next(new AppError('No media found with that ID', 404));
  }

  // Check if user is the owner
  if (media.user.toString() !== req.user.id) {
    return next(
      new AppError('You do not have permission to delete this media', 403)
    );
  }

  // Delete from uploadcare first
  await deleteUploadCareFile(media.url);

  await Media.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getFilteredMedia = catchAsync(async (req, res, next) => {
  const { lineageId, groupId, mediaType } = req.query;
  let query = {};

  // If filtering by lineage
  if (lineageId) {
    const lineage = await Lineage.findById(lineageId);
    if (!lineage) {
      return next(new AppError('Lineage not found', 404));
    }
    query = {
      user: { $in: lineage.lineageMembers.map(member => member.profileId) }
    };
  }

  // If filtering by group
  if (groupId) {
    const group = await Group.findById(groupId);
    if (!group) {
      return next(new AppError('Group not found', 404));
    }
    query = {
      ...query,
      user: { $in: group.members.map(member => member.user) }
    };
  }

  // If filtering by media type
  if (mediaType) {
    query = {
      ...query,
      mediaType: mediaType
    };
  }

  // Get media with populated user details
  const media = await Media.find(query)
    .select('-viewableBy -hiddenTo')
    .populate({
      path: 'user',
      select: 'firstName lastName'
    });

  res.status(200).json({
    status: 'success',
    results: media.length,
    data: {
      media
    }
  });
});
