// resource / rating / createdAt / ref to tour / ref to user
const mongoose = require('mongoose');
const UserData = require('../models/userDataModel');

const joinCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true],
      default: function() {
        return Math.floor(100000 + Math.random() * 900000).toString();
      }
    },
    mode: {
      type: String,
      required: [true]
    },
    lineage: {
      type: [String],
      required: [true]
    },
    userData: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    nodeTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    generatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    status: {
      type: String,
      default: 'created'
    }
  },
  {
    session: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

joinCodeSchema.pre(/^find/, function(next) {
  console.log(this.toJSON);
  this.populate({
    path: 'userData',
    select: 'firstName lastName mother father',
    populate: [
      {
        path: 'mother',
        select: 'firstName'
      },
      {
        path: 'father',
        select: 'firstName lastName'
      }
    ]
  }).populate({
    path: 'nodeTo',
    select: 'firstName lastName mother father lineage',
    populate: [
      {
        path: 'mother',
        select: 'firstName'
      },
      {
        path: 'father',
        select: 'firstName lastName'
      }
    ]
  });

  next();
});

// Pre-save hook for JoinCode
joinCodeSchema.pre('save', async function(next) {
  try {
    // Get the value of the field to be used for lookup (userData)
    const fieldValueToLookup = this.userData;

    // Perform the lookup in UserData based on the field value from JoinCode
    const lookupResult = await UserData.findOne({ id: fieldValueToLookup });

    if (lookupResult) {
      // Append the looked-up field (lineage) to the current JoinCode document
      this.lineage = lookupResult.lineage;
    }

    // Continue with the save operation
    next();
  } catch (err) {
    // Handle errors, if any
    next(err);
  }
});

const JoinCode = mongoose.model('JoinCode', joinCodeSchema);

module.exports = JoinCode;
