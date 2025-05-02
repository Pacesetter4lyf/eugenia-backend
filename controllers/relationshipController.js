const Profile = require('../models/profileModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Relationship = require('../models/relationshipModel');
const Lineage = require('../models/lineageModel');
const {
  getRelatedProfiles,
  getReverseRelationshipType
} = require('../utils/relationshipUtils');

// Helper functions
const createSiblingRelationship = async (siblingAId, siblingBId) => {
  const siblingA = await Profile.findById(siblingAId);
  if (!siblingA) return;

  const relA =
    (await Relationship.findOne({ profileId: siblingAId })) ||
    (await Relationship.create({ profileId: siblingAId }));
  const relB =
    (await Relationship.findOne({ profileId: siblingBId })) ||
    (await Relationship.create({ profileId: siblingBId }));

  const relType = siblingA.gender === 'Male' ? 'brother' : 'sister';
  const reverseType = getReverseRelationshipType(relType, siblingA.gender);

  relA.siblings.push({
    profile: siblingBId,
    relationshipType: relType,
    addedAt: Date.now()
  });

  relB.siblings.push({
    profile: siblingAId,
    relationshipType: reverseType,
    addedAt: Date.now()
  });

  await Promise.all([relA.save(), relB.save()]);
};

const createParentChildRelationship = async (parentId, childId, parentType) => {
  const relParent =
    (await Relationship.findOne({ profileId: parentId })) ||
    (await Relationship.create({ profileId: parentId }));
  const relChild =
    (await Relationship.findOne({ profileId: childId })) ||
    (await Relationship.create({ profileId: childId }));

  const childType = getReverseRelationshipType(parentType, 'Male');

  relParent.children.push({
    profile: childId,
    relationshipType: childType,
    addedAt: Date.now()
  });

  relChild.parents.push({
    profile: parentId,
    relationshipType: parentType,
    addedAt: Date.now()
  });

  await Promise.all([relParent.save(), relChild.save()]);
};

const addToSuggestions = async profileId => {
  const relatedProfiles = await getRelatedProfiles(profileId);

  // Find all lineages where this profile is a member
  const lineages = await Lineage.find({
    'lineageMembers.profileId': profileId
  });

  // Process all lineages in parallel
  const updatePromises = lineages.map(lineage => {
    const currentMembers = lineage.lineageMembers.map(m =>
      m.profileId.toString()
    );
    const newSuggestions = relatedProfiles.filter(
      profile => !currentMembers.includes(profile.toString())
    );

    // Update suggestions without duplicates
    lineage.suggestions = [
      ...new Set([...lineage.suggestions, ...newSuggestions])
    ];
    return lineage.save();
  });

  await Promise.all(updatePromises);
};

// Define valid scenarios for each relationship type
const VALID_SCENARIOS = {
  father: ['siblings', 'mother'],
  mother: ['siblings', 'father'],
  brother: ['siblings', 'parents'],
  sister: ['siblings', 'parents'],
  husband: ['children'],
  wife: ['children']
};

/**
 * Handle creating additional relationships based on scenarios
 */
const handleRelationshipScenarios = async (
  relationshipA,
  relationshipB,
  relationshipType,
  scenarios
) => {
  // Load full relationship documents with populated references
  relationshipA = await relationshipA
    .populate('parents.profile')
    .populate('children.profile')
    .populate('siblings.profile')
    .populate('spouses.profile');

  relationshipB = await relationshipB
    .populate('parents.profile')
    .populate('children.profile')
    .populate('siblings.profile')
    .populate('spouses.profile');

  const updates = [];

  switch (relationshipType) {
    case 'father':
      if (scenarios.includes('siblings')) {
        const otherChildren = relationshipA.children.filter(
          child =>
            child.profile._id.toString() !== relationshipB.profileId.toString()
        );
        updates.push(
          ...otherChildren.map(child =>
            createSiblingRelationship(
              child.profile._id,
              relationshipB.profileId
            )
          )
        );
      }
      if (scenarios.includes('mother')) {
        const currentWife = relationshipA.spouses.find(
          spouse => spouse.isCurrent && spouse.relationshipType === 'wife'
        );
        if (currentWife) {
          updates.push(
            createParentChildRelationship(
              currentWife.profile._id,
              relationshipB.profileId,
              'mother'
            )
          );
        }
      }
      break;

    case 'mother':
      if (scenarios.includes('siblings')) {
        const otherChildren = relationshipA.children.filter(
          child =>
            child.profile._id.toString() !== relationshipB.profileId.toString()
        );
        updates.push(
          ...otherChildren.map(child =>
            createSiblingRelationship(
              child.profile._id,
              relationshipB.profileId
            )
          )
        );
      }
      if (scenarios.includes('father')) {
        const currentHusband = relationshipA.spouses.find(
          spouse => spouse.isCurrent && spouse.relationshipType === 'husband'
        );
        if (currentHusband) {
          updates.push(
            createParentChildRelationship(
              currentHusband.profile._id,
              relationshipB.profileId,
              'father'
            )
          );
        }
      }
      break;

    case 'brother':
    case 'sister':
      if (scenarios.includes('siblings')) {
        const otherSiblings = relationshipA.siblings.filter(
          sibling =>
            sibling.profile._id.toString() !==
            relationshipB.profileId.toString()
        );
        updates.push(
          ...otherSiblings.map(sibling =>
            createSiblingRelationship(
              sibling.profile._id,
              relationshipB.profileId
            )
          )
        );
      }
      if (scenarios.includes('parents')) {
        updates.push(
          ...relationshipA.parents.map(parent =>
            createParentChildRelationship(
              parent.profile._id,
              relationshipB.profileId,
              parent.relationshipType
            )
          )
        );
      }
      break;

    case 'husband':
    case 'wife':
      if (scenarios.includes('children')) {
        // A's children become B's children
        updates.push(
          ...relationshipA.children.map(child =>
            createParentChildRelationship(
              relationshipB.profileId,
              child.profile._id,
              relationshipType === 'husband' ? 'father' : 'mother'
            )
          )
        );
        // B's children become A's children
        updates.push(
          ...relationshipB.children.map(child =>
            createParentChildRelationship(
              relationshipA.profileId,
              child.profile._id,
              relationshipType === 'husband' ? 'father' : 'mother'
            )
          )
        );
      }
      break;

    default:
      throw new AppError(
        `Unhandled relationship type: ${relationshipType}`,
        400
      );
  }

  await Promise.all(updates);
};

/**
 * Base function for creating relationships
 * Handles the actual creation of relationships and their reverse relationships
 */
const createRelationship = catchAsync(async (req, res, next) => {
  const { profileAId, profileBId, scenarios = [] } = req.body;
  const { relationshipType } = req.params;
  const { profileA } = req;

  // Get or create relationship documents for both profiles
  let relationshipA = await Relationship.findOne({ profileId: profileAId });
  let relationshipB = await Relationship.findOne({ profileId: profileBId });

  if (!relationshipA) {
    relationshipA = await Relationship.create({ profileId: profileAId });
  }
  if (!relationshipB) {
    relationshipB = await Relationship.create({ profileId: profileBId });
  }

  // Add the primary relationship based on type
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
    default:
      throw new AppError(`Invalid relationship type: ${relationshipType}`, 400);
  }

  // Create reverse relationship
  const reverseType = getReverseRelationshipType(
    relationshipType,
    profileA.gender
  );
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
    default:
      throw new AppError(
        `Invalid reverse relationship type: ${reverseType}`,
        400
      );
  }

  await Promise.all([relationshipA.save(), relationshipB.save()]);

  // Handle additional scenario-based relationships if scenarios are provided
  if (scenarios.length > 0) {
    await handleRelationshipScenarios(
      relationshipA,
      relationshipB,
      relationshipType,
      scenarios
    );
  }

  // Add both profiles to suggestions of their respective lineages
  await Promise.all([
    addToSuggestions(profileAId),
    addToSuggestions(profileBId)
  ]);

  res.status(201).json({
    status: 'success',
    data: {
      relationship: {
        from: profileAId,
        to: profileBId,
        type: relationshipType,
        scenariosApplied: scenarios
      }
    }
  });
});

/**
 * Middleware to validate relationship creation requests
 */
exports.validateRelationship = catchAsync(async (req, res, next) => {
  const { profileAId, profileBId, scenarios = [] } = req.body;
  const { relationshipType } = req.params;

  // Verify both profiles exist in the database
  const profileA = await Profile.findById(profileAId);
  const profileB = await Profile.findById(profileBId);

  if (!profileA || !profileB) {
    return next(new AppError('One or both profiles not found', 404));
  }

  // Validate scenarios if provided
  if (scenarios.length > 0) {
    const validScenariosForType = VALID_SCENARIOS[relationshipType] || [];
    const invalidScenarios = scenarios.filter(
      scenario => !validScenariosForType.includes(scenario)
    );

    if (invalidScenarios.length > 0) {
      return next(
        new AppError(
          `Invalid scenarios for ${relationshipType}: ${invalidScenarios.join(
            ', '
          )}. Valid scenarios are: ${validScenariosForType.join(', ')}`,
          400
        )
      );
    }
  }

  // Rest of validation logic...
  // ...existing validation code...

  // Attach profiles to request for use in createRelationship
  req.profileA = profileA;
  req.profileB = profileB;
  next();
});

/**
 * Endpoint handlers for creating specific types of relationships
 */

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
  const profile = await Profile.findById(profileId).select(
    'firstName lastName bio photo gender dateOfBirth'
  );

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
