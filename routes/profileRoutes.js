const express = require('express');
const profileController = require('../controllers/profileController');
const authController = require('./../controllers/authController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

router.post(
  '/',
  profileController.parseFile,
  profileController.resizeUserPhoto,
  profileController.checkAndUploadFile,
  profileController.createProfile
);

router
  .route('/:id')
  .get(profileController.getProfile)
  .put(
    profileController.parseFile,
    profileController.resizeUserPhoto,
    profileController.revalidateImageUrl,
    profileController.updateProfile
  )
  .delete(
    profileController.checkAndDeleteFromUploadCare,
    profileController.deleteProfile
  );

module.exports = router;
