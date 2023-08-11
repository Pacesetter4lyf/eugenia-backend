const Setting = require('../models/settingModel');
const UserData = require('../models/userDataModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const { ObjectId } = require('mongodb');

// exports.createJoinCode = catchAsync(async (req, res, next) => {});

exports.getSchema = catchAsync(async (req, res, next) => {
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

  res.status(201).json({
    status: 'success',
    data: {
      data: updatedSetting || newSetting
    }
  });
});

exports.updateUserSetting = catchAsync(async (req, res, next) => {
  const userId = req.params.id;

  const setting = await Setting.findOneAndUpdate(
    { userData: userId },
    req.body,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const status = setting ? 'success' : 'fail';

  res.status(201).json({
    status: status,
    data: {
      data: setting
    }
  });
}); 
