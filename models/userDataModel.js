const mongoose = require('mongoose');

const userDataSchema = new mongoose.Schema(
  {
    firstName: {
      type: 'string',
      required: [true, 'Please tell us your name ok!']
    },
    lastName: {
      type: 'string',
      required: [true, 'Please tell us your last name']
    },
    userId: {
      type: 'string'
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    editableBy: {
      type: [mongoose.Schema.ObjectId],
      ref: 'User'
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
    facebook: {
      type: 'string',
      default: ''
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
    bibliography: {
      type: 'string'
    },
    status: {
      type: 'string'
    },
    photo: {
      type: String,
      default: 'https://ucarecdn.com/f44a4885-293e-4518-be59-1e8b3c84881b/'
    },
    adminOf: {
      type: [Number]
    },
    joinCode: {
      type: [Number]
    },
    father: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    mother: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    wife: {
      type: [mongoose.Schema.ObjectId],
      ref: 'UserData'
    },
    husband: {
      type: [mongoose.Schema.ObjectId],
      ref: 'UserData'
    },

    child: {
      type: [mongoose.Schema.ObjectId],
      ref: 'UserData'
    },
    sibling: {
      type: [mongoose.Schema.ObjectId],
      ref: 'UserData'
    },
    lineage: {
      type: [Number],
      default: function() {
        return [Math.floor(100000 + Math.random() * 900000)];
      }
    },
    setting: {
      type: mongoose.Schema.ObjectId,
      ref: 'Setting'
    }
  },
  {
    session: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual populate
userDataSchema.virtual('resource', {
  ref: 'Resource',
  localField: '_id',
  foreignField: 'user'
});

// userDataSchema.pre('save', function(next) {
//   console.log('before saving ', this);
//   next();
// });
// userDataSchema.post('save', function(doc, next) {
//   console.log('after saving', this, doc);
//   next()
// });
// Pre-save middleware
userDataSchema.pre('save', function(next) {
  // Check if adminOf field is not set or empty
  if (!this.adminOf) {
    // Set the value of adminOf to the same as lineage
    this.adminOf = this.lineage;
  }
  next();
});

userDataSchema.pre('findByIdAndUpdate', function(next) {
  console.log('i am here ');
  const queryUserId = this.getUpdate().userId; // get the userId value from the update object
  // const userId = this._conditions.userId; // get the _id value of the document being updated
  const createdBy = this._conditions.createdBy;

  if (createdBy && !createdBy.equals(queryUserId)) {
    const error = new Error('You can only update documents that you created.');
    error.status = 403;
    return next(error); // return an error if the createdBy field is being updated to a different value than the _id of the document
  }
  // now remove the user id from the object
  delete this.getUpdate().queryUserId;
  next();
});

// userDataSchema.post(/^find/, function(result, next) {
//   if (result == null) {
//     return next(new Error('Can\'t find object'));
//   }
//   next();
// });

// userDataSchema.pre(/^find/, function(next) {
//   // this points to the current query
//   this.find({ active: { $ne: false } });
//   next();
// });

const UserData = mongoose.model('UserData', userDataSchema);

module.exports = UserData;
