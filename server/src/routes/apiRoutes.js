const enrollment_routes = require('./enrollmentRoutes');
const course_routes = require('./courseRoutes');
const assignment_routes = require('./assignmentRoutes');
const pass_routes = require('./passRoutes');
const tool_routes = require('./toolRoutes');
const express = require('express');
const connectWithRetry = require('../config/db');

const router = express.Router();

connectWithRetry() 

// Dummy route for GET request
router.get('/', (req, res) => {
    res.json({ message: 'GET request successful' });
});

router.use('/enrollment', enrollment_routes);
router.use('/assignment', assignment_routes);
router.use('/pass', pass_routes);
router.use('/course', course_routes);
router.use('/tool', tool_routes)

module.exports = router;