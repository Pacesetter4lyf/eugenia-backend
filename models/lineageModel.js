const mongoose = require('mongoose');

const lineageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A lineage must have a creator']
    },
    members: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
          required: true
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
lineageSchema.virtual('membersCount').get(function() {
  return this.members.length;
});

const Lineage = mongoose.model('Lineage', lineageSchema);

module.exports = Lineage; 