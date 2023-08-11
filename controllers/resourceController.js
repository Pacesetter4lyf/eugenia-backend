const Resource = require('./../models/resourceModel');
const factory = require('./handlerFactory');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');

exports.setTourUserIds = (req, res, next) => {
  // Allow nested routes
  //   if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user.id;
  next();
};
const popOptions = {
  path: 'user',
  select: 'firstName lastName -_id'
};
exports.getAllResources = factory.getAll(Resource, popOptions);
exports.getResource = factory.getOne(Resource, popOptions);
exports.createResource = factory.createOne(Resource, popOptions);
exports.updateResource = factory.updateOne(Resource, popOptions);
exports.deleteResource = factory.deleteOne(Resource);

exports.getUserResource = catchAsync(async (req, res, next) => {
  const { userDataId } = req.params;

  console.log('userResource', userDataId);

  if (!userDataId) {
    next(
      new AppError(
        'Please provide the user data identifier',
        400
      )
    );
  }

  const resource = await Resource.find({
    user: userDataId
  }).populate({ path: 'user' });

  res.status(200).json({
    status: 'success',
    results: resource.length,
    data: {
      data: resource
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
