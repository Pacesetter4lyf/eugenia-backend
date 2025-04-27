const express = require('express');
const favouriteController = require('../controllers/favouriteController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Favourites management routes
router
  .route('/')
  .get(favouriteController.getMyFavourites);

router
  .route('/members')
  .post(favouriteController.addToFavourites)
  .delete(favouriteController.removeFromFavourites);

router.delete('/suggestions', favouriteController.removeSuggestedMember);

module.exports = router; 