const express = require('express');
const router = express.Router();

const ltiRoutes = require('./ltiRoutes');
const apiRoutes = require('./apiRoutes');
const launchRoutes = require('./launchRoutes');

router.use('/lti', ltiRoutes);
router.use('/api', apiRoutes); // Other non-LTI routes
router.use('/launches', launchRoutes);

module.exports = router;