const express = require('express');
const router = express.Router();
const coreController = require('../controllers/coreController');
const authenticateJWT = require('../middlewares/authMiddleware');
const ltiController = require("../controllers/ltiController");
const { LTIId, User } = require('../models/models');



router.get('/test', authenticateJWT, ltiController.test);
router.get('/assignments', authenticateJWT, ltiController.assignments);

router.get('/:userId', authenticateJWT, async (req, res) => {
    try {
        const ltiId = req.params.userId; // LTI ID from the request parameter
        const userId = req.user.id; // User ID from JWT token (decoded in middleware)

        // 1. Check if a user with this email exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('user', user)
        // 2. Check if LTIId entry already exists for this user
        const existingLTIId = await LTIId.findOne({ userId });
        if (existingLTIId) {
            return res.json({ ltiId: existingLTIId.ltiId });
        }

        // 3. If no LTIId entry exists, create one
        const newLTIId = await LTIId.create({
            ltiId,
            userId: user._id,
            client: 'canvas'
        });
        console.log('newLTIId', newLTIId)
        res.json({ ltiId: newLTIId.ltiId });
    } catch (error) {
        console.error('Error fetching or creating LTI ID:', error);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});





module.exports = router;
