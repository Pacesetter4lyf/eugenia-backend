const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    groupName: {
      type: String,
      required: [true, 'A group must have a name'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A group must have a creator']
    },
    members: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
          required: true
        },
        isAdmin: {
          type: Boolean,
          default: false
        },
        joinedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field for members count
groupSchema.virtual('membersCount').get(function() {
  return this.members.length;
});

// Virtual field for admins count
groupSchema.virtual('adminsCount').get(function() {
  return this.members.filter(member => member.isAdmin).length;
});

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;
