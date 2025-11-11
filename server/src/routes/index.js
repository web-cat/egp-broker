const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/dualAuth');

const ltiRoutes = require('./ltiRoutes');
const apiRoutes = require('./apiRoutes');
const authRoutes = require('./authRoutes');


router.use('/lti', ltiRoutes);
router.use('/api', requireAuth, apiRoutes);// Other non-LTI routes
router.use('/auth', authRoutes);
module.exports = router;