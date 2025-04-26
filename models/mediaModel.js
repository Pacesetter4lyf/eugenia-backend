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
      default: 'self'
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

const Media = mongoose.model('Media', mediaSchema);

module.exports = Media;
