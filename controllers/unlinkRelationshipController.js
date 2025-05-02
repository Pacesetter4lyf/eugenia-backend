const Profile = require('../models/profileModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Relationship = require('../models/relationshipModel');

// Define valid scenarios for each relationship type - matches relationshipController
const VALID_SCENARIOS = {
  father: ['siblings', 'mother'],
  mother: ['siblings', 'father'],
  brother: ['siblings', 'parents'],
  sister: ['siblings', 'parents'],
  husband: ['children'],
  wife: ['children']
};

// Helper functions to remove relationships
const removeSiblingRelationship = async (siblingAId, siblingBId) => {
  const [relA, relB] = await Promise.all([
    Relationship.findOne({ profileId: siblingAId }),
    Relationship.findOne({ profileId: siblingBId })
  ]);

  if (!relA || !relB) return;

  // Remove siblings from both relationships
  relA.siblings = relA.siblings.filter(
    sibling => sibling.profile.toString() !== siblingBId
  );
  relB.siblings = relB.siblings.filter(
    sibling => sibling.profile.toString() !== siblingAId
  );

  await Promise.all([relA.save(), relB.save()]);
};

const removeParentChildRelationship = async (parentId, childId) => {
  const [relParent, relChild] = await Promise.all([
    Relationship.findOne({ profileId: parentId }),
    Relationship.findOne({ profileId: childId })
  ]);

  if (!relParent || !relChild) return;

  // Remove child from parent's children array
  relParent.children = relParent.children.filter(
    child => child.profile.toString() !== childId
  );

  // Remove parent from child's parents array
  relChild.parents = relChild.parents.filter(
    parent => parent.profile.toString() !== parentId
  );

  await Promise.all([relParent.save(), relChild.save()]);
};

const removeSpouseRelationship = async (spouseAId, spouseBId) => {
  const [relA, relB] = await Promise.all([
    Relationship.findOne({ profileId: spouseAId }),
    Relationship.findOne({ profileId: spouseBId })
  ]);

  if (!relA || !relB) return;

  // Remove spouses from both relationships
  relA.spouses = relA.spouses.filter(
    spouse => spouse.profile.toString() !== spouseBId
  );
  relB.spouses = relB.spouses.filter(
    spouse => spouse.profile.toString() !== spouseAId
  );

  await Promise.all([relA.save(), relB.save()]);
};

/**
 * Handle unlinking additional relationships based on scenarios
 */
const handleUnlinkScenarios = async (
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
        // Unlink all of A's other children from B as siblings
        const otherChildren = relationshipA.children.filter(
          child =>
            child.profile._id.toString() !== relationshipB.profileId.toString()
        );
        updates.push(
          ...otherChildren.map(child =>
            removeSiblingRelationship(
              child.profile._id,
              relationshipB.profileId
            )
          )
        );
      }
      if (scenarios.includes('mother')) {
        // Unlink A's current wife as mother of B
        const currentWife = relationshipA.spouses.find(
          spouse => spouse.isCurrent && spouse.relationshipType === 'wife'
        );
        if (currentWife) {
          updates.push(
            removeParentChildRelationship(
              currentWife.profile._id,
              relationshipB.profileId
            )
          );
        }
      }
      break;

    case 'mother':
      if (scenarios.includes('siblings')) {
        // Unlink all of A's other children from B as siblings
        const otherChildren = relationshipA.children.filter(
          child =>
            child.profile._id.toString() !== relationshipB.profileId.toString()
        );
        updates.push(
          ...otherChildren.map(child =>
            removeSiblingRelationship(
              child.profile._id,
              relationshipB.profileId
            )
          )
        );
      }
      if (scenarios.includes('father')) {
        // Unlink A's current husband as father of B
        const currentHusband = relationshipA.spouses.find(
          spouse => spouse.isCurrent && spouse.relationshipType === 'husband'
        );
        if (currentHusband) {
          updates.push(
            removeParentChildRelationship(
              currentHusband.profile._id,
              relationshipB.profileId
            )
          );
        }
      }
      break;

    case 'brother':
    case 'sister':
      if (scenarios.includes('siblings')) {
        // Unlink A's other siblings from B
        const otherSiblings = relationshipA.siblings.filter(
          sibling =>
            sibling.profile._id.toString() !==
            relationshipB.profileId.toString()
        );
        updates.push(
          ...otherSiblings.map(sibling =>
            removeSiblingRelationship(
              sibling.profile._id,
              relationshipB.profileId
            )
          )
        );
      }
      if (scenarios.includes('parents')) {
        // Unlink A's parents from B
        updates.push(
          ...relationshipA.parents.map(parent =>
            removeParentChildRelationship(
              parent.profile._id,
              relationshipB.profileId
            )
          )
        );
      }
      break;

    case 'husband':
    case 'wife':
      if (scenarios.includes('children')) {
        // Unlink A's children from B
        updates.push(
          ...relationshipA.children.map(child =>
            removeParentChildRelationship(
              relationshipB.profileId,
              child.profile._id
            )
          )
        );
        // Unlink B's children from A
        updates.push(
          ...relationshipB.children.map(child =>
            removeParentChildRelationship(
              relationshipA.profileId,
              child.profile._id
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
 * Base function for unlinking relationships
 */
const unlinkRelationship = catchAsync(async (req, res, next) => {
  const { profileAId, profileBId, scenarios = [] } = req.body;
  const { relationshipType } = req.params;

  const relationshipA = await Relationship.findOne({ profileId: profileAId });
  const relationshipB = await Relationship.findOne({ profileId: profileBId });

  if (!relationshipA || !relationshipB) {
    return next(new AppError('One or both relationships not found', 404));
  }

  // Handle scenario-based unlinks first if scenarios are provided
  if (scenarios.length > 0) {
    await handleUnlinkScenarios(
      relationshipA,
      relationshipB,
      relationshipType,
      scenarios
    );
  }

  // Then handle the primary relationship unlink
  switch (relationshipType) {
    case 'father':
    case 'mother':
      await removeParentChildRelationship(profileAId, profileBId);
      break;
    case 'son':
    case 'daughter':
      await removeParentChildRelationship(profileBId, profileAId);
      break;
    case 'brother':
    case 'sister':
      await removeSiblingRelationship(profileAId, profileBId);
      break;
    case 'husband':
    case 'wife':
      await removeSpouseRelationship(profileAId, profileBId);
      break;
    default:
      throw new AppError(`Invalid relationship type: ${relationshipType}`, 400);
  }

  res.status(200).json({
    status: 'success',
    data: {
      message: 'Relationship unlinked successfully'
    }
  });
});

/**
 * Middleware to validate relationship unlinking requests
 */
exports.validateUnlinkRequest = catchAsync(async (req, res, next) => {
  const { profileAId, profileBId, scenarios = [] } = req.body;
  const { relationshipType } = req.params;

  // Verify both profiles exist in the database
  const [profileA, profileB] = await Promise.all([
    Profile.findById(profileAId),
    Profile.findById(profileBId)
  ]);

  if (!profileA || !profileB) {
    return next(new AppError('One or both profiles not found', 404));
  }

  // Verify the relationship exists
  const relationship = await Relationship.findOne({ profileId: profileAId });
  if (!relationship) {
    return next(new AppError('Relationship not found', 404));
  }

  let relationshipExists = false;
  switch (relationshipType) {
    case 'father':
    case 'mother':
      relationshipExists = relationship.parents.some(
        parent => parent.profile.toString() === profileBId
      );
      break;
    case 'son':
    case 'daughter':
      relationshipExists = relationship.children.some(
        child => child.profile.toString() === profileBId
      );
      break;
    case 'brother':
    case 'sister':
      relationshipExists = relationship.siblings.some(
        sibling => sibling.profile.toString() === profileBId
      );
      break;
    case 'husband':
    case 'wife':
      relationshipExists = relationship.spouses.some(
        spouse => spouse.profile.toString() === profileBId
      );
      break;
    default:
      return next(
        new AppError(`Invalid relationship type: ${relationshipType}`, 400)
      );
  }

  if (!relationshipExists) {
    return next(
      new AppError('Relationship does not exist between these profiles', 404)
    );
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

  next();
});

// Endpoint handlers for unlinking specific types of relationships
exports.unlinkFather = (req, res, next) => {
  req.params.relationshipType = 'father';
  return unlinkRelationship(req, res, next);
};

exports.unlinkMother = (req, res, next) => {
  req.params.relationshipType = 'mother';
  return unlinkRelationship(req, res, next);
};

exports.unlinkSon = (req, res, next) => {
  req.params.relationshipType = 'son';
  return unlinkRelationship(req, res, next);
};

exports.unlinkDaughter = (req, res, next) => {
  req.params.relationshipType = 'daughter';
  return unlinkRelationship(req, res, next);
};

exports.unlinkBrother = (req, res, next) => {
  req.params.relationshipType = 'brother';
  return unlinkRelationship(req, res, next);
};

exports.unlinkSister = (req, res, next) => {
  req.params.relationshipType = 'sister';
  return unlinkRelationship(req, res, next);
};

exports.unlinkHusband = (req, res, next) => {
  req.params.relationshipType = 'husband';
  return unlinkRelationship(req, res, next);
};

exports.unlinkWife = (req, res, next) => {
  req.params.relationshipType = 'wife';
  return unlinkRelationship(req, res, next);
};
