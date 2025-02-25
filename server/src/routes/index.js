const express = require('express');
const router = express.Router();

const ltiRoutes = require('./ltiRoutes');
const apiRoutes = require('./apiRoutes');

router.use('/lti', ltiRoutes);
router.use('/api', apiRoutes); // Other non-LTI routes

module.exports = router;