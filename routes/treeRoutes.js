const express = require('express');
const userController = require('./../controllers/userController');
const authController = require('./../controllers/authController');
const userDataController = require('./../controllers/userDataController');
const treeController = require('./../controllers/treeController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

router.get(
  '/tree/:id',
  treeController.protectLineage,
  treeController.tree
);

module.exports = router;
