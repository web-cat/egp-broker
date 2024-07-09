const express = require('express');
const router = express.Router();
const coreController = require('../controllers/coreController');
const authenticateJWT = require('../middlewares/authMiddleware');
const authController = require("../controllers/authController");

router.get('/test', authenticateJWT, coreController.test);

/* Pass Types */
router.get('/pass-types', authenticateJWT, coreController.getPassTypes);
router.post('/pass-types', authenticateJWT, coreController.storePassTypes);
router.delete('/pass-types/:id', authenticateJWT, coreController.deletePassType);

/* Courses */
router.get('/courses', authenticateJWT, coreController.myCourses);

router.post('/register', authController.register);
router.post('/login', authController.login);


module.exports = router;
