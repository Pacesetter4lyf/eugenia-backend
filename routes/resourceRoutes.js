const express = require('express');
const resourceController = require('./../controllers/resourceController');
const authController = require('./../controllers/authController');

const router = express.Router({ mergeParams: true });

router.use(authController.protect);
router.route('/user/:userDataId').get(resourceController.getUserResource);
router
  .route('/')
  .get(resourceController.getAllResources)
  .post(
    authController.restrictTo('user'),
    resourceController.setTourUserIds,
    resourceController.createResource
  );

router
  .route('/:id')
  .get(resourceController.getResource)
  .patch(
    // authController.restrictTo('user', 'admin'),
    resourceController.updateResource
  )
  .delete(
    authController.restrictTo('user', 'admin'),
    resourceController.deleteResource
  );

module.exports = router;
