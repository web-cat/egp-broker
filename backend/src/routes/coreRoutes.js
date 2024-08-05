const express = require('express');
const router = express.Router();
const coreController = require('../controllers/coreController');
const authenticateJWT = require('../middlewares/authMiddleware');
const authController = require("../controllers/authController");
const {User, FreePassPool,Assignment} = require("../models/models");
const {
    CourseEnrollment,
} = require("../models/models");

router.get('/test', authenticateJWT, coreController.test);

/* Pass Types */
router.get('/pass-types', authenticateJWT, coreController.getPassTypes);
router.post('/pass-types', authenticateJWT, coreController.storePassTypes);
router.delete('/pass-types/:id', authenticateJWT, coreController.deletePassType);

/* Courses */
router.get('/courses', authenticateJWT, coreController.myCourses);

// Assignments by course offering
router.get('/course-offering/:id/assignments', authenticateJWT, coreController.assignmentsByCourseOffering);

// Free passes
router.get('/freepass/:courseOfferingId', authenticateJWT, coreController.studentsByCourseOffering);
router.post('/freepassrequest', authenticateJWT, coreController.freePassRequest);

/* Students by course offering */
router.get('/course-offering/:id/students', authenticateJWT, coreController.studentsByCourseOffering);
router.post('/generate-passes/:courseOfferingId', authenticateJWT, coreController.generatePassesByCourseOffering);

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/user/:email', async (req, res) => {
    try {
        const email = req.params.email;

        // Find the user in the database
        const user = await User.findOne({ email });

        // Check if the user exists
        const exists = user !== null;

        res.json({ exists });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});
router.post('/course-enrollment', authenticateJWT, async (req, res) => {
    try {
        const {  courseOfferingId, role } = req.body;
        const userId = req.user.id;

        // 1. Input Validation (Important for security and data integrity)
        if (!userId || !courseOfferingId || !role) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (role !== 'student' && role !== 'instructor' && role !== 'ta') {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // 2. Check if the enrollment already exists (optional)
        const existingEnrollment = await CourseEnrollment.findOne({ userId, courseOfferingId });
        if (existingEnrollment) {
            return res.status(400).json({ error: 'Enrollment already exists' });
        }

        // 3. Create the course enrollment
        const newEnrollment = new CourseEnrollment({ userId, courseOfferingId, role });
        await newEnrollment.save();

        res.status(201).json({ success: true, enrollment: newEnrollment });
    } catch (error) {
        console.error('Error creating course enrollment:', error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

router.post('/create-assignment', authenticateJWT, async (req, res) => {
    try {
        const { courseOfferingId, title, description, value, status, dueAt, tags } = req.body;

        // Validate input
        if (!courseOfferingId || !title || !description || !value || !status || !dueAt) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Create new assignment
        const newAssignment = new Assignment({
            courseOfferingId,
            title,
            description,
            value,
            status,
            dueAt,
            tags
        });

        // Save the assignment to the database
        await newAssignment.save();

        // Send response
        res.status(201).json({ message: 'Assignment created successfully', assignment: newAssignment });
    } catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})



module.exports = router;
