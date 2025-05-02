const express = require('express');
const unlinkRelationshipController = require('../controllers/unlinkRelationshipController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Relationship unlinking routes
router.delete(
  '/father',
  unlinkRelationshipController.validateUnlinkRequest,
  unlinkRelationshipController.unlinkFather
);
router.delete(
  '/mother',
  unlinkRelationshipController.validateUnlinkRequest,
  unlinkRelationshipController.unlinkMother
);
router.delete(
  '/son',
  unlinkRelationshipController.validateUnlinkRequest,
  unlinkRelationshipController.unlinkSon
);
router.delete(
  '/daughter',
  unlinkRelationshipController.validateUnlinkRequest,
  unlinkRelationshipController.unlinkDaughter
);
router.delete(
  '/brother',
  unlinkRelationshipController.validateUnlinkRequest,
  unlinkRelationshipController.unlinkBrother
);
router.delete(
  '/sister',
  unlinkRelationshipController.validateUnlinkRequest,
  unlinkRelationshipController.unlinkSister
);
router.delete(
  '/husband',
  unlinkRelationshipController.validateUnlinkRequest,
  unlinkRelationshipController.unlinkHusband
);
router.delete(
  '/wife',
  unlinkRelationshipController.validateUnlinkRequest,
  unlinkRelationshipController.unlinkWife
);

module.exports = router;
