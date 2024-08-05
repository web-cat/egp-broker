const {
    User,
    Course,
    CourseEnrollment,
    PassType,
    Assignment,
    FreePassPool,
    FreePassRequest,
    PassUsage,
    Term,
    CourseOffering,
    LTIId
} = require('../models/models');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const authenticateJWT = require("../middlewares/authMiddleware");

function generateRandomValue() {
    return Math.floor(Math.random() * 1000000).toString();
}

exports.test = async (req, res) => {
    try {
        const data = {
            "test": req.user.id
        };
        res.json(data);
    } catch (err) {
        res.status(500).json({error: err.message});
    }
};


exports.getPassTypes = async (req, res) => { //done
    try {
        const userId = req.user.id; // Get the authenticated user's ID

        // Fetch pass types where userId is either null (global) or matches the authenticated user's ID
        const passTypes = await PassType.find({
            $or: [
                {userId: null},
                {userId: userId}
            ]
        });

        res.json(passTypes);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
};


// Create a new PassType
exports.storePassTypes = async (req, res) => { //done
    try {
        const {name, description, tags, initialCount, validityPeriod} = req.body;
        const userId = req.user.id;
        const passType = await PassType.create({
            name,
            description,
            tags,
            initialCount,
            validityPeriod,
            userId,
        });

        res.status(201).json(passType);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
};

// Delete a PassType by ID
exports.deletePassType = async (req, res) => { //done
    try {
        const passType = await PassType.findById(req.params.id);

        if (!passType) {
            return res.status(404).json({error: 'PassType not found'});
        }

        await passType.deleteOne();

        res.status(204).send();
    } catch (error) {
        res.status(500).json({error: error.message});
    }
};

exports.myCourses = async (req, res) => { //done
    try {
        const userId = req.user.id; // Get the current user ID from the authenticated user

        const enrollments = await CourseEnrollment.find({
            userId: userId, // Filter by the current user's ID
        }).populate({
            path: 'courseOfferingId',
            populate: [
                {path: 'courseId', model: Course},
                {path: 'termId', model: Term}
            ]
        });

        res.json(enrollments);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
};

exports.assignmentsByCourseOffering = async (req, res) => { //done
    try {
        const courseOfferingId = req.params.id; // Get the course offering ID from the request parameters

        const courseOfferingObjectId = new ObjectId(courseOfferingId);

        // Fetch assignments
        const assignments = await Assignment.find({courseOfferingId: courseOfferingObjectId});

        res.json(assignments);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
};

exports.studentsByCourseOffering = async (req, res) => { //done
    try {

        const courseOfferingId = req.params.id;
        console.log('Fetching students for course offering:', courseOfferingId);

        // 1. Fetch Enrollments with Additional Logging:
        const enrollments = await CourseEnrollment
            .find({ courseOfferingId, role: 'student' })
            .populate('userId')
            .exec()
            .then(result => {
                console.log('Fetched enrollments:', result.length);
                return result;
            })
            .catch(err => {
                throw new Error('Error fetching enrollments: ' + err.message);
            });

        if (enrollments.length === 0) {
            console.warn('No enrollments found for this course offering.');
            return res.json([]);
        }

        // 2. Extract User IDs and Enhance Aggregation:
        const userIds = enrollments.map(enrollment => enrollment.userId._id);
        console.log('User IDs:', userIds);

        const freePassCounts = await FreePassPool.aggregate([
            { $match: { userId: { $in: userIds } } }, // Filter for relevant users
            {
                $group: {
                    _id: '$userId',
                    activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
                    usedCount: { $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] } }
                }
            }
        ]);
        console.log('Free Pass Counts:', freePassCounts);

        // 3. Merge and Respond with Robust Error Handling:
        const enrollmentsWithFreePassCount = enrollments.map(enrollment => {
            const user = enrollment.userId;
            const freePassCount = freePassCounts.find(count =>
                count._id.equals(user._id)
            ) || { activeCount: 0, usedCount: 0 };

            return {
                ...enrollment.toObject(),
                userId: {
                    ...user.toObject(),
                    activePassCount: freePassCount.activeCount,
                    usedPassCount: freePassCount.usedCount
                }
            };
        });

        res.json(enrollmentsWithFreePassCount);
    } catch (error) {
        console.error('Error in studentsByCourseOffering:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.generatePassesByCourseOffering = async (req, res) => { //done
    const {courseOfferingId} = req.params;
    const {passTypeId, passCount, studentIds} = req.body;

    if (!passCount || passCount <= 0) {
        return res.status(400).json({error: 'Valid number of passes is required'});
    }

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({error: 'Valid student IDs are required'});
    }

    try {
        const enrollments = await CourseEnrollment.find({courseOfferingId, role: 'student', userId: {$in: studentIds}});

        if (enrollments.length === 0) {
            return res.status(404).json({error: 'No students found for the given IDs in the specified course offering'});
        }

        const passes = [];
        for (const enrollment of enrollments) {
            for (let i = 0; i < passCount; i++) {
                passes.push({
                    value: generateRandomValue(),
                    courseOfferingId,
                    userId: enrollment.userId,
                    creatorId: req.user.id,
                    passTypeId,
                    status: 'active',
                });
            }
        }

        await FreePassPool.create(passes);

        res.status(201).json({message: `${passCount} passes generated for each student`});
    } catch (error) {
        res.status(500).json({error: error.message});
    }
}


exports.freePassRequest = async (req, res) => { //done
    try {
        const { reason, courseOfferingId, passTypeId } = req.body;
        const userId = req.user.id;

        // Check for existing request with 'requested' status
        const existingRequest = await FreePassRequest.findOne({
            userId,
            status: 'requested',
            courseOfferingId,
            passTypeId: new mongoose.Types.ObjectId(passTypeId)
        });

        if (existingRequest) {
            return res.status(400).json({ error: 'You already have a pending request.' });
        }

        const newRequest = await FreePassRequest.create({ userId, reason, courseOfferingId, passTypeId, status: 'requested' });
        res.status(201).json(newRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}