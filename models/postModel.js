// resource / rating / createdAt / ref to tour / ref to user
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'title cannot be empty!']
    },
    description: String,
    isNotVisibleByLineage: {
      type: Boolean,
      default: false
    },
    isCommentsTurnedOff: {
      type: Boolean
    },
    postBox: {
      type: String
    },
    isFileUploaded: {
      type: Boolean
    },
    uploadedFileType: {
      type: String
    },
    fileUrl: {
      type: String,
      default: ''
    },
    poster: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    datePosted: {
      type: Date,
      default: Date.now()
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    dateEdited: {
      type: Date,
      default: Date.now()
    },
    isForPerson: {
      type: Boolean,
      defailt: false
    },
    personId: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    forLineage: {
      type: [Number]
    },
    isLineageResource: {
      type: Boolean
    },
    likes: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData',
      default: []
    },
    comments: {
      type: [
        {
          userId: {
            type: mongoose.Schema.ObjectId,
            ref: 'UserData'
          },
          date: {
            type: Date,
            default: Date.now()
          },
          comment: {
            type: String
          },
          likes: {
            type: [mongoose.Schema.ObjectId],
            ref: 'UserData'
          }
        }
      ]
    },
    status: {
      type: String
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

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
