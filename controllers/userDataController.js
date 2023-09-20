const multer = require('multer');
const sharp = require('sharp');
// import { storeFile, UploadcareSimpleAuthSchema } from '@uploadcare/rest-client';
const {
  deleteFile,
  UploadcareSimpleAuthSchema
} = require('@uploadcare/rest-client');
const { base } = require('@uploadcare/upload-client');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');
const UserData = require('../models/userDataModel');
const JoinCode = require('./../models/joinCodeModel');
const Resource = require('../models/resourceModel');
const Setting = require('../models/settingModel');
const { getSetting, getFilter2, getViewer } = require('./utilityController');

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const uploadAnyFileToUploadCare = async (req, isCreating) => {
  console.log('incoming file ', req.file);
  // fileData must be `Blob` or `File` or `Buffer`
  const result = await base(req.file.buffer, {
    publicKey: process.env.UPLOAD_CARE_PUBLIC_KEY,
    store: '0',
    metadata: {
      subsystem: 'uploader',
      tag: 'user profile'
    }
  });
  if (!isCreating) {
    const sameUser = await UserData.findById(req.params.id);
    if (
      sameUser.photo !==
      'https://ucarecdn.com/f44a4885-293e-4518-be59-1e8b3c84881b/'
    ) {
      // delete the previous photo
      const uploadcareSimpleAuthSchema = new UploadcareSimpleAuthSchema({
        publicKey: process.env.UPLOAD_CARE_PUBLIC_KEY,
        secretKey: process.env.UPLOAD_CARE_PRIVATE_KEY
      });
      try {
        const result = await deleteFile(
          {
            uuid: sameUser.photo.split('/')[3]
          },
          { authSchema: uploadcareSimpleAuthSchema }
        );
        console.log('result ', result);
      } catch (err) {
        console.log('error occured deleting the file');
      }
    }
  }

  if (result?.file) {
    return `https://ucarecdn.com/${result.file}/`;
  } else return 'https://ucarecdn.com/f44a4885-293e-4518-be59-1e8b3c84881b/';
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.buffer = await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toBuffer();
  next();
});

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (!allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }
  //   console.log(req.file, req.body);
  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  if (req.file)
    filteredBody.photo = await uploadAnyFileToUploadCare(req, false);

  // filteredBody.userId = req.user.id;

  // 3) Update user document
  const updatedUser = await UserData.findByIdAndUpdate(
    req.params.id,
    filteredBody,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

// create new user
exports.createUser = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }
  // console.log(req.body.mode);
  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  if (req.file) filteredBody.photo = await uploadAnyFileToUploadCare(req, true);

  // here we have to send the photo, delete the previous and get the new url
  console.log('mode ', req.body.mode);
  // get and append the lineage number
  if (req.body.mode === 'self') {
    filteredBody.userId = req.user.id;
  } else {
    const actualUserData = await UserData.findOne({ userId: req.user.id });
    // if you cant find a data, exit early
    const actualUserDataId = actualUserData.id;
    const lineage = actualUserData.lineage;

    // get the user we want to append to// do not append to a node not in your own lineage
    const appendToUser = await UserData.findById(filteredBody.appendTo);
    const appendToLineage = appendToUser.lineage;
    const isInLineage = appendToLineage.includes(lineage);
    if (!isInLineage) {
      return next(
        new AppError('You cant append to a lineage you do not belong to', 400)
      );
    }
    filteredBody.createdBy = actualUserDataId;
    filteredBody.lineage = lineage;

    console.log('append to user ', appendToUser.id);

    // if we are appending while creating a new user
    const appendAs = req.body.appendAs;
    if (appendAs === 'father') {
      filteredBody.child = [appendToUser.id]; //...appendToUser.sibling
    } else if (appendAs === 'mother') {
      filteredBody.child = [appendToUser.id];
    } else if (appendAs === 'sibling') {
      filteredBody.sibling = [appendToUser.id, ...appendToUser.sibling];
    } else if (appendAs === 'child') {
      if (appendToUser.gender === 'Male') filteredBody.father = appendToUser.id;
      else filteredBody.mother = appendToUser.id;
    } else if (appendAs === 'wife') {
      filteredBody.husband = [appendToUser.id];
    } else if (appendAs === 'husband') {
      filteredBody.wife = [appendToUser.id];
    }
  }
  // here get the designation of appendTo. For instance, if append as
  // father then the filtered body should have child: [appendTo]
  // mother -> child: [appendTo]
  // sibling -> sibling: [appendTo]
  // child -> father/mother: [appendTo]
  // wife -> husband: [appendTo]
  // husband -> wife: [appendTo]
  console.log('creating...', filteredBody);
  const updatedUser = await UserData.create(filteredBody);
  console.log('created..!');

  //start
  //create the setting
  const setting = await Setting.create({ userData: updatedUser.id });
  const settingId = setting.id;
  await UserData.findByIdAndUpdate(updatedUser.id, { setting: settingId });
  console.log('setting ....', setting);
  // end

  let relationship;
  // if you are appending, set up the relationship
  if (req.body.mode !== 'self') {
    const appendAs = req.body.appendAs;
    const appendTo = req.body.appendTo;
    if (appendAs === 'father') {
      relationship = await UserData.findByIdAndUpdate(appendTo, {
        father: updatedUser.id
      });
    } else if (appendAs === 'mother') {
      relationship = await UserData.findByIdAndUpdate(appendTo, {
        mother: updatedUser.id
      });
    } else {
      const update = {};
      update[`$push`] = {};
      update[`$push`][appendAs] = updatedUser.id;
      relationship = await UserData.findByIdAndUpdate(appendTo, update, {
        new: true
      });
    }
    //createSession
    const session = req.session;
    await session.startTransaction();
    linkAll(updatedUser, appendAs, session);

    //commitTransaction
    await session.commitTransaction();
  }

  console.log('updated user', updatedUser);
  if (!req.user.isRegistered && req.body.mode === 'self') {
    // console.log('reg...', req.user.id);
    await User.findByIdAndUpdate(
      req.user.id,
      { isRegistered: updatedUser.id },
      // { isRegistered: updatedUser.id },

      {
        new: true,
        runValidators: true
      }
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

async function linkAll(updatedUser, appendAs, session) {
  // call the different saving methods here
  const options = { session };
  const appendArray = [
    'child',
    'sibling',
    'father',
    'mother',
    'wife',
    'husband'
  ];

  for (const item of appendArray) {
    if (appendAs !== item || appendAs === 'sibling') {
      switch (item) {
        case 'child':
          await setChild(updatedUser);
          console.log(1);
          break;
        case 'sibling':
          await setSibling(updatedUser);
          console.log(2);
          break;
        case 'father':
          await setFather(updatedUser);
          console.log(3);
          break;
        case 'mother':
          await setMother(updatedUser);
          console.log(4);
          break;
        case 'wife':
          await setWife(updatedUser);
          console.log(5);
          break;
        case 'husband':
          await setHusband(updatedUser);
          console.log(6);
          break;
      }
    }
  }

  async function setFather(updatedUser) {
    if (updatedUser.father) return;
    console.log('father');
    let mother, father;
    const siblings = updatedUser.sibling;
    const children = await UserData.find({ _id: { $in: siblings } }).session(
      session
    );
    father = Array.from(
      new Set(
        children.map(child => child.father).filter(id => id !== undefined)
      )
    );
    let father1;
    let father2;
    if (father && father.length > 0) father1 = father[0];

    console.log('reached Here 1');
    mother = updatedUser.mother;
    const foundMother = await UserData.findById(mother).session(session);

    if (
      foundMother &&
      // foundMother.length > 0 &&
      foundMother.husband &&
      foundMother.husband.length
    )
      father2 = foundMother.husband[0];

    // save the
    let actualFather = father1 || father2;
    console.log('reached Here 3', actualFather);
    if (actualFather) {
      updatedUser.father = actualFather;
      await updatedUser.save(session);
      console.log('reached Here 4');
      // now set the father.child
      let father = await UserData.findById(actualFather).session(session);
      let children = father.child;
      console.log('reached Here 5', children);
      children = [...children, updatedUser.id];
      father.child = children;
      await father.save(session);
    }
  }

  async function setMother(updatedUser) {
    console.log('mother');
    if (updatedUser.mother) return;
    let mother, father;
    const siblings = updatedUser.sibling;
    const children = await UserData.find({ _id: { $in: siblings } }).session(
      session
    );
    console.log('children ', children);
    mother = Array.from(
      new Set(
        children
          .map(child => child.mother?.toString())
          .filter(id => id !== undefined)
      )
    );
    let mother1;
    let mother2;
    if (mother && mother.length > 0) mother1 = mother[0];

    father = updatedUser.father;
    const foundFather = await UserData.findById(father).session(session);
    if (
      foundFather &&
      // foundFather.length > 0 &&
      foundFather.wife &&
      foundFather.wife.length
    )
      mother2 = foundFather.wife[0];

    // save the
    let actualMother = mother1 || mother2;
    if (actualMother) {
      updatedUser.mother = actualMother;
      await updatedUser.save({ session });
      console.log('here 1', actualMother);

      // now set the mother.child

      let mother = await UserData.findById(actualMother);
      let children = mother.child;
      console.log('children again ', children);
      children = [...children, updatedUser.id];
      mother.child = children;
      await mother.save({ session });
      console.log('here 2');
    }
  }

  async function setWife(updatedUser) {
    console.log('wife');
    let children = updatedUser.child;
    let wife;
    if (children && children.length > 0) {
      children = await UserData.find({ _id: { $in: children } }).session(
        session
      );
      wife = Array.from(
        new Set(
          children
            .map(child => child.mother?.toString())
            .filter(id => id !== undefined)
        )
      );

      console.log('wife ', wife);
    }
    if (wife && wife.length && updatedUser.gender === 'Male') {
      updatedUser.wife = wife;
      await updatedUser.save({ session });
      // update all the .husband in each wife in the array
      await UserData.updateMany(
        { _id: { $in: wife } },
        { $addToSet: { husband: updatedUser.id } },
        { session }
      );
    }
  }

  async function setHusband(updatedUser) {
    console.log('husband');
    let children = updatedUser.child;
    let husband;
    if (children && children.length > 0) {
      children = await UserData.find({ _id: { $in: children } }).session(
        session
      );
      husband = Array.from(
        new Set(
          children
            .map(child => child.father?.toString())
            .filter(id => id !== undefined)
        )
      );
    }
    console.log('husband ', husband);
    if (husband && husband.length && updatedUser.gender === 'Female') {
      updatedUser.husband = husband;
      await updatedUser.save({ session });
      // update all the .wife in each husband in the array
      await UserData.updateMany(
        { _id: { $in: husband } },
        { $addToSet: { wife: updatedUser.id } },
        { session }
      );
    }
  }

  async function setSibling(updatedUser) {
    console.log('sibling');
    let sibling1 = updatedUser.sibling;
    console.log('sibling1 A', sibling1);
    let temp;
    if (sibling1 && sibling1.length > 0) {
      temp = [...sibling1];
      console.log('..... will soon process');
      sibling1 = sibling1.map(objectID => objectID.toString()); //convert to string
      console.log('sibling1 AA', sibling1);
      sibling1 = await UserData.find({ _id: { $in: sibling1 } }).session(
        session
      );
      console.log('..... has just processed');
      console.log('sibling1 B', sibling1);
      sibling1 = Array.from(
        new Set(
          sibling1.flatMap(sib => sib.sibling).filter(id => id !== undefined)
        )
      );
      sibling1 = [...sibling1, ...temp];
      console.log('sibling1 C', sibling1);
    }
    console.log('before setting undefined');
    if (!sibling1.length) sibling1 = undefined;

    let sibling2;
    let father = updatedUser.father;
    console.log('before father operation');
    father = await UserData.findById(father).session(session);
    sibling2 = father?.child;

    let sibling3;
    let mother = updatedUser.mother;
    console.log('mother ', mother);
    mother = await UserData.findById(mother).session(session);
    console.log('mother ', mother);
    sibling3 = mother?.child;

    console.log('results ... ', sibling1, sibling2, sibling3);
    // let actualSibling = sibling1 || sibling2 || sibling3;

    let actualSibling = sibling1;
    if (
      !actualSibling ||
      (sibling2 && sibling2.length > actualSibling.length)
    ) {
      actualSibling = sibling2;
    }
    if (
      !actualSibling ||
      (sibling3 && sibling3.length > actualSibling.length)
    ) {
      actualSibling = sibling3;
    }

    if (actualSibling && actualSibling.length) {
      console.log('actual sibling ', actualSibling);
      console.log('updated user sibling ', updatedUser.sibling);

      const updatedUserSiblingStrings = updatedUser.sibling.map(id =>
        id.toString()
      );
      const actualSiblingStrings = actualSibling.map(id => id.toString());

      updatedUser.sibling = Array.from(
        new Set(
          [...updatedUserSiblingStrings, ...actualSiblingStrings].filter(
            id => id != updatedUser.id
          )
        )
      );

      console.log(
        'typeof ',
        typeof updatedUser.sibling[0],
        typeof actualSibling[0]
      );
      console.log('updated user sibling after ', updatedUser.sibling);
      await updatedUser.save({ session });

      console.log('actual sibling 1', actualSibling);
      actualSibling = actualSibling.filter(id => id != updatedUser.id);
      console.log('actual sibling 1A', actualSibling);
      if (temp) {
        console.log('temp   ', temp);
        actualSibling = actualSibling.filter(id => id != temp[0]);
      }
      console.log('actual sibling 2', actualSibling);
      await UserData.updateMany(
        { _id: { $in: actualSibling }, sibling: { $ne: updatedUser.id } },
        { $addToSet: { sibling: updatedUser.id } },
        { session }
      );
    }
  }

  async function setChild(updatedUser) {
    console.log('child');
    let wife = updatedUser.wife;
    let children1;

    if (wife && wife.length > 0) {
      wife = await UserData.find({ _id: { $in: wife } }).session(session);
      children1 = Array.from(
        new Set(wife.flatMap(wife => wife.child).filter(id => id !== undefined))
      );
      console.log('children 1', children1);
    }

    let husband = updatedUser.husband;
    console.log('husband 1', husband);
    let children2;
    if (husband && husband.length > 0) {
      husband = await UserData.find({ _id: { $in: husband } }).session(session);
      console.log('husband 2', husband);
      children2 = Array.from(
        new Set(
          husband
            .flatMap(husband => husband.child)
            .filter(id => id !== undefined)
        )
      );
    }

    let children3;
    children3 = updatedUser.child;
    console.log('CHILDREN 3A ', children3);
    if (children3 && children3.length > 0) {
      children3 = await UserData.find({ _id: { $in: children3 } }).session(
        session
      );
      console.log('CHILDREN 3B ', children3);
      children3 = Array.from(
        new Set(
          children3
            .flatMap(child => child.sibling)
            .filter(id => id !== undefined)
        )
      );
    }
    console.log('CHILDREN  ', children1, children2, children3);

    let actualChildren;
    // if (
    //   children1.length >= children2.length &&
    //   children1.length >= children3.length
    // ) {
    //   actualChildren = children1;
    // } else if (
    //   children2.length >= children1.length &&
    //   children2.length >= children3.length
    // ) {
    //   actualChildren = children2;
    // } else {
    //   actualChildren = children3;
    // }
    actualChildren = children1 || children2 || children3;

    console.log('actual ', actualChildren);
    if (actualChildren && actualChildren.length) {
      updatedUser.child = Array.from(
        new Set([...updatedUser.child, ...actualChildren])
      );
      await updatedUser.save({ session });

      //if father, setfather else setmother

      if (updatedUser.gender === 'Male') {
        await UserData.updateMany(
          { _id: { $in: actualChildren } },
          { father: updatedUser.id },
          { session }
        );
      } else {
        await UserData.updateMany(
          { _id: { $in: actualChildren } },
          { mother: updatedUser.id },
          { session }
        );
      }
    }
    console.log('done child');
  }
}

exports.protectLineage = catchAsync(async (req, res, next) => {
  // get the lineage of the user
  //
  next();
});
exports.tree = catchAsync(async (req, res, next) => {
  // find the relationships and populate them
  const tree = await UserData.findById(req.params.id)
    .populate({
      path: 'mother',
      select: 'firstName lastName _id '
    })
    .populate({
      path: 'child',
      select: 'firstName lastName gender _id'
    })
    .populate({
      path: 'father',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'sibling',
      select: 'firstName lastName gender _id'
    })
    .populate({
      path: 'wife',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'husband',
      select: 'firstName lastName _id'
    });
  res.status(200).json({
    status: 'success',
    data: {
      data: tree
    }
  });
});

// exports.getUser = factory.getOne(UserData);
exports.getUser = factory.getOneByParam(UserData, 'userId', {
  path: 'resource'
});
exports.getUser_ = catchAsync(async (req, res, next) => {
  let query = UserData.findOne({ userId: req.params.id });
  let doc;
  try {
    doc = await query;
  } catch (err) {
    console.log('errr');
  }
  if (!doc) {
    return next(new AppError('No document found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: doc
    }
  });
});

exports.getUserWithId = factory.getOne(UserData, {
  path: 'resource'
});
// to get a single user and then make sure it returns the correct field
exports.getUserWithId_ = catchAsync(async (req, res, next) => {
  let query = UserData.findById(req.params.id);
  let doc;
  try {
    doc = await query;
  } catch (err) {
    console.log('errr');
  }
  if (!doc) {
    return next(new AppError('No document found with that ID', 404));
  }

  const settingsObject = await getSetting(req);
  const settings = {};
  settingsObject.forEach(item => {
    const field = Object.keys(item)[0];
    settings[field] = item[field];
  });

  const viewer = await getViewer(req);
  //
  let copiedDoc = { ...doc.toObject() };

  console.log('settings ', settings, viewer);
  // if(      viewer !== 'self' &&
  // viewer !== 'user-viewing' &&
  // viewer !== 'i-admin'){}
  // check whether the field is allowed
  Object.keys(settings).forEach(field => {
    if (
      viewer === 'self' ||
      viewer === 'user-viewing' ||
      viewer === 'i-admin'
    ) {
      // pass
    } else if (viewer === 'lineage') {
      // lineage viewing can see lineage, public nor self
      if (settings[field] === 'self') {
        delete copiedDoc[field];
      }
    } else if (viewer === 'public') {
      // cannot see lineage and self
      if (settings[field] === 'self' || settings[field] === 'lineage') {
        delete copiedDoc[field];
      }
    }
  });
  console.log('settings ', settings, viewer, copiedDoc);

  res.status(200).json({
    status: 'success',
    data: {
      data: copiedDoc
    }
  });
});

exports.getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    console.log('hello');

    let query = Model.findById(req.params.id);
    if (popOptions) query = query.populate(popOptions);

    let doc;
    try {
      doc = await query;
    } catch (err) {
      console.log('errr');
    }

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc
      }
    });
  });

exports.getAllUsers = factory.getAll(User);

exports.updateUser = factory.updateOne(User);

exports.deleteUser = catchAsync(async (req, res, next) => {
  const toDelete = req.params.id;
  // remove from the document

  // delete where is is father
  await UserData.updateMany({ father: toDelete }, { $unset: { father: 1 } });
  // delete where it is mother
  await UserData.updateMany({ mother: toDelete }, { $unset: { father: 1 } });
  // remove where it is sibling
  await UserData.updateMany(
    { sibling: toDelete },
    { $pull: { sibling: toDelete } }
  );
  // remove where it is wife
  await UserData.updateMany({ wife: toDelete }, { $pull: { wife: toDelete } });
  // remove where it is husband
  await UserData.updateMany(
    { husband: toDelete },
    { $pull: { husband: toDelete } }
  );
  // remove where it is child
  await UserData.updateMany(
    { child: toDelete },
    { $pull: { child: toDelete } }
  );

  await Setting.findOneAndRemove({ userData: toDelete });
  const doc = await UserData.findByIdAndRemove(toDelete);

  if (!doc) {
    return next(new AppError('No document found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: 'deleted'
    }
  });
});

exports.search = catchAsync(async (req, res, next) => {
  const searchText = req.params.text;
  const searchOutside = req.query.searchOutside;

  const user = req.user;
  const userData = await UserData.find({ userId: user._id });

  console.log(userData);
  const lineage = userData[0].lineage;

  // console.log(searchText, lineage, userData);

  let lineageFIlter;
  if (searchOutside === 'true') {
    lineageFIlter = { $nin: lineage };
  } else {
    lineageFIlter = { $in: lineage };
  }

  const results = await UserData.find({
    $or: [
      { firstName: { $regex: searchText, $options: 'i' } },
      { lastName: { $regex: searchText, $options: 'i' } }
    ],
    lineage: lineageFIlter
  })
    .select('firstName lastName father mother id')
    .populate({
      path: 'father',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'mother',
      select: 'firstName lastName _id'
    })
    .exec();

  res.status(200).json({
    status: 'success',
    data: {
      data: results
    }
  });
});

exports.getRelationship = catchAsync(async (req, res, next) => {
  const A = req.params.A;
  const B = req.params.B;

  const dataA = await UserData.findById(A);
  const dataB = await UserData.findById(B);
  let relationship;
  if (dataA.father == B) {
    relationship = 'father';
  } else if (dataA.mother == B) {
    relationship = 'mother';
  } else if (dataA.sibling && dataA.sibling.includes(B)) {
    relationship = 'sibling';
  } else if (dataA.child && dataA.child.includes(B)) {
    relationship = 'child';
  } else if (dataA.wife && dataA.wife.includes(B)) {
    relationship = 'wife';
  } else if (dataA.husband && dataA.husband.includes(B)) {
    relationship = 'husband';
  } else {
    relationship = 'none';
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: relationship
    }
  });
});

exports.setUnset = catchAsync(async (req, res, next) => {
  const A = req.params.B;
  const B = req.params.A;
  // note that there was a swap above
  const dataB = await UserData.findById(B);
  const dataA = await UserData.findById(A);

  const set = req.body.set;
  const relationship = req.body.relationship;
  const linkNode = req.body.linkNode;

  // A is the father of B
  // B.father = A
  // A.child = B

  if (set) {
    if (relationship === 'father' || relationship === 'mother') {
      await UserData.findByIdAndUpdate(B, {
        [relationship]: A
      });

      await UserData.updateOne({ _id: A }, { $addToSet: { child: B } });
    } else {
      await UserData.updateOne(
        { _id: B },
        { $addToSet: { [relationship]: A } }
      );

      if (relationship === 'child') {
        //get gender of B
        const gender = dataB.gender;
        if (gender === 'Male') {
          dataA.father = B;
          await dataA.save();
        } else {
          dataA.mother = B;
          await dataA.save();
        }
      } else if (relationship === 'sibling') {
        await UserData.updateOne({ _id: A }, { $addToSet: { sibling: B } });
      } else if (relationship === 'husband') {
        await UserData.updateOne({ _id: A }, { $addToSet: { wife: B } });
      } else if (relationship === 'wife') {
        await UserData.updateOne({ _id: A }, { $addToSet: { husband: B } });
      }
      // child, sibling, husband, wife
    }
    if (linkNode) {
      const session = req.session;
      await session.startTransaction();
      const dataA = await UserData.findById(A).session(session);
      await linkAll(dataA, relationship, session); // this is actually dataB in angular
      await session.commitTransaction();
    }
  } else {
    if (relationship === 'father' || relationship === 'mother') {
      // await UserData.findByIdAndUpdate(B, {
      //   relationship: undefined
      // });
      await UserData.findByIdAndUpdate(B, { $unset: { [relationship]: 1 } });

      await UserData.updateOne({ _id: A }, { $pull: { child: B } });
    } else {
      await UserData.updateOne({ _id: B }, { $pull: { [relationship]: A } });

      if (relationship === 'child') {
        //get gender of B
        const gender = dataB.gender;
        if (gender === 'Male') {
          dataA.father = undefined;
          // delete dataA.father;
          await dataA.save();
        } else {
          dataA.mother = undefined;
          // delete dataB.mother;
          await dataA.save();
        }
      } else if (relationship === 'sibling') {
        await UserData.updateOne({ _id: A }, { $pull: { sibling: B } });
      } else if (relationship === 'husband') {
        await UserData.updateOne({ _id: A }, { $unset: { wife: 1 } });
      } else if (relationship === 'wife') {
        await UserData.updateOne({ _id: A }, { $unset: { husband: 1 } });
      }
      // child, sibling, husband, wife
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: set ? relationship : 'none'
    }
  });
});

//this func takes the search result ang goes through it trying to put the names
function modifiedResult(lineageMembers) {
  return lineageMembers.map(result => {
    const modifiedResult = { ...result.toObject() };

    // console.log('mod res', modifiedResult);

    if (result.father) {
      modifiedResult.father = `${result.father.firstName} ${result.father.lastName}`;
    } else {
      modifiedResult.father = '';
    }

    if (result.mother) {
      modifiedResult.mother = `${result.mother.firstName}`;
    } else {
      modifiedResult.mother = '';
    }

    if (result.husband.length) {
      modifiedResult.husband = `${result.husband[0].firstName}`;
    } else {
      modifiedResult.husband = '';
    }
    if (result.wife.length) {
      modifiedResult.wife = `${result.wife[0].firstName}`;
    } else {
      modifiedResult.wife = '';
    }

    return modifiedResult;
  });
}

exports.getMembers = catchAsync(async (req, res, next) => {
  const actualUserData = await UserData.findOne({ userId: req.user.id });
  const lineage = actualUserData.lineage;

  const lineageMembers = await UserData.find({
    lineage: { $in: lineage }
  })
    .select('firstName lastName father mother husband wife lineage status')
    .populate({
      path: 'father',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'mother',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'wife',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'husband',
      select: 'firstName lastName _id'
    });

  const modifiedResults = modifiedResult(lineageMembers);

  res.status(200).json({
    status: 'success',
    data: {
      data: modifiedResults
    }
  });
});

exports.findPeople = catchAsync(async (req, res, next) => {
  const searchText = req.query.lastName;
  const user = req.user;
  const userData = await UserData.find({ userId: user._id });

  console.log('findPeople', userData);
  const lineage = userData[0].lineage[0];

  console.log(searchText, lineage, userData);

  const results = await UserData.find({
    $or: [
      { firstName: { $regex: searchText, $options: 'i' } },
      { lastName: { $regex: searchText, $options: 'i' } }
    ],
    lineage: { $ne: lineage }
  })
    .select('firstName lastName father mother husband wife')
    .populate({
      path: 'father',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'mother',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'wife',
      select: 'firstName lastName _id'
    })
    .populate({
      path: 'husband',
      select: 'firstName lastName _id'
    })
    .exec();

  const modifiedResults = modifiedResult(results);

  res.status(200).json({
    status: 'success',
    data: {
      data: modifiedResults
    }
  });
});

exports.merge = catchAsync(async (req, res, next) => {
  // copy the contents of the userData
  // save the contents into the nodeTo
  // dislodge the linkages of the userData
  // replace instances of the userData id with the id of the nodeTo
  // dislodge the linkages of the nodeTo
  // attach the linkages of the nodeTo using the append mode
  // you can then manually buikd relationships between
  // change status to merged

  // 1. copy the contents of userData, the contents in the resources doc
  const codeDetails = req.codeDetails;
  const session = req.session;
  const focusNodeId = codeDetails.userData.id; // focusNode
  const incomingId = codeDetails.nodeTo.id; // incomingNode, nodeTo
  const appendAs = codeDetails.mode;
  const options = { session: session };

  //1. Starting with appendAs
  // dislodge the linkages of the userData
  // remove sibling, father, mother, wife, husband

  await UserData.findByIdAndUpdate(
    incomingId,
    {
      $unset: {
        child: 1,
        sibling: 1,
        father: 1,
        mother: 1,
        wife: 1,
        husband: 1
      }
    },
    { new: true, session }
  );

  // remove all the relationship from the incoming ID bu searching the data and removing
  // the incoming ID from the data
  // to remove father and mother
  await UserData.updateMany(
    {
      $or: [{ father: incomingId }, { mother: incomingId }]
    },
    [
      {
        $set: {
          father: {
            $cond: {
              if: { $eq: ['$father', incomingId] },
              then: null,
              else: '$father'
            }
          },
          mother: {
            $cond: {
              if: { $eq: ['$mother', incomingId] },
              then: null,
              else: '$mother'
            }
          }
        }
      }
    ],
    { new: true, session }
  );
  // to remove other arrays
  await UserData.updateMany(
    {
      $or: [
        { sibling: incomingId },
        { wife: incomingId },
        { husband: incomingId },
        { child: incomingId }
      ]
    },
    {
      $pull: {
        sibling: incomingId,
        wife: incomingId,
        husband: incomingId,
        child: incomingId
      }
    },
    { new: true, session }
  );
  // Now append this user to the nodeTo using the append as

  const focusNodeUser = await UserData.findById(focusNodeId).session(session);
  const incomingNodeUser = await UserData.findById(incomingId).session(session);
  if (appendAs !== 'replace') {
    await linkOne(focusNodeId, appendAs, incomingId, options);

    const focusLineage = focusNodeUser.lineage;

    // again read the incoming since the link one modified the uncoming using the save
    // alternatively, i can return it from the linkOne
    const incomingNodeUser = await UserData.findById(incomingId).session(
      session
    );
    incomingNodeUser.lineage = [
      ...new Set([...incomingNodeUser.lineage, ...focusLineage])
    ];
    await incomingNodeUser.save(options);

    // now, build all i.e link all
    // linkAll(incomingNodeUser, appendAs);
  } else {
    // copy the relationship of focusNode or userData into variables or object
    console.log('in Here');
    const {
      child,
      father,
      mother,
      sibling,
      wife,
      husband,
      lineage
    } = focusNodeUser;
    // set the status of focusNode to archived and/or remove the relationship from it
    focusNodeUser.status = 'archived';
    await UserData.findByIdAndUpdate(
      focusNodeId,
      {
        $unset: {
          child: 1,
          sibling: 1,
          father: 1,
          mother: 1,
          wife: 1,
          husband: 1
        }
      },
      { new: true, session }
    );
    focusNodeUser.save(session);
    // if a node is archived, it can be seen by the admin as archived and
    // can be reinstated by the admin
    // replace all instances of the focusNode id with the incomingNode id in the doc
    await UserData.updateMany(
      {
        $or: [
          { sibling: focusNodeId },
          { father: focusNodeId },
          { mother: focusNodeId },
          { wife: focusNodeId },
          { husband: focusNodeId },
          { child: focusNodeId }
        ]
      },
      {
        $push: {
          sibling: incomingId,
          wife: incomingId,
          husband: incomingId,
          child: incomingId
        },
        $set: {
          father: incomingId,
          mother: incomingId
        }
      },
      { new: true, session }
    );
    // so that all the documents point to the new arrival
    // now set the relationship of the new arrival with the relationship earlier copied
    incomingNodeUser.father = father;
    incomingNodeUser.mother = mother;
    incomingNodeUser.child = child;
    incomingNodeUser.wife = wife;
    incomingNodeUser.husband = husband;
    incomingNodeUser.sibling = sibling;
    incomingNodeUser.lineage = [...incomingNodeUser.lineage, ...lineage];
    incomingNodeUser.joinCode = codeDetails.code;

    // save the incoming node
    await incomingNodeUser.save(session);
  }

  // Commit the transaction if everything is successful
  await session.commitTransaction();

  res.status(200).json({
    status: 'success',
    data: {
      data: incomingNodeUser
    }
  });
});

// this is a function that when given focusNode and incoming node and the
// appendAs or replace, will perform the append operation
async function linkOne(focusNodeId, appendAs, incomingNodeId, options) {
  // if we are appending while creating a new user
  console.log('herea', focusNodeId, appendAs, incomingNodeId);
  const incomingNode = await UserData.findById(incomingNodeId).session(
    options.session
  );
  const focusNode = await UserData.findById(focusNodeId).session(
    options.session
  );

  if (appendAs !== 'replace') {
    if (appendAs === 'father') {
      incomingNode.child = [focusNodeId]; //...appendToUser.sibling
    } else if (appendAs === 'mother') {
      incomingNode.child = [focusNodeId];
    } else if (appendAs === 'sibling') {
      incomingNode.sibling = [focusNodeId, ...focusNode.sibling];
    } else if (appendAs === 'child') {
      if (focusNode.gender === 'Male') incomingNode.father = focusNodeId;
      else incomingNode.mother = focusNodeId;
    } else if (appendAs === 'wife') {
      incomingNode.husband = [focusNodeId];
    } else if (appendAs === 'husband') {
      incomingNode.wife = [focusNodeId];
    }
    // save this appended node
    await incomingNode.save(options);
    // if you are appending, set up the relationship
    let relationship;
    if (appendAs === 'father') {
      relationship = await UserData.findByIdAndUpdate(
        focusNodeId,
        {
          father: incomingNodeId
        },
        options
      );
    } else if (appendAs === 'mother') {
      relationship = await UserData.findByIdAndUpdate(
        focusNodeId,
        {
          mother: incomingNodeId
        },
        options
      );
    } else {
      const update = {};
      update[`$push`] = {};
      update[`$push`][appendAs] = incomingNodeId;
      relationship = await UserData.findByIdAndUpdate(focusNodeId, update, {
        new: true,
        session: options.session
      });
    }
  }
}

// if you are the admin of the node
//    if it was created by you  and has no other lineage then delete it
//    if it wasnt created by you then remove it

exports.changeMemberStatus = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const lineageToRemove = req.params.lineage;
  const action = req.params.action;
  const adminOf = req.user.adminOf;
  const userId = req.user.id;
  const session = req.session;
  let todo = 'nothing';
  await session.startTransaction();

  // check whether user is an admin of the id
  // get the user with the ID
  let lineageMember = await UserData.findById(id).session(session);
  const memberLineage = lineageMember.lineage;
  console.log('lineage memeer', lineageMember);
  const intersect = memberLineage.filter(item => adminOf.includes(item));
  console.log(
    'intersect ',
    intersect,
    lineageMember.createdBy?.equals(req.user.userDataId),
    memberLineage.length === 1,
    !lineageMember.userId
  );
  if (intersect.length) {
    // the user is an admin of what he wants to remove
    // check if it was created by me
    if (action === 'remove') {
      if (
        lineageMember.createdBy?.equals(req.user.userDataId) &&
        memberLineage.length === 1 &&
        !lineageMember.userId
      ) {
        todo = 'archive';
        // it was created by the user and has only one lineage
        // archive it and everywhere it id shows up up in userData and  resource
        // send the node and resources to archive
        await UserData.findByIdAndUpdate(
          id,
          {
            $unset: {
              child: 1,
              sibling: 1,
              father: 1,
              mother: 1,
              wife: 1,
              husband: 1
            },
            status: 'archived'
          },
          { new: true, session }
        );
        // remove the father and mother
        await UserData.updateMany(
          {
            $or: [{ father: id }, { mother: id }]
          },
          [
            {
              $set: {
                father: {
                  $cond: {
                    if: { $eq: ['$father', id] },
                    then: null,
                    else: '$father'
                  }
                },
                mother: {
                  $cond: {
                    if: { $eq: ['$mother', id] },
                    then: null,
                    else: '$mother'
                  }
                }
              }
            }
          ],
          { new: true, session }
        );
        // remove other arrays
        await UserData.updateMany(
          {
            $or: [{ sibling: id }, { wife: id }, { husband: id }, { child: id }]
          },

          {
            $pull: {
              sibling: id,
              wife: id,
              husband: id,
              child: id
            }
          },
          { new: true, session }
        );

        await Resource.findOneAndUpdate({
          user: id,
          status: 'archived'
        }).session(session);
        // remove the relationship to the node from userdata
      } else if (memberLineage.length > 1) {
        todo = 'remove';
        lineageMember.lineage = memberLineage.filter(
          lineage => lineage !== +lineageToRemove
        );
        await lineageMember.save(session);

        // also remove the lineage connections if you remove a node
        const usersWithLineage = await UserData.find(
          { lineage: { $in: memberLineage } },
          { _id: 1 }
        );
        const objectIds = usersWithLineage.map(user => user._id);
        console.log(0);
        // remove the linkage of the user to the lineage you are m=removing from
        await UserData.findByIdAndUpdate(
          id,
          {
            $pull: {
              child: { $in: objectIds },
              sibling: { $in: objectIds },
              husband: { $in: objectIds },
              wife: { $in: objectIds }
            },
            $unset: {
              father: { $in: objectIds },
              mother: { $in: objectIds }
            }
          },
          { new: true, session }
        );
        console.log(1);
        // in the lineage, remove all reference to id
        // remove the father and mother
        await UserData.updateMany(
          {
            $or: [
              { father: id, lineage: lineageToRemove },
              { mother: id, lineage: lineageToRemove }
            ]
          },
          [
            {
              $set: {
                father: {
                  $cond: {
                    if: { $eq: ['$father', id] },
                    then: null,
                    else: '$father'
                  }
                },
                mother: {
                  $cond: {
                    if: { $eq: ['$mother', id] },
                    then: null,
                    else: '$mother'
                  }
                }
              }
            }
          ],
          { new: true, session }
        );
        console.log(2);
        // remove other arrays
        await UserData.updateMany(
          {
            $or: [
              { sibling: id, lineage: lineageToRemove },
              { wife: id, lineage: lineageToRemove },
              { husband: id, lineage: lineageToRemove },
              { child: id, lineage: lineageToRemove }
            ]
          },

          {
            $pull: {
              sibling: id,
              wife: id,
              husband: id,
              child: id
            }
          },
          { new: true, session }
        );
        console.log(3);
      }
    } else if (
      action === 'reinstate' &&
      lineageMember.createdBy.equals(req.user.userDataId) &&
      memberLineage.length === 1 &&
      !lineageMember.userId
    ) {
      todo = 'reinstate';
      await UserData.findByIdAndUpdate(
        id,
        {
          status: 'active'
        },
        { new: true, session }
      );
      await Resource.findOneAndUpdate({
        user: id,
        status: 'active'
      }).session(session);
    }

    await session.commitTransaction();
  }

  // if i created the node and i am an admin of all the lineage it belongs to then i can delete it
  //
  res.status(200).json({
    status: 'success',
    data: {
      data: `${todo}`
    }
  });
});

exports.checkAdmin = catchAsync(async (req, res, next) => {
  const userDataId = req.user.userDataId;
  const lineage = req.user.lineage;
  const createdBy = req.user.createdBy;
  const adminOf = req.user.adminOf;

  const incomingUserId = req.params.id;

  // user can be an admin of a node if
  // 1. the userId is in the node's adminableBy
  // 2. the user is an admin of the lineage where the incoming user is a member of
  // 3. the node has a createdBy which is equal to the user but has no userID

  const iAdminOfOneOfUserLineage = false;
  const createdByMe = false;
  const inOnlyMyLineage = false;
  const notOwnedByAnotherUser = false;
  const adminableByHasMe = false;

  // check whether user is an admin of the lineage where the incoming user is a member of
  let lineageMember = await UserData.findById(incomingUserId);
  const memberLineage = lineageMember.lineage;
  const intersect = memberLineage.filter(item => adminOf.includes(item));

  if (intersect.length) iAdminOfOneOfUserLineage = true;
  if (lineageMember.createdBy?.equals(userDataId)) createdByMe = true;
  if (intersect.length === 1) inOnlyMyLineage = true;
  if (!lineageMember.userId) notOwnedByAnotherUser = true;
  if (lineageMember.adminableBy.includes(userDataId)) adminableByHasMe = true;
});
function isAdmin() {
  return true;
}

async function deleteOneUser(id, options) {
  await UserData.findByIdAndDelete(id).session(options.session);
  await Resource.deleteMany({ userId: id }).session(options.session);
}

exports.linkNode = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const session = req.session;

  await session.startTransaction();

  const user = await UserData.findOne(id).session(session); // just added await
  await linkAll(user, relationship, session);

  await session.commitTransaction();

  res.status(200).json({
    status: 'success',
    data: {
      data: `member status updated: ${action}`
    }
  });
});

exports.birthdays = catchAsync(async (req, res, next) => {
  const lineage = req.user.lineage;

  const users = await UserData.find({ lineage: { $in: lineage } })
    .populate({
      path: 'setting'
    })
    .select('firstName lastName dateOfBirth setting');

  const filteredUsers = users.filter(
    user => user?.setting?.dateOfBirth !== 'self'
  );

  const finalUsers = filteredUsers.map(user => {
    const { setting, ...userWithoutSetting } = user.toObject();
    return userWithoutSetting;
  });

  res.status(200).json({
    status: 'success',
    data: {
      data: finalUsers
    }
  });
});
