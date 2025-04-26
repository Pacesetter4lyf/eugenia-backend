// eslint-disable-next-line node/no-missing-require
const { base } = require('@uploadcare/upload-client');
const {
  deleteFile,
  UploadcareSimpleAuthSchema
} = require('@uploadcare/rest-client');

const multer = require('multer');
const sharp = require('sharp');
const Profile = require('../models/profileModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
});

exports.parseFile = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

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
      return {
        url: `https://ucarecdn.com/${result.file}/`
      };
    }
  }
};
exports.checkAndUploadFile = async (req, res, next) => {
  if (req.file) {
    const { url } = await uploadFileToUploadCare(req);
    req.body.photo = url;
  }
  next();
};

exports.revalidateImageUrl = catchAsync(async (req, res, next) => {
  // if the request has a file, then get the url of the original file and delete it
  if (req.file) {
    const oldMedia = await Profile.findById(req.params.id);
    const mediaUrl = oldMedia.photo;
    await deleteUploadCareFile(mediaUrl);
    const { url } = await uploadFileToUploadCare(req);
    req.body.photo = url;
  }
  next();
});

exports.checkAndDeleteFromUploadCare = catchAsync(async (req, res, next) => {
  if (req.body.url) {
    const resourceUrl = req.body.url;
    await deleteUploadCareFile(resourceUrl);
  } else {
    const media = await Profile.findById(req.params.id);
    const resourceUrl = media.url;
    await deleteUploadCareFile(resourceUrl);
  }
  next();
});

exports.createProfile = factory.createOne(Profile);
exports.getProfile = factory.getOne(Profile);
exports.getAllProfiles = factory.getAll(Profile);
exports.updateProfile = factory.updateOne(Profile);
exports.deleteProfile = factory.deleteOne(Profile);
