const mongoose = require('mongoose');
// Define the visibility levels
const VISIBILITY_LEVELS = [1, 2, 3, 4];

const profileSchema = new mongoose.Schema(
  {
    firstName: {
      type: 'string',
      required: [true, 'Please tell us your name ok!']
    },
    lastName: {
      type: 'string',
      required: [true, 'Please tell us your last name']
    },
    bio: {
      type: 'string'
    },
    photo: {
      type: String,
      default: 'https://ucarecdn.com/f44a4885-293e-4518-be59-1e8b3c84881b/'
    },
    gender: {
      type: 'string',
      enum: ['Male', 'Female'],
      required: [true, 'please specify the gender as Male or Female']
    },
    dateOfBirth: {
      type: 'Date',
      default: new Date()
    },
    phoneNumber: {
      type: 'string'
    },
    address: {
      type: 'string',
      default: ''
    },
    primarySchool: {
      type: 'string'
    },
    secondarySchool: {
      type: 'string'
    },
    tertiarySchool: {
      type: 'string'
    },

    facebook: {
      type: 'string',
      default: ''
    },
    twitter: {
      type: 'string',
      default: ''
    },
    linkedin: {
      type: 'string',
      default: ''
    },

    userId: {
      type: 'string'
    },
    status: {
      type: 'string',
      default: 'active'
    },

    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    // editableBy: {
    //     type: [mongoose.Schema.ObjectId],
    //     ref: 'User'
    // },
    // adminOf: {
    //     type: [Number]
    // },
    // joinCode: {
    //     type: [Number]
    // },
    // father: {
    //     type: mongoose.Schema.ObjectId,
    //     ref: 'UserData'
    // },
    // mother: {
    //     type: mongoose.Schema.ObjectId,
    //     ref: 'UserData'
    // },
    // wife: {
    //     type: [mongoose.Schema.ObjectId],
    //     ref: 'UserData'
    // },
    // husband: {
    //     type: [mongoose.Schema.ObjectId],
    //     ref: 'UserData'
    // },

    // child: {
    //     type: [mongoose.Schema.ObjectId],
    //     ref: 'UserData'
    // },
    // sibling: {
    //     type: [mongoose.Schema.ObjectId],
    //     ref: 'UserData'
    // },
    // lineage: {
    //     type: [Number],
    //     default: function () {
    //         return [Math.floor(100000 + Math.random() * 900000)];
    //     }
    // },
    visibility: {
      firstName: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      lastName: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      bio: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      photo: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      gender: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      dateOfBirth: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      phoneNumber: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      address: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      primarySchool: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      secondarySchool: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      tertiarySchool: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      facebook: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      twitter: { type: Number, enum: VISIBILITY_LEVELS, default: 1 },
      linkedin: { type: Number, enum: VISIBILITY_LEVELS, default: 1 }
    }
  },
  {
    session: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual populate
profileSchema.virtual('resource', {
  ref: 'Resource',
  localField: '_id',
  foreignField: 'user'
});

profileSchema.pre('findByIdAndUpdate', function(next) {
  const queryUserId = this.getUpdate().userId; // get the userId value from the update object
  // const userId = this._conditions.userId; // get the _id value of the document being updated
  const { createdBy } = this._conditions;

  if (createdBy && !createdBy.equals(queryUserId)) {
    const error = new Error('You can only update documents that you created.');
    error.status = 403;
    return next(error); // return an error if the createdBy field is being updated to a different value than the _id of the document
  }
  // now remove the user id from the object
  delete this.getUpdate().queryUserId;
  next();
});

const profile = mongoose.model('Profile', profileSchema);

module.exports = profile;
