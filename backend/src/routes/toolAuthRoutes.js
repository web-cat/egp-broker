const express = require('express');
const router = express.Router();
const authenticateToolJWT = require('../middlewares/toolAuthMiddleware');

const {
    User,
    Assignment,
    FreePassPool,
    PassUsage,
    CourseOffering,
    PassType
} = require("../models/models");


/**
 * Get all freepasses for a specific user in a specific course
 * Requires userId and courseId in request body
 * Returns array of freepass objects or error if retrieval fails
 * 
 * Sample request body:
 * {
 *   "userId": "507f1f77bcf86cd799439011", 
 *   "courseId": "507f1f77bcf86cd799439012"
 * }
 */
router.post(`/get_freepasses`, authenticateToolJWT, async (req, res) => {
    try {
        const { userId, courseId } = req.body;
        const freepasses = await FreePassPool.find(
            { 
                courseOfferingId: courseId,
                userId: userId
            });
        
        passes = []

        for (let i = 0; i < freepasses.length; i++) {
            const passTypeId = freepasses[i].passTypeId;
            const passType = await PassType.findById(passTypeId);
            passes.push({
                id: freepasses[i]._id,
                name: passType.name,
                value: freepasses[i].value,
                description: passType.name,
                quantity: parseInt(passType.quantity),
            });
            console.log(passType);
        }

        res.json(passes);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve freepasses.' });
    }
});


router.post(`/redeem_freepass`, authenticateToolJWT, async (req, res) => {
    try {
        const { userId, courseId, passValue } = req.body;
        const freePass = await FreePassPool.findOne({
            userId,
            courseId,
            value: passValue,
            status: 'active',
        });

        if (!freePass) {
            return res.status(404).json({ error: 'Pass not found.' });
        }

        const passUsage = new PassUsage({
            userId,
            courseId,
            passValue,
        });

        await passUsage.save();
        freePass.status = 'used';
        await freePass.save();

        res.json({ message: 'Pass redeemed successfully.' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to redeem pass.' });
    }

});


module.exports = router;


