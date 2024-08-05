const express = require('express');
const router = express.Router();
const authenticateJWT = require('../middlewares/authMiddleware');

const {
    User,
    Assignment,
    FreePassPool,
    FreePassRequest,
    PassUsage,
    CourseOffering,
} = require("../models/models");

async function canUseFreePass(userId) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const lastUsage = await PassUsage.findOne({
        userId: userId,
        usedAt: { $gte: oneWeekAgo },
    }).sort({ usedAt: -1 });

    return !lastUsage;
}

router.get('/api/instructor/:courseOfferingId/requests', authenticateJWT, async (req, res) => { //done
    try {
        const courseOfferingId = req.params.courseOfferingId; // Get the course offering ID from the request parameters
        const requests = await FreePassRequest.find({ status: 'requested', courseOfferingId }).populate('userId').populate('courseOfferingId');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/student/:courseOfferingId/requests', authenticateJWT, async (req, res) => { //done
    try {
        const userId = req.user.id;
        const courseOfferingId = req.params.courseOfferingId; // Get the course offering ID from the request parameters
        const requests = await FreePassRequest.find({ userId, courseOfferingId }).populate('userId').populate('courseOfferingId').populate('freePassPoolId');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/instructor/grant-pass/:id/:count', authenticateJWT, async (req, res) => { //done
    try {
        const creatorId = req.user.id;
        const { id, count } = req.params;

        // Find the FreePassRequest
        const passRequest = await FreePassRequest.findById(id);
        if (!passRequest) {
            return res.status(404).json({ error: 'Pass request not found' });
        }

        // Find the User
        const user = await User.findById(passRequest.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update the FreePassRequest status to 'granted'
        passRequest.status = 'granted';
        await passRequest.save();

        // Create a new FreePassPool entry
        const passes = Array.from({ length: count }, () => ({
            value: generateRandomValue(),
            userId: user._id,
            creatorId: creatorId,
            courseOfferingId: passRequest.courseOfferingId,
            status: 'active',
            passTypeId: passRequest.passTypeId
        }));

        const createdPasses = await FreePassPool.create(passes);

        // Update the FreePassRequest with the new FreePassPool ID
        passRequest.freePassPoolId = createdPasses.map(pass => pass._id);
        await passRequest.save();

        res.status(200).json(passRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// grant pass approve or decline
router.post('/api/instructor/reject-pass/:id', authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const passRequest = await FreePassRequest.findById(id);
        if (!passRequest) {
            return res.status(404).json({ error: 'Pass request not found' });
        }

        passRequest.status = 'rejected';
        await passRequest.save();

        res.status(200).json(passRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/freepass', authenticateJWT, async (req, res) => { //done
    try {
        const { userId, value, courseOfferingId, passTypeId } = req.body;
        const creatorId = req.user.id;
        const newPass = await FreePassPool.create({ userId, value, courseOfferingId, creatorId, passTypeId, status: 'active' });
        res.status(201).json(newPass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.get('/api/freepassPool/:courseId', authenticateJWT, async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const tagsString = req.query.tags; // Get tags as a comma-separated string (if any)
        const userId = req.user.id;

        const courseOffering = await CourseOffering.findOne({ _id: courseId }).populate('courseId');
        if (!courseOffering) {
            return res.status(404).json({ error: 'Course offering not found' });
        }

        let passes = await FreePassPool.find({
            courseOfferingId: courseOffering._id,
            userId: userId,
        })
            .populate('userId')
            .populate({
                path: 'courseOfferingId',
                populate: { path: 'courseId' },
            })
            .populate('passTypeId');

        if (tagsString) {
            const tagsArray = tagsString.split(',').map(tag => tag.trim().toLowerCase());
            passes = passes.filter(pass => {
                const passTags = pass.passTypeId.tags.split(',').map(tag => tag.trim().toLowerCase());
                return tagsArray.some(tag => passTags.includes(tag));
            });
        }

        if (passes.length === 0) {
            return res.status(404).json({ error: 'No active free passes found for this user in this course' });
        }

        res.json(passes);
    } catch (error) {
        console.error('Error fetching free passes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.put('/freepass/:id', authenticateJWT, async (req, res) => { //done
    try {
        const { value, status } = req.body;
        const pass = await FreePassPool.findById(req.params.id);
        if (!pass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }
        pass.value = value;
        pass.status = status;
        await pass.save();
        res.json(pass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/api/freepass/:id', authenticateJWT, async (req, res) => {
    try {
        const pass = await FreePassPool.findById(req.params.id);
        if (!pass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }

        if (!pass.creatorId.equals(req.user.id)) {
            return res.status(403).json({ error: 'Access denied. You can only delete your own free passes.' });
        }

        await pass.remove();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/api/pass-usage-history', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;

        const passUsages = await PassUsage.find({ userId, status: 'success' })
            .populate({
                path: 'freePassId', // Populate the freePassId field to get pass details
                populate: { path: 'passTypeId' }, // Populate nested passTypeId to get pass type name
            })
            .populate('assignmentId') // Populate assignmentId to get assignment details
            .sort({ usedAt: -1 }); // Sort by usage date (descending)

        res.json(passUsages);
    } catch (error) {
        console.error('Error fetching pass usage history:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/freepass/:id/assign/:studentId', authenticateJWT, async (req, res) => { //done
    const { id, studentId } = req.params;

    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
    }

    try {
        const pass = await FreePassPool.findById(id);
        if (!pass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }

        pass.userId = studentId;
        await pass.save();

        res.json(pass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// pass through assignment
router.post('/api/freepass-use/:assignmentId/:id', authenticateJWT, async (req, res) => { //done
    try {
        const { assignmentId, id } = req.params;
        const userIdFromToken = req.user.id; // Get userId from the token

        // Find the FreePassPool
        const freePass = await FreePassPool.findById(id);
        if (!freePass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }

        // Additional validation: Ensure userId matches userId from token
        if (!freePass.userId.equals(userIdFromToken)) {
            return res.status(403).json({ error: 'You do not have permission to use this free pass.' });
        }


        // Check if the pass belongs to the authenticated user
        if (!freePass.userId.equals(userIdFromToken)) {
            return res.status(403).json({ error: 'Access denied. You can only use your own free passes.' });
        }

        // Check if the user can use a free pass
        const canUsePass = await canUseFreePass(userIdFromToken);
        if (!canUsePass) {
            const passUsage = await PassUsage.create({
                freePassId: freePass._id,
                assignmentId: assignmentId,
                status: 'failed',
                usedAt: new Date(),
                userId: userIdFromToken, // Use userId from token
            });
            return res.status(429).json({ error: 'You can only use one free pass per week.' });
        }

        // Update the pass status to "used"
        freePass.status = "used";
        await freePass.save();

        // Create a PassUsage record
        const passUsage = await PassUsage.create({
            freePassId: freePass._id,
            assignmentId: assignmentId,
            status: 'success',
            usedAt: new Date(),
            userId: userIdFromToken, // Use userId from token
        });

        res.json(passUsage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// to use pass on a assignment by student
router.post('/api/use-pass/:assignmentId/:passValue', authenticateJWT, async (req, res) => { //done
    try {
        const { assignmentId, passValue } = req.params;
        const userId = req.user.id;

        // 1. Fetch Assignment and Active Free Pass
        const assignment = await Assignment.findById(assignmentId);
        const freePass = await FreePassPool.findOne({
            userId,
            courseOfferingId: assignment.courseOfferingId,
            value: passValue, // Unique identifier for the pass
            status: 'active',
        });

        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        if (!freePass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }

        // 2. Check Pass Usage Eligibility
        if (!await canUseFreePass(userId)) {
            await PassUsage.create({
                freePassId: freePass._id,
                assignmentId,
                status: 'failed',
                usedAt: new Date(),
                userId
            });
            return res.status(429).json({ error: 'You can only use one free pass per week.' });
        }

        // 3. Mark Pass as Used
        freePass.status = 'used';
        await freePass.save();

        // 4. Record Pass Usage
        const passUsage = await PassUsage.create({
            freePassId: freePass._id,
            assignmentId,
            status: 'success',
            usedAt: new Date(),
            userId,
        });

        res.json({ message: 'Free pass used successfully', passUsage }); // Send success response
    } catch (error) {
        console.error('Error using free pass:', error);
        res.status(500).json({ error: error.message });
    }
});


function generateRandomValue() {
    return Math.floor(Math.random() * 1000000).toString();
}
module.exports = router;
