const express = require('express');
const relationshipController = require('../controllers/relationshipController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Relationship creation routes
router.post('/father', 
  relationshipController.validateRelationship,
  relationshipController.fatherOf
);
router.post('/mother', 
  relationshipController.validateRelationship,
  relationshipController.motherOf
);
router.post('/son', 
  relationshipController.validateRelationship,
  relationshipController.sonOf
);
router.post('/daughter', 
  relationshipController.validateRelationship,
  relationshipController.daughterOf
);
router.post('/brother', 
  relationshipController.validateRelationship,
  relationshipController.brotherOf
);
router.post('/sister', 
  relationshipController.validateRelationship,
  relationshipController.sisterOf
);
router.post('/husband', 
  relationshipController.validateRelationship,
  relationshipController.husbandOf
);
router.post('/wife', 
  relationshipController.validateRelationship,
  relationshipController.wifeOf
);

router.get('/tree/:profileId', relationshipController.getTree);
router.post('/tree', relationshipController.getTree);

module.exports = router; 