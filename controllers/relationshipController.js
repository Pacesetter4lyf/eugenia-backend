const Profile = require('../models/profileModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Relationship = require('../models/relationshipModel');
const Lineage = require('../models/lineageModel');
const { getRelatedProfiles, getReverseRelationshipType } = require('../utils/relationshipUtils');

/**
 * Middleware to validate relationship creation requests
 * Performs several checks before allowing relationship creation:
 * 1. Profile existence
 * 2. Self-relationship prevention
 * 3. Gender validation
 * 4. Relationship type validation
 * 5. Age validation for parent-child relationships
 * 6. Circular relationship prevention
 */
exports.validateRelationship = catchAsync(async (req, res, next) => {
  // Extract profile IDs and relationship type from request
  const { profileAId, profileBId } = req.body;
  const { relationshipType } = req.params;

  // Verify both profiles exist in the database
  const profileA = await Profile.findById(profileAId);
  const profileB = await Profile.findById(profileBId);

  if (!profileA || !profileB) {
    return next(new AppError('One or both profiles not found', 404));
  }

  // Prevent creating relationships with oneself
  if (profileAId === profileBId) {
    return next(new AppError('Cannot create relationship with self', 400));
  }

  // Define valid relationship types and their gender requirements
  const validRelationships = {
    father: ['Male'],
    mother: ['Female'],
    son: ['Male'],
    daughter: ['Female'],
    brother: ['Male'],
    sister: ['Female'],
    husband: ['Male'],
    wife: ['Female']
  };

  // Validate that the requested relationship type exists
  if (!validRelationships[relationshipType]) {
    return next(new AppError('Invalid relationship type', 400));
  }

  // Check if Profile A's gender matches the relationship requirements
  const requiredGender = validRelationships[relationshipType];
  if (!requiredGender.includes(profileA.gender)) {
    return next(
      new AppError(
        `Profile A must be ${
          profileA.gender === 'Male' ? 'male' : 'female'
        } for this relationship`,
        400
      )
    );
  }

  // Check if this relationship already exists
  if (
    profileA.relationships &&
    profileA.relationships.some(
      r => r.profileId.toString() === profileBId && r.type === relationshipType
    )
  ) {
    return next(new AppError('Relationship already exists', 400));
  }

  // Perform relationship-specific validations
  switch (relationshipType) {
    case 'father':
    case 'mother':
      // Ensure parent is older than child if dates of birth are available
      if (profileA.dateOfBirth && profileB.dateOfBirth) {
        if (profileA.dateOfBirth >= profileB.dateOfBirth) {
          return next(new AppError('Parent must be older than child', 400));
        }
      }
      break;

    case 'son':
    case 'daughter':
      // Ensure child is younger than parent if dates of birth are available
      if (profileA.dateOfBirth && profileB.dateOfBirth) {
        if (profileA.dateOfBirth <= profileB.dateOfBirth) {
          return next(new AppError('Child must be younger than parent', 400));
        }
      }
      break;

    // No additional validations needed for other relationship types
    default:
      break;
  }

  /**
   * Recursive function to detect circular relationships
   * Only checks for cycles in parent-child relationships to allow valid family structures
   * (e.g., siblings sharing parents)
   * @param {string} profileId - Current profile being checked
   * @param {string} targetId - Original target profile
   * @param {Set} visited - Set of already visited profiles to prevent infinite loops
   * @returns {boolean} - True if circular relationship is detected
   */
  const checkCircularRelationship = async (
    profileId,
    targetId,
    visited = new Set()
  ) => {
    if (visited.has(profileId)) return false;
    visited.add(profileId);

    const profile = await Profile.findById(profileId);
    if (!profile || !profile.relationships) return false;

    // Only check parent-child relationships for cycles
    const parentChildRelationships = profile.relationships.filter(
      rel => ['father', 'mother', 'son', 'daughter'].includes(rel.type)
    );

    // Check each parent-child relationship for circular references
    for (const rel of parentChildRelationships) {
      if (rel.profileId.toString() === targetId) return true;
      if (await checkCircularRelationship(rel.profileId, targetId, visited))
        return true;
    }
    return false;
  };

  // Check for circular relationships between the two profiles
  if (await checkCircularRelationship(profileAId, profileBId)) {
    return next(new AppError('Circular relationship detected', 400));
  }

  // Attach profiles to request for use in createRelationship
  req.profileA = profileA;
  req.profileB = profileB;
  next();
});

/**
 * Creates a reverse relationship based on the original relationship type
 * For example, if A is father of B, B becomes son/daughter of A
 * @param {Object} profileA - First profile in the relationship
 * @param {Object} profileB - Second profile in the relationship
 * @param {string} relationshipType - Type of the original relationship
 */
const createReverseRelationship = async (
  profileA,
  profileB,
  relationshipType
) => {
  // Map of relationship types to their reverse types
  const reverseRelationships = {
    father: 'child',
    mother: 'child',
    son: 'parent',
    daughter: 'parent',
    brother: 'sibling',
    sister: 'sibling',
    husband: 'spouse',
    wife: 'spouse'
  };

  const reverseType = reverseRelationships[relationshipType];
  if (!reverseType) return;

  // Determine the specific reverse relationship type based on gender
  let specificReverseType = reverseType;
  if (reverseType === 'child') {
    specificReverseType = profileB.gender === 'Male' ? 'son' : 'daughter';
  } else if (reverseType === 'parent') {
    specificReverseType = profileA.gender === 'Male' ? 'father' : 'mother';
  } else if (reverseType === 'sibling') {
    specificReverseType = profileB.gender === 'Male' ? 'brother' : 'sister';
  } else if (reverseType === 'spouse') {
    specificReverseType = profileB.gender === 'Male' ? 'husband' : 'wife';
  }

  // Add the reverse relationship to Profile B
  if (!profileB.relationships) profileB.relationships = [];
  profileB.relationships.push({
    profileId: profileA._id,
    type: specificReverseType,
    createdAt: Date.now()
  });

  await profileB.save();
};

const addToSuggestions = async (profileId) => {
  const relatedProfiles = await getRelatedProfiles(profileId);
  
  // Find all lineages where this profile is a member
  const lineages = await Lineage.find({
    'lineageMembers.profileId': profileId
  });

  for (const lineage of lineages) {
    // Add all related profiles to suggestions, excluding current members
    const currentMembers = lineage.lineageMembers.map(m => m.profileId.toString());
    const newSuggestions = relatedProfiles.filter(
      profile => !currentMembers.includes(profile.toString())
    );

    // Update suggestions without duplicates
    lineage.suggestions = [...new Set([...lineage.suggestions, ...newSuggestions])];
    await lineage.save();
  }
};

//people i created or who are in any of my groups
/**
 * Base function for creating relationships
 * Handles the actual creation of relationships and optional reverse relationships
 */
const createRelationship = catchAsync(async (req, res, next) => {
  const { profileAId, profileBId, createReverse = true } = req.body;
  const { relationshipType } = req.params;
  const { profileA } = req;

  // Get or create relationship document for profileA
  let relationshipA = await Relationship.findOne({ profileId: profileAId });
  if (!relationshipA) {
    relationshipA = await Relationship.create({ profileId: profileAId });
  }

  // Add the relationship based on type
  const relationshipData = {
    profile: profileBId,
    relationshipType,
    addedAt: Date.now()
  };

  switch (relationshipType) {
    case 'father':
    case 'mother':
      relationshipA.parents.push(relationshipData);
      break;
    case 'brother':
    case 'sister':
      relationshipA.siblings.push(relationshipData);
      break;
    case 'husband':
    case 'wife':
      relationshipData.isCurrent = true;
      relationshipA.spouses.push(relationshipData);
      break;
    case 'son':
    case 'daughter':
      relationshipA.children.push(relationshipData);
      break;
  }

  await relationshipA.save();

  // Create reverse relationship if requested
  if (createReverse) {
    let relationshipB = await Relationship.findOne({ profileId: profileBId });
    if (!relationshipB) {
      relationshipB = await Relationship.create({ profileId: profileBId });
    }

    const reverseType = getReverseRelationshipType(relationshipType, profileA.gender);
    const reverseData = {
      profile: profileAId,
      relationshipType: reverseType,
      addedAt: Date.now()
    };

    switch (reverseType) {
      case 'father':
      case 'mother':
        relationshipB.parents.push(reverseData);
        break;
      case 'brother':
      case 'sister':
        relationshipB.siblings.push(reverseData);
        break;
      case 'husband':
      case 'wife':
        reverseData.isCurrent = true;
        relationshipB.spouses.push(reverseData);
        break;
      case 'son':
      case 'daughter':
        relationshipB.children.push(reverseData);
        break;
    }

    await relationshipB.save();
  }

  // Add both profiles to suggestions of their respective lineages
  await addToSuggestions(profileAId);
  await addToSuggestions(profileBId);

  res.status(201).json({
    status: 'success',
    data: {
      relationship: {
        from: profileAId,
        to: profileBId,
        type: relationshipType
      }
    }
  });
});

// Individual relationship endpoint handlers
// Each handler sets the relationship type and calls the base createRelationship function

exports.fatherOf = (req, res, next) => {
  req.params.relationshipType = 'father';
  return createRelationship(req, res, next);
};

exports.motherOf = (req, res, next) => {
  req.params.relationshipType = 'mother';
  return createRelationship(req, res, next);
};

exports.sonOf = (req, res, next) => {
  req.params.relationshipType = 'son';
  return createRelationship(req, res, next);
};

exports.daughterOf = (req, res, next) => {
  req.params.relationshipType = 'daughter';
  return createRelationship(req, res, next);
};

exports.brotherOf = (req, res, next) => {
  req.params.relationshipType = 'brother';
  return createRelationship(req, res, next);
};

exports.sisterOf = (req, res, next) => {
  req.params.relationshipType = 'sister';
  return createRelationship(req, res, next);
};

exports.husbandOf = (req, res, next) => {
  req.params.relationshipType = 'husband';
  return createRelationship(req, res, next);
};

exports.wifeOf = (req, res, next) => {
  req.params.relationshipType = 'wife';
  return createRelationship(req, res, next);
};

exports.getTree = catchAsync(async (req, res, next) => {
  // Get profileId from either params or body
  const profileId = req.params.profileId || req.body.profileId;
  
  if (!profileId) {
    return next(new AppError('Profile ID is required', 400));
  }

  // Get the relationship document
  const relationship = await Relationship.findOne({ profileId })
    .populate({
      path: 'parents.profile',
      select: 'firstName lastName bio photo gender dateOfBirth'
    })
    .populate({
      path: 'siblings.profile',
      select: 'firstName lastName bio photo gender dateOfBirth'
    })
    .populate({
      path: 'spouses.profile',
      select: 'firstName lastName bio photo gender dateOfBirth'
    })
    .populate({
      path: 'children.profile',
      select: 'firstName lastName bio photo gender dateOfBirth'
    });

  if (!relationship) {
    return next(new AppError('No relationships found for this profile', 404));
  }

  // Get the profile details
  const profile = await Profile.findById(profileId)
    .select('firstName lastName bio photo gender dateOfBirth');

  if (!profile) {
    return next(new AppError('Profile not found', 404));
  }

  // Format the response
  const tree = {
    profile: {
      id: profile._id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      bio: profile.bio,
      photo: profile.photo,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth
    },
    parents: relationship.parents.map(parent => ({
      id: parent.profile._id,
      firstName: parent.profile.firstName,
      lastName: parent.profile.lastName,
      bio: parent.profile.bio,
      photo: parent.profile.photo,
      gender: parent.profile.gender,
      dateOfBirth: parent.profile.dateOfBirth,
      relationshipType: parent.relationshipType,
      isBiological: parent.isBiological
    })),
    siblings: relationship.siblings.map(sibling => ({
      id: sibling.profile._id,
      firstName: sibling.profile.firstName,
      lastName: sibling.profile.lastName,
      bio: sibling.profile.bio,
      photo: sibling.profile.photo,
      gender: sibling.profile.gender,
      dateOfBirth: sibling.profile.dateOfBirth,
      relationshipType: sibling.relationshipType,
      isBiological: sibling.isBiological
    })),
    spouses: relationship.spouses.map(spouse => ({
      id: spouse.profile._id,
      firstName: spouse.profile.firstName,
      lastName: spouse.profile.lastName,
      bio: spouse.profile.bio,
      photo: spouse.profile.photo,
      gender: spouse.profile.gender,
      dateOfBirth: spouse.profile.dateOfBirth,
      relationshipType: spouse.relationshipType,
      isCurrent: spouse.isCurrent,
      marriageDate: spouse.marriageDate,
      divorceDate: spouse.divorceDate
    })),
    children: relationship.children.map(child => ({
      id: child.profile._id,
      firstName: child.profile.firstName,
      lastName: child.profile.lastName,
      bio: child.profile.bio,
      photo: child.profile.photo,
      gender: child.profile.gender,
      dateOfBirth: child.profile.dateOfBirth,
      relationshipType: child.relationshipType,
      isBiological: child.isBiological
    }))
  };

  res.status(200).json({
    status: 'success',
    data: {
      tree
    }
  });
});
