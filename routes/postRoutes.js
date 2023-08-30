const express = require('express');
const postController = require('../controllers/postController');
const authController = require('../controllers/authController');
const userDataController = require('../controllers/userDataController');
const resourceController = require('../controllers/resourceController');

const router = express.Router({ mergeParams: true });

router.use(authController.protect);

router.patch('/like/:id', postController.like);
router.patch('/patchpost/:id', postController.patchPost);
router
  .route('/:id')
  .delete(postController.deletePost)
  .get(postController.getPost)
  .patch(postController.updatePost);

router
  .route('/')
  .get(postController.getAllPosts)
  .post(postController.createPost);

module.exports = router;
