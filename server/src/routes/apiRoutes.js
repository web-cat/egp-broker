const student_routes = require('./studentRoutes');
const instructor_routes = require('./instructorRoutes');
const course_routes = require('./courseRoutes');
const express = require('express');
const connectWithRetry = require('../config/db');

const router = express.Router();

connectWithRetry() 

// Dummy route for GET request
router.get('/', (req, res) => {
    res.json({ message: 'GET request successful' });
});

router.use('/student', student_routes);
router.use('/instructor', instructor_routes);
router.use('/course', course_routes);

module.exports = router;