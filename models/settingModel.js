const mongoose = require('mongoose');
const viewable = ['self', 'lineage', 'public'];

const settingSchema = new mongoose.Schema(
  {
    userData: {
      type: 'string',
      required: [true]
    },
    dateOfBirth: {
      type: String,
      enum: viewable,
      default: 'self'
    },
    phoneNumber: {
      type: String,
      enum: viewable,
      default: 'self'
    },
    facebook: {
      type: String,
      enum: viewable,
      default: 'self'
    },
    address: {
      type: String,
      enum: viewable,
      default: 'self'
    },
    primarySchool: {
      type: String,
      enum: viewable,
      default: 'self'
    },
    secondarySchool: {
      type: String,
      enum: viewable,
      default: 'self'
    },
    tertiarySchool: {
      type: String,
      enum: viewable,
      default: 'self'
    },
    bibliography: {
      type: String,
      enum: viewable,
      default: 'self'
    },
    photo: {
      type: String,
      enum: viewable,
      default: 'self'
    }
  },
  {
    session: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual populate
// settingSchema.virtual('userData', {
//   ref: 'UserData',
//   localField: 'userData',
//   foreignField: '_id'
// });

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;
