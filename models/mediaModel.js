// resource / rating / createdAt / ref to tour / ref to user
const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name can not be empty!']
    },
    url: {
      type: String
    },
    status: {
      type: String
    },
    text: {
      type: String
    },
    description: {
      type: String,
      required: [true, 'you definitely need a description']
    },
    mediaType: {
      type: String,
      required: [true, 'you definitely need a type']
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'profile'
    },
    for: {
      type: mongoose.Schema.ObjectId,
      ref: 'profile'
    },
    viewableBy: {
      type: String,
      default: 'self'
    },
    hiddenTo: {
      type: String,
      default: 'public'
    }
  },
  {
    session: true,
    toJSON: {
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.__v; // Remove version key
        delete ret._id; // Remove _id
      }
    },
    toObject: { virtuals: true }
  }
);

// resourceSchema.pre(/^find/, function(next) {
//   console.log(this.toJSON);
//   this.populate({
//     path: 'user',
//     select: 'firstName lastName '
//   });

//   next();
// });

// Pre-save middleware to prevent unauthorized updates
mediaSchema.pre('save', function(next) {
  // Skip check for new documents
  if (this.isNew) return next();

  // Check if user is being modified
  if (this.isModified('user')) {
    const error = new Error('Cannot modify the owner of media');
    error.status = 403;
    return next(error);
  }

  next();
});

// Pre-findOneAndUpdate middleware to prevent unauthorized updates
mediaSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Check if user is being modified
  if (update && update.$set && update.$set.user) {
    const error = new Error('Cannot modify the owner of media');
    error.status = 403;
    return next(error);
  }

  next();
});

const Media = mongoose.model('Media', mediaSchema);

module.exports = Media;
