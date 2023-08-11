const express = require('express');
const joinCodeController = require('./../controllers/joinCodeController');
const authController = require('./../controllers/authController');
const userDataController = require('./../controllers/userDataController');
const resourceController = require('./../controllers/resourceController');

const router = express.Router({ mergeParams: true });

router.use(authController.protect);

router.route('/incomingrequest').get(joinCodeController.incomingRequest);
router.route('/code/:code').get(joinCodeController.findCode);
router
  .route('/merge/:id')
  .get(
    joinCodeController.plantDetails,
    resourceController.copyResource,
    userDataController.merge
  );

router
  .route('/:id')
  .delete(joinCodeController.deleteCode)
  .patch(joinCodeController.updateJoinRequest);

router
  .route('/')
  .get(joinCodeController.getAllCodes)
  .post(joinCodeController.createJoinCode);

// router.route('/:id').delete(joinCodeController.deleteCode);
// router.route('/:id').patch(joinCodeController.updateJoinRequest);

//   .get(chatController.getChat)
//   .patch(authController.restrictTo('user', 'admin'), chatController.updateChat)
//   .delete(
//     authController.restrictTo('user', 'admin'),
//     chatController.deleteChat
//   );

module.exports = router;
