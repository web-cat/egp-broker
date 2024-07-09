const express = require('express');
const router = express.Router();
const coreController = require('../controllers/coreController');
const authenticateJWT = require('../middlewares/authMiddleware');
const ltiController = require("../controllers/ltiController");

router.get('/test', authenticateJWT, ltiController.test);
router.get('/assignments', authenticateJWT, ltiController.assignments);
module.exports = router;
