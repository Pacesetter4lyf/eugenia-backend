const mongoose = require('mongoose');

const lineageMemberSchema = new mongoose.Schema({
  profileId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Profile',
    required: [true, 'Profile ID is required']
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const lineageSchema = new mongoose.Schema({
  profileId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Profile',
    required: [true, 'Profile ID is required'],
    unique: true,
    index: true
  },
  lineageMembers: [lineageMemberSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate members in lineage
lineageSchema.pre('save', function(next) {
  const seen = new Set();
  this.lineageMembers = this.lineageMembers.filter(member => {
    const duplicate = seen.has(member.profileId.toString());
    seen.add(member.profileId.toString());
    return !duplicate;
  });
  next();
});

const Lineage = mongoose.model('Lineage', lineageSchema);

module.exports = Lineage;
