const express = require('express');
const chatController = require('./../controllers/chatController');
const authController = require('./../controllers/authController');

const router = express.Router({ mergeParams: true });

router.use(authController.protect);

router
  .route('/')
  .get(chatController.getAllChats)
  .post(chatController.createChat);

router
  .route('/:id')
  .get(chatController.getChat)
  .patch(authController.restrictTo('user', 'admin'), chatController.updateChat)
  .delete(
    authController.restrictTo('user', 'admin'),
    chatController.deleteChat
  );

module.exports = router;
