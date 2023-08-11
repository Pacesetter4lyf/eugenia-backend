const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    to: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserData'
    },
    message: {
      type: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    editedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
