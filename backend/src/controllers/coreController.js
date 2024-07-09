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
const authenticateJWT = require("../middlewares/authMiddleware");

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


exports.getPassTypes = async (req, res) => {
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
exports.storePassTypes = async (req, res) => {
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
exports.deletePassType = async (req, res) => {
    try {
        const passType = await PassType.findById(req.params.id);

        if (!passType) {
            return res.status(404).json({error: 'PassType not found'});
        }

        await passType.remove();

        res.status(204).send();
    } catch (error) {
        res.status(500).json({error: error.message});
    }
};

exports.myCourses = async (req, res) => {
    try {
        const userId = req.user.id; // Get the current user ID from the authenticated user

        const enrollments = await CourseEnrollment.find({
            userId: userId, // Filter by the current user's ID
        }).populate({
            path: 'courseOfferingId',
            populate: [
                { path: 'courseId', model: Course },
                { path: 'termId', model: Term }
            ]
        });

        res.json(enrollments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};