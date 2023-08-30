const Setting = require('../models/settingModel');
const UserData = require('../models/userDataModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const { ObjectId } = require('mongodb');

// exports.createJoinCode = catchAsync(async (req, res, next) => {});
async function getSetting(req) {
  const userId = req.params.id;
  const setting = await Setting.findOne({ userData: userId }).select(
    '-userData -__v -_id -id'
  );

  let updatedSetting;
  if (setting)
    updatedSetting = Object.entries(setting.toObject()).map(([key, value]) => ({
      [key]: value
    }));

  let newSetting;
  if (!setting) {
    const schemaDefinition = Setting.schema.obj;
    const keys = Object.keys(schemaDefinition).filter(
      key => key !== 'userData'
    );
    newSetting = keys.map(key => ({ [key]: 'self' }));
  }

  return updatedSetting || newSetting;
}

exports.getFilter2 = catchAsync(async req => {
  const userId = req.params.id;
  const setting = await Setting.findOne({ userData: userId }).select(
    '-userData -__v -_id -id'
  );

  let updatedSetting;
  if (setting)
    updatedSetting = Object.entries(setting.toObject()).map(([key, value]) => ({
      [key]: value
    }));

  let newSetting;
  if (!setting) {
    const schemaDefinition = Setting.schema.obj;
    const keys = Object.keys(schemaDefinition).filter(
      key => key !== 'userData'
    );
    newSetting = keys.map(key => ({ [key]: 'self' }));
  }

  return updatedSetting || newSetting;
});

async function getViewer(req) {
  const userDataId = req.user.userDataId;
  const lineage = req.user.lineage;
  const adminOf = req.user.adminOf;

  const incomingUserId = req.params.id || req.params.userDataId;

  // user can be an admin of a node if
  // 1. the userId is in the node's adminableBy
  // 2. the user is an admin of the lineage where the incoming user is a member of
  // 3. the node has a createdBy which is equal to the user but has no userID

  let isSelf = false;
  let iAdminOfOneOfUserLineage = false;
  let createdByMe = false;
  let inOnlyMyLineage = false;
  let inMyLineage = false;
  let notOwnedByAnotherUser = false;
  let adminableByHasMe = false;

  // check whether user is an admin of the lineage where the incoming user is a member of
  let lineageMember = await UserData.findById(incomingUserId);
  const memberLineage = lineageMember.lineage;
  const intersect = memberLineage.filter(item => adminOf.includes(item));
  const lineageIntersect = memberLineage.filter(item => lineage.includes(item));

  if (userDataId === incomingUserId) isSelf = true;
  if (intersect.length) iAdminOfOneOfUserLineage = true;
  if (lineageMember.createdBy?.equals(userDataId)) createdByMe = true;
  if (lineageIntersect.length === 1) inOnlyMyLineage = true;
  if (lineageIntersect.length) inMyLineage = true;
  if (!lineageMember.userId) notOwnedByAnotherUser = true;
  if (lineageMember?.adminableBy?.includes(userDataId)) adminableByHasMe = true;

  if (isSelf) return 'self';
  else if (createdByMe && notOwnedByAnotherUser) return 'user-viewing';
  else if (adminableByHasMe) return 'i-admin';
  else if (inMyLineage) return 'lineage';
  else return 'public';
}

module.exports = { getSetting, getViewer };
