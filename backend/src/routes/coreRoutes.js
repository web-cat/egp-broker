const express = require('express');
const router = express.Router();
const coreController = require('../controllers/coreController');
const authenticateJWT = require('../middlewares/authMiddleware');
const authController = require("../controllers/authController");
const {User, FreePassPool} = require("../models/models");

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



module.exports = router;
