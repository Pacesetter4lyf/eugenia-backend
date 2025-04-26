const express = require('express');
const settingsController = require('../controllers/settingController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// PUT: Update visibility settings
router.put('/visibility', settingsController.updateVisibilitySettings);

// GET: Retrieve visibility settings
router.get('/visibility', settingsController.getVisibilitySettings);

module.exports = router;
