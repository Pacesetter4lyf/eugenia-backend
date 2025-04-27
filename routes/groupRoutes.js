const express = require('express');
const groupController = require('../controllers/groupController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Group CRUD operations
router
  .route('/')
  .get(groupController.getAllGroups)
  .post(groupController.createGroup);

router
  .route('/:id')
  .get(groupController.getGroup)
  .patch(groupController.updateGroup)
  .delete(groupController.deleteGroup)
  .post(groupController.restoreGroup);

// Member management
router
  .route('/:id/members')
  .get(groupController.getMembers)
  .post(groupController.addMember)
  .delete(groupController.removeMember);

// Admin management
router.patch('/:id/make-admin', groupController.makeAdmin);

// Invitation management
router.get('/invitations', groupController.getInvitedGroups);
router.post('/:id/accept', groupController.acceptInvitation);
router.post('/:id/decline', groupController.declineInvitation);

module.exports = router; 