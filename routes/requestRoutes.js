const express = require('express');
const requestController = require('../controllers/requestController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Get incoming and outgoing requests
router.get('/incoming', requestController.getIncomingRequests);
router.get('/outgoing', requestController.getOutgoingRequests);

// Handle request actions
router.post('/generate', requestController.generateRequestCode);
router.post('/join/:joinCode', requestController.joinByCode);
router.patch('/:requestId/decline', requestController.declineRequest);
router.patch('/:requestId/merge', requestController.mergeRequest);

module.exports = router;
