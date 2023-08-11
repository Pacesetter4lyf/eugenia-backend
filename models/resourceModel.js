// resource / rating / createdAt / ref to tour / ref to user
const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
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
      type: String
    },
    resourceType: String,
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    for: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    viewableBy: {
      type: String,
      default: 'self'
    }
  },
  {
    session: true,
    toJSON: { virtuals: true },
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

const Resource = mongoose.model('Resource', resourceSchema);

module.exports = Resource;
