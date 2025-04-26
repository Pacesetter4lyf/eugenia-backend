const express = require('express');
const mediaController = require('../controllers/mediaController');
const authController = require('./../controllers/authController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

router.post(
  '/',
  mediaController.parseFile,
  mediaController.checkAndUploadFile,
  mediaController.createMedia
);

router.get('/mymedia', mediaController.getMyMedia);
router.get('/theirmedia/:user', mediaController.getTheirMedia);
router
  .route('/:id')
  .get(mediaController.getMedia)
  .put(
    mediaController.parseFile,
    mediaController.revalidateImageUrl,
    mediaController.updateMedia
  )
  .delete(
    mediaController.checkAndDeleteFromUploadCare,
    mediaController.deleteMedia
  );

module.exports = router;
