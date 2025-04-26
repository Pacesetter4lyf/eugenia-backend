const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A post must have a title'],
      trim: true
    },
    content: {
      type: String,
      required: [true, 'A post must have content']
    },
    author: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A post must have an author']
    },
    forPerson: {
      type: mongoose.Schema.ObjectId,
      ref: 'Profile',
      required: [true, 'A post must be for someone']
    },
    isGroupPost: {
      type: Boolean,
      default: false
    },
    group: {
      type: mongoose.Schema.ObjectId,
      ref: 'Group'
    },
    comments: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
          required: true
        },
        content: {
          type: String,
          required: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    lastCommentDate: {
      type: Date,
      default: Date.now
    },
    commentsEnabled: {
      type: Boolean,
      default: true
    },
    isGroupResource: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field for comments count
postSchema.virtual('commentsCount').get(function() {
  return this.comments.length;
});

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
