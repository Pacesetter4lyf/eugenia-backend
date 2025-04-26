const express = require('express');
const postController = require('../controllers/postController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Get all posts with filtering
router.get('/', postController.getAllPosts);

// Get a single post
router.get('/:id', postController.getPost);

// Create a new post
router.post('/', postController.createPost);

// Add a comment to a post
router.post('/:id/comments', postController.addComment);

// Toggle comments on/off
router.patch('/:id/toggle-comments', postController.toggleComments);

// Set post as group resource
router.patch('/:id/set-group-resource', postController.setAsGroupResource);

// Update a post
router.patch('/:id', postController.updatePost);

// Delete a post
router.delete('/:id', postController.deletePost);

module.exports = router;
