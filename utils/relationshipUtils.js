const Relationship = require('../models/relationshipModel');

/**
 * Gets all related profiles within a specified depth
 * @param {string} profileId - The ID of the profile to start from
 * @param {number} depth - Maximum depth to traverse (default: 3)
 * @returns {Promise<Array<string>>} - Array of related profile IDs
 */
exports.getRelatedProfiles = async (profileId, depth = 3) => {
  const visited = new Set();
  let currentLevel = [{ id: profileId, depth: 0 }];
  const relatedProfiles = new Set();

  // Process profiles level by level until max depth is reached or no more profiles to visit
  while (currentLevel.length > 0 && currentLevel[0].depth <= depth) {
    const nextLevelPromises = currentLevel
      .filter(({ id }) => !visited.has(id))
      .map(({ id, depth: currentDepth }) => {
        visited.add(id);
        relatedProfiles.add(id);

        // Return a promise for fetching relationships
        return Relationship.findOne({ profileId: id }).then(relationship => {
          if (!relationship) return [];

          // Get all related profiles from parents, siblings, spouses, and children
          const relatedIds = [
            ...relationship.parents.map(p => p.profile.toString()),
            ...relationship.siblings.map(s => s.profile.toString()),
            ...relationship.spouses.map(s => s.profile.toString()),
            ...relationship.children.map(c => c.profile.toString())
          ];

          // Return next level's nodes
          return relatedIds
            .filter(relatedId => !visited.has(relatedId))
            .map(relatedId => ({
              id: relatedId,
              depth: currentDepth + 1
            }));
        });
      });

    const nextLevel = (await Promise.all(nextLevelPromises)).flat();

    // Flatten and set as current level for next iteration
    currentLevel = nextLevel.flat();
  }

  return Array.from(relatedProfiles);
};

/**
 * Gets the reverse relationship type based on the original type and gender
 * @param {string} type - Original relationship type
 * @param {string} gender - Gender of the profile
 * @returns {string|null} - Reverse relationship type or null if invalid
 */
exports.getReverseRelationshipType = (type, gender) => {
  const reverseMap = {
    father: 'child',
    mother: 'child',
    son: 'parent',
    daughter: 'parent',
    brother: 'sibling',
    sister: 'sibling',
    husband: 'spouse',
    wife: 'spouse'
  };

  const reverseType = reverseMap[type];
  if (!reverseType) return null;

  switch (reverseType) {
    case 'child':
      return gender === 'Male' ? 'son' : 'daughter';
    case 'parent':
      return gender === 'Male' ? 'father' : 'mother';
    case 'sibling':
      return gender === 'Male' ? 'brother' : 'sister';
    case 'spouse':
      return gender === 'Male' ? 'husband' : 'wife';
    default:
      return null;
  }
};
