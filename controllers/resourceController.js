const Resource = require('./../models/resourceModel');
const factory = require('./handlerFactory');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const { getSetting, getFilter2, getViewer } = require('./utilityController');
const multer = require('multer');
const {
  deleteFile,
  UploadcareSimpleAuthSchema
} = require('@uploadcare/rest-client');
const { base } = require('@uploadcare/upload-client');

const multerStorage = multer.memoryStorage();
const upload = multer({
  storage: multerStorage
});
exports.parseFile = upload.single('file');

exports.setTourUserIds = (req, res, next) => {
  // Allow nested routes
  //   if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user.id;
  next();
};
const popOptions = {
  path: 'user',
  select: 'firstName lastName _id'
};
exports.getAllResources = factory.getAll(Resource, popOptions);
exports.getResource = factory.getOne(Resource, popOptions);
exports.createResource = factory.createOne(Resource, popOptions);
exports.updateResource = factory.updateOne(Resource, popOptions);
exports.deleteResource = factory.deleteOne(Resource);

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
    console.log('error occured deleting the file');
  }
};

const uploadFileToUploadCare = async (req, isCreating) => {
  console.log('incoming file ', req.file);
  // fileData must be `Blob` or `File` or `Buffer`
  const result = await base(req.file.buffer, {
    publicKey: process.env.UPLOAD_CARE_PUBLIC_KEY,
    store: 'auto',
    metadata: {
      subsystem: 'uploader',
      tag: 'user profile'
    }
  });
  if (!isCreating) {
    const oldResource = await Resource.findById(req.body.resourceId);
    const resourceUrl = oldResource.url
    deleteUploadCareFile(resourceUrl)
  }
  if (result?.file) {
    req.body.url = `https://ucarecdn.com/${result.file}/`;
  }
};

exports.processFile = catchAsync(async (req, res, next) => {
  console.log('req', req.file, req.method);
  if (req.file) {
    if (req.body.resourceId) await uploadFileToUploadCare(req, false);
    else await uploadFileToUploadCare(req, true);
  }

  if (req.method === 'DELETE') {
    const resourceId = req.params.id
    const oldResource = await Resource.findById(resourceId);
    const resourceUrl = oldResource.url
    deleteUploadCareFile(resourceUrl)
  }
  next();
});

exports.getUserResource = catchAsync(async (req, res, next) => {
  const { userDataId } = req.params;

  console.log('userResource', userDataId);

  if (!userDataId) {
    next(new AppError('Please provide the user data identifier', 400));
  }

  const viewer = await getViewer(req);
  let selector;

  if (viewer === 'self' || viewer === 'user-viewing' || viewer === 'i-admin') {
    selector = [
      {
        $or: [
          { viewableBy: 'self' },
          { viewableBy: 'lineage' },
          { viewableBy: 'public' }
        ]
      }
    ];
  } else if (viewer === 'lineage') {
    selector = [{ $or: [{ viewableBy: 'lineage' }, { viewableBy: 'public' }] }];
  } else if (viewer === 'public') {
    selector = [{ viewableBy: 'public' }];
  }

  const resource = await Resource.find({
    user: userDataId,
    $and: selector
  }).populate({ path: 'user', select: 'firstName lastName id _id' });

  res.status(200).json({
    status: 'success',
    results: resource.length,
    data: {
      data: resource
    }
  });
});

exports.getLineageResource = catchAsync(async (req, res, next) => {
  const userLineage = req.user.lineage;
  const userDataId = req.user.userDataId;
  // give me all the resources
  // where the user is in the lineage of the user who has the resource

  console.log('booyah...');

  const lineageResources = await Resource.aggregate([
    {
      $lookup: {
        from: 'userdatas', // Replace with the actual name of the User collection
        localField: 'user',
        foreignField: '_id',
        as: 'userDetails'
      }
    },
    {
      $unwind: '$userDetails' // Unwind the array to get each user details document separately
    },
    {
      $addFields: {
        user: {
          firstName: '$userDetails.firstName',
          lastName: '$userDetails.lastName',
          id: '$userDetails._id'
        }
      }
    },

    {
      $match: {
        $or: [
          // { 'user.id': new ObjectId(userDataId) }, commmented out, the user will not see his resource in lineage
          {
            $and: [
              { 'userDetails.lineage': { $in: userLineage } },
              {
                $or: [
                  { viewableBy: 'public' },
                  { viewableBy: 'lineage' },
                  { viewableBy: { $exists: false } }
                ]
              }
            ]
          }
        ]
      }
    },
    {
      $unset: 'userDetails' // Remove the userDetails field
    }
  ]);

  // const lineageResources = await Resource.find({})
  //   .populate({
  //     path: 'user',
  //     select: 'firstName lastName lineage _id'
  //   })
  //   .where({
  //     $or: [
  //       {
  //         $and: [
  //           { 'user.lineage': { $in: userLineage } },
  //           {
  //             $or: [
  //               { viewableBy: 'public' },
  //               { viewableBy: 'lineage' },
  //               { viewableBy: { $exists: false } }
  //             ]
  //           }
  //         ]
  //       }
  //     ]
  //   })
  //   .select('-user.lineage')
  //   .lean(); // Add .lean() to get plain JavaScript objects instead of Mongoose documents

  // do the filtering here

  res.status(200).json({
    status: 'success',
    results: lineageResources.length,
    data: {
      data: lineageResources
    }
  });
});

exports.copyResource = catchAsync(async (req, res, next) => {
  const session = req.session;

  // get userDataId from the codeDetails
  const userDataId = req.codeDetails.userData.id;
  const nodeToId = req.codeDetails.nodeTo.id;

  if (req.codeDetails.mode === 'replace') {
    // find the user data in the resources document
    const resources = await Resource.find({ user: nodeToId }).session(session);

    // Step 2: Remove _id and update userId in each document
    const modifiedDocuments = resources.map(document => {
      const modifiedDocument = document.toObject(); // Convert Mongoose document to a plain JavaScript object
      delete modifiedDocument._id; // Remove _id field
      modifiedDocument.user = userDataId; // Update userId field
      return modifiedDocument;
    });

    await Resource.insertMany(modifiedDocuments, { session: session });
  }
  next();
});
