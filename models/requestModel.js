const mongoose = require('mongoose');
const crypto = require('crypto');

// Helper function to generate join code
const generateJoinCode = () => {
  // Generate 8 character alphanumeric code
  return crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase();
};

const requestSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Profile',
      required: [true, 'A request must have a source profile']
    },
    targetId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Profile',
      required: [true, 'A request must have a target profile']
    },
    joinCode: {
      type: String,
      unique: true,
      default: generateJoinCode
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending'
    },
    code: {
      type: String,
      required: [true, 'A request must have a code identifying its type'],
      enum: [
        'relationship_request',
        'lineage_invitation',
        'group_invitation',
        'friend_request',
        'media_permission'
      ]
    },
    appendAs: {
      type: String,
      required: [
        function() {
          return this.code === 'relationship_request';
        },
        'Relationship type is required for relationship requests'
      ],
      enum: [
        'father',
        'mother',
        'son',
        'daughter',
        'brother',
        'sister',
        'husband',
        'wife'
      ]
    },
    message: {
      type: String,
      maxLength: [500, 'Message cannot be longer than 500 characters']
    },
    scenarios: [
      {
        type: String,
        enum: ['siblings', 'mother', 'father', 'parents', 'children']
      }
    ],
    expiresAt: {
      type: Date,
      default: function() {
        // Default expiry of 30 days from creation
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
requestSchema.index({ sourceId: 1, targetId: 1, code: 1 });
requestSchema.index({ status: 1 });
requestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion
requestSchema.index({ joinCode: 1 }, { unique: true }); // Index for join code lookups

// Middleware
requestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Generate new join code if not set
  if (!this.joinCode) {
    this.joinCode = generateJoinCode();
  }

  next();
});

// Static method to find request by join code
requestSchema.statics.findByJoinCode = function(joinCode) {
  return this.findOne({ joinCode }).populate('sourceId targetId');
};

// Instance methods
requestSchema.methods.accept = async function() {
  this.status = 'accepted';
  await this.save();
};

requestSchema.methods.reject = async function() {
  this.status = 'rejected';
  await this.save();
};

requestSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  await this.save();
};

// Static methods
requestSchema.statics.findPendingRequests = function(profileId) {
  return this.find({
    targetId: profileId,
    status: 'pending'
  }).populate('sourceId targetId');
};

requestSchema.statics.findActiveRequests = function(profileId) {
  return this.find({
    $or: [{ sourceId: profileId }, { targetId: profileId }],
    status: 'pending'
  }).populate('sourceId targetId');
};

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;
