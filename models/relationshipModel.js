const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema(
  {
    profileId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Profile',
      required: [true, 'A relationship must be associated with a profile']
    },
    parents: [
      {
        profile: {
          type: mongoose.Schema.ObjectId,
          ref: 'Profile',
          required: true
        },
        relationshipType: {
          type: String,
          enum: ['father', 'mother'],
          required: true
        },
        isBiological: {
          type: Boolean,
          default: true
        },
        addedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    siblings: [
      {
        profile: {
          type: mongoose.Schema.ObjectId,
          ref: 'Profile',
          required: true
        },
        relationshipType: {
          type: String,
          enum: ['brother', 'sister'],
          required: true
        },
        isBiological: {
          type: Boolean,
          default: true
        },
        addedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    spouses: [
      {
        profile: {
          type: mongoose.Schema.ObjectId,
          ref: 'Profile',
          required: true
        },
        relationshipType: {
          type: String,
          enum: ['husband', 'wife'],
          required: true
        },
        isCurrent: {
          type: Boolean,
          default: true
        },
        marriageDate: {
          type: Date
        },
        divorceDate: {
          type: Date
        },
        addedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    children: [
      {
        profile: {
          type: mongoose.Schema.ObjectId,
          ref: 'Profile',
          required: true
        },
        relationshipType: {
          type: String,
          enum: ['son', 'daughter'],
          required: true
        },
        isBiological: {
          type: Boolean,
          default: true
        },
        addedAt: {
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

// Virtual fields for different relationship counts
relationshipSchema.virtual('parentsCount').get(function() {
  return this.parents.length;
});

relationshipSchema.virtual('siblingsCount').get(function() {
  return this.siblings.length;
});

relationshipSchema.virtual('spousesCount').get(function() {
  return this.spouses.length;
});

relationshipSchema.virtual('childrenCount').get(function() {
  return this.children.length;
});

// Virtual field for current spouses
relationshipSchema.virtual('currentSpouses').get(function() {
  return this.spouses.filter(spouse => spouse.isCurrent);
});

// Virtual field for biological children
relationshipSchema.virtual('biologicalChildren').get(function() {
  return this.children.filter(child => child.isBiological);
});

const Relationship = mongoose.model('Relationship', relationshipSchema);

module.exports = Relationship;
