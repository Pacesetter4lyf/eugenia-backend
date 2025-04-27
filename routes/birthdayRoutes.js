const express = require('express');
const birthdayController = require('../controllers/birthdayController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Get birthdays with optional filtering
router.get('/', birthdayController.getBirthdays);

module.exports = router; 