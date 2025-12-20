const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const activityController = require('../controllers/activityController');

router.use(auth);

router.get('/', activityController.getActivities);

module.exports = router;
