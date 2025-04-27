const mongoose = require('mongoose');

const favouriteMemberSchema = new mongoose.Schema({
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

const suggestedMemberSchema = new mongoose.Schema({
  profileId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Profile',
    required: [true, 'Profile ID is required']
  },
  suggestedAt: {
    type: Date,
    default: Date.now
  }
});

const favouriteSchema = new mongoose.Schema({
  profileId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Profile',
    required: [true, 'Profile ID is required'],
    unique: true,
    index: true
  },
  favourites: [favouriteMemberSchema],
  suggestions: [suggestedMemberSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate favourites
favouriteSchema.pre('save', function(next) {
  const seen = new Set();
  this.favourites = this.favourites.filter(member => {
    const duplicate = seen.has(member.profileId.toString());
    seen.add(member.profileId.toString());
    return !duplicate;
  });
  next();
});

// Prevent duplicate suggestions
favouriteSchema.pre('save', function(next) {
  const seen = new Set();
  this.suggestions = this.suggestions.filter(member => {
    const duplicate = seen.has(member.profileId.toString());
    seen.add(member.profileId.toString());
    return !duplicate;
  });
  next();
});

const Favourite = mongoose.model('Favourite', favouriteSchema);

module.exports = Favourite; 