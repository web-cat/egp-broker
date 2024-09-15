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

router.get('/api/v1/courses/:courseId/assignments', authenticateJWT, async (req, res) => {
    try {
        const courseId = req.params.courseId; // Get the course ID from the request parameters

        // Find the course offering by course ID
        const courseOffering = await CourseOffering.findOne({ courseId });
        if (!courseOffering) {
            return res.status(404).json({ error: 'Course offering not found' });
        }

        // Fetch assignments related to the course offering
        const assignments = await Assignment.find({ courseOfferingId: courseOffering._id })
            .populate('courseOfferingId') // Populate courseOfferingId if needed
            // .populate('userId'); // Populate userId if needed

        if (assignments.length === 0) {
            return res.status(404).json({ error: 'No assignments found for this course' });
        }

        res.json(assignments);
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: error.message });
    }
});

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
        console.log('Received courseId:', courseId);

        const tagsString = req.query.tags; // Get tags as a comma-separated string (if any)
        console.log("Received tagsString:", tagsString);

        const userId = req.user.id;
        console.log('User ID:', userId);

        // Find the course offering
        const courseOffering = await CourseOffering.findOne({ _id: courseId }).populate('courseId');
        if (!courseOffering) {
            return res.status(404).json({ error: 'Course offering not found' });
        }
        console.log('Found courseOffering:', courseOffering);

        // Find the free passes
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
        
        console.log('Found passes before filtering:', passes);

        // Filter passes by tags if tagsString exists
        if (tagsString) {
            const tagsArray = tagsString.split(',').map(tag => tag.trim().toLowerCase());
            console.log('tagsArray:', tagsArray);
            console.log('passesss',passes);
            console.log('passesssId',passes.passTypeId);
            passes = passes.filter(pass => {
                // Skip entries with null passTypeId
                if (!pass.passTypeId || !pass.passTypeId.tags) {
                    console.log('Skipping pass with null or missing passTypeId:', pass._id);
                    return false;
                }

                const passTags = pass.passTypeId.tags.split(',').map(tag => tag.trim().toLowerCase());
                console.log('passTags:', passTags);
                
                return tagsArray.some(tag => passTags.includes(tag));
            });
        }

        // If no passes remain after filtering
        if (passes.length === 0) {
            return res.status(404).json({ error: 'No active free passes found for this user in this course' });
        }

        // Respond with the passes
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


// to use pass on a assignment by student
router.post('/api/use-pass/:assignmentId/:passValue', authenticateJWT, async (req, res) => { 
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

        // 4. Extend Assignment Due Date by One Day
        assignment.dueAt = new Date(assignment.dueAt.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
        await assignment.save();

        // 5. Record Pass Usage
        const passUsage = await PassUsage.create({
            freePassId: freePass._id,
            assignmentId,
            status: 'success',
            usedAt: new Date(),
            userId,
        });

        res.json({ message: 'Free pass used successfully and assignment due date extended', passUsage, assignment }); // Send success response
    } catch (error) {
        console.error('Error using free pass:', error);
        res.status(500).json({ error: error.message });
    }
});


function generateRandomValue() {
    return Math.floor(Math.random() * 1000000).toString();
}
module.exports = router;
