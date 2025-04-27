const express = require('express');
const lineageController = require('../controllers/lineageController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Lineage management routes
router
  .route('/')
  .get(lineageController.getMyLineage);

router
  .route('/members')
  .get(lineageController.getMyLineageMembers)
  .post(lineageController.addToLineage)
  .delete(lineageController.removeFromLineage);

router.get('/search', lineageController.searchLineage);

// Suggestions management
router.delete('/:lineageId/suggestions/:profileId', lineageController.removeFromSuggestions);
router.post('/:lineageId/suggestions/refresh', lineageController.refreshSuggestions);

module.exports = router; 