const express = require('express');
const userController = require('./../controllers/userController');
const authController = require('./../controllers/authController');
const userDataController = require('./../controllers/userDataController');
const settingController = require('./../controllers/settingController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// router.get('/byId/:id', userDataController.getUserWithId);

router.get(
  '/tree/:id',
  userDataController.protectLineage,
  userDataController.tree
);
router.post(
  '/createUser',
  userController.uploadUserPhoto,
  userController.resizeUserPhoto,
  userDataController.createUser
);

router.get('/search/:text', userDataController.search);
router.get('/findpeople', userDataController.findPeople);

router
  .route('/relationship/:A/:B')
  .get(userDataController.getRelationship)
  .patch(userDataController.setUnset);

router.get(
  '/member/:id/:lineage/:action',
  userDataController.changeMemberStatus
);
router.get('/members', userDataController.getMembers);

router
  .route('/settings/:id')
  .get(settingController.getSchema)
  .patch(settingController.updateUserSetting);

router
  .route('/:id')
  .get(userDataController.getUserWithId_)
  .patch(
    userController.uploadUserPhoto,
    userController.resizeUserPhoto,
    userDataController.updateMe
  )
  .delete(userDataController.deleteUser);
module.exports = router;
