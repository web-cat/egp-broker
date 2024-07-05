const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mongoose = require('mongoose');
const { User, Course, CourseEnrollment, PassType, Assignment, FreePassPool, FreePassRequest, PassUsage, Term, CourseOffering, LTIId } = require('./src/db/db');
const app = express();
const port = 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

async function canUseFreePass(userId) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const lastUsage = await PassUsage.findOne({
        userId: userId,
        usedAt: { $gte: oneWeekAgo },
    }).sort({ usedAt: -1 });

    return !lastUsage;
}

// Middleware
app.use(bodyParser.json());
app.use(cors());

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(403).send('Access denied.');
    }

    const token = authHeader.split(' ')[1]; // Extract the Bearer token

    if (!token) {
        return res.status(403).send('Invalid token.');
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).send('Invalid token.');
        }

        req.user = user;
        next();
    });
};

// Seed Database route
app.get('/api/seed', async (req, res) => {
    try {
        // Drop all collections and recreate them
        await mongoose.connection.dropDatabase();
        console.log('Database cleared!');
        await seedDatabase();
        res.send('Database seeded');
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const seedDatabase = async () => {
    try {
        const hashedPassword = await bcrypt.hash('12345678', 10);

        // Create terms
        const terms = await Term.create([
            { name: 'Fall 2024' },
            { name: 'Spring 2025' },
        ]);
        const jharana = { id: new mongoose.Types.ObjectId() };
        const anisha = { id: new mongoose.Types.ObjectId() };

        // Create users for instructors
        await User.create([
            { _id: jharana.id, name: 'Jharana', email: 'jharana@test.test', password: hashedPassword },
            { _id: anisha.id, name: 'Anisha', email: 'anisha@test.test', password: hashedPassword },
        ]);

        await LTIId.create([
            { ltiId: 'jharana_canvas', userId: jharana.id, client: 'canvas' },
            { ltiId: 'anisha_canvas', userId: anisha.id, client: 'canvas' },
        ]);

        // Create courses
        const courses = await Course.create([
            { name: 'Math' },
            { name: 'Science' },
            { name: 'English' },
            { name: 'Computer Science' },
        ]);

        // Create course offerings with multiple sections
        const courseOfferings = await CourseOffering.create([
            { courseId: courses[0]._id, termId: terms[0]._id, sectionNumber: 'A' },
            { courseId: courses[1]._id, termId: terms[0]._id, sectionNumber: 'A' },
            { courseId: courses[2]._id, termId: terms[0]._id, sectionNumber: 'A' },
            { courseId: courses[3]._id, termId: terms[0]._id, sectionNumber: '1' },
            { courseId: courses[3]._id, termId: terms[0]._id, sectionNumber: '2' },
            { courseId: courses[3]._id, termId: terms[0]._id, sectionNumber: '3' },
            { courseId: courses[3]._id, termId: terms[0]._id, sectionNumber: '5' },
            { courseId: courses[3]._id, termId: terms[0]._id, sectionNumber: '6' },
        ]);

        // Assign instructors to course offerings
        await CourseEnrollment.create([
            { userId: jharana.id, courseOfferingId: courseOfferings[0]._id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: courseOfferings[1]._id, role: 'instructor' },
            { userId: anisha.id, courseOfferingId: courseOfferings[2]._id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: courseOfferings[3]._id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: courseOfferings[4]._id, role: 'ta' },
            { userId: anisha.id, courseOfferingId: courseOfferings[4]._id, role: 'instructor' },
            { userId: anisha.id, courseOfferingId: courseOfferings[5]._id, role: 'instructor' },
            { userId: anisha.id, courseOfferingId: courseOfferings[6]._id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: courseOfferings[7]._id, role: 'ta' },
        ]);

        // Create students
        const students = [
            { name: 's1', id: new mongoose.Types.ObjectId() },
            { name: 's2', id: new mongoose.Types.ObjectId() },
            { name: 's3', id: new mongoose.Types.ObjectId() },
            { name: 's4', id: new mongoose.Types.ObjectId() },
            { name: 's5', id: new mongoose.Types.ObjectId() },
            { name: 's6', id: new mongoose.Types.ObjectId() },
        ];

        // Create users for students and assign LTI IDs
        for (const student of students) {
            await User.create({ _id: student.id, name: student.name, email: `${student.name.toLowerCase()}@test.test`, password: hashedPassword });
            await LTIId.create({ ltiId: `${student.name.toLowerCase()}_canvas`, userId: student.id, client: 'canvas' });
        }

        // Enroll students in course offerings
        const enrollments = [
            { userId: students[0].id, courseOfferingId: courseOfferings[0]._id, role: 'student' },
            { userId: students[0].id, courseOfferingId: courseOfferings[1]._id, role: 'student' },
            { userId: students[1].id, courseOfferingId: courseOfferings[2]._id, role: 'student' },
            { userId: students[2].id, courseOfferingId: courseOfferings[0]._id, role: 'student' },
            { userId: students[3].id, courseOfferingId: courseOfferings[1]._id, role: 'student' },
            { userId: students[3].id, courseOfferingId: courseOfferings[2]._id, role: 'student' },
            { userId: students[4].id, courseOfferingId: courseOfferings[0]._id, role: 'student' },
            { userId: students[5].id, courseOfferingId: courseOfferings[2]._id, role: 'student' },
            { userId: students[0].id, courseOfferingId: courseOfferings[3]._id, role: 'student' },
            { userId: students[1].id, courseOfferingId: courseOfferings[4]._id, role: 'student' },
            { userId: students[2].id, courseOfferingId: courseOfferings[5]._id, role: 'student' },
            { userId: students[3].id, courseOfferingId: courseOfferings[6]._id, role: 'student' },
            { userId: students[4].id, courseOfferingId: courseOfferings[7]._id, role: 'student' },
        ];

        await CourseEnrollment.create(enrollments);

        // Seed Assignments
        const assignments = [
            {
                courseOfferingId: courseOfferings[0]._id,
                title: 'Math Assignment 1',
                description: 'Solve problems from Chapter 1',
                value: 10,
                status: 'assigned',
                dueAt: new Date('2024-09-30'),
                tags: 'Class'
            },
            {
                courseOfferingId: courseOfferings[1]._id,
                title: 'Science Assignment 1',
                description: 'Write a report on Photosynthesis',
                value: 15,
                status: 'assigned',
                dueAt: new Date('2024-10-05'),
                tags: 'Class'
            },
            {
                courseOfferingId: courseOfferings[2]._id,
                title: 'English Midterm Exam',
                description: 'Complete the midterm exam',
                value: 50,
                status: 'assigned',
                dueAt: new Date('2024-10-15'),
                tags: 'Exam, Term End'
            },
            {
                courseOfferingId: courseOfferings[3]._id,
                title: 'CS Project 1',
                description: 'Build a basic website',
                value: 20,
                status: 'assigned',
                dueAt: new Date('2024-11-01'),
                tags: 'Class'
            }
        ];

        await Assignment.create(assignments);

        // Seed PassTypes
        const passTypes = [
            {
                name: 'General Free Pass',
                tags: 'Class',
                initialCount: 10,
                validityPeriod: 30 // 30 days
            },
            {
                name: 'Exam Pass',
                tags: 'Exam',
                initialCount: 5,
                validityPeriod: 15 // 15 days
            },
            {
                name: 'Term End Pass',
                tags: 'Term End',
                initialCount: 2,
                validityPeriod: 10 // 10 days
            }
        ];

        await PassType.create(passTypes);

        console.log('Database seeded successfully!');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
};

// Connect to MongoDB
const connectWithRetry = async () => {
    const mongoURI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?authSource=admin`;

    try {
        await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('MongoDB connected!');
        seedDatabase();
    } catch (err) {
        console.error('Unable to connect to MongoDB:', err);
        setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
    }
};

// Routes
app.get('/api/pass-types', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id; // Get the authenticated user's ID

        // Fetch pass types where userId is either null (global) or matches the authenticated user's ID
        const passTypes = await PassType.find({
            $or: [
                { userId: null },
                { userId: userId }
            ]
        });

        res.json(passTypes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new PassType
app.post('/api/pass-types', authenticateJWT, async (req, res) => {
    try {
        const { name, description, tags, initialCount, validityPeriod } = req.body;
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
        res.status(500).json({ error: error.message });
    }
});

// Delete a PassType by ID
app.delete('/api/pass-types/:id', authenticateJWT, async (req, res) => {
    try {
        const passType = await PassType.findById(req.params.id);

        if (!passType) {
            return res.status(404).json({ error: 'PassType not found' });
        }

        await passType.remove();

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/', async (req, res) => {
    try {
        await mongoose.connection.db.command({ ping: 1 });
        res.send('OK');
    } catch (error) {
        res.status(500).send('Database connection failed');
    }
});

// Register route
app.post('/api/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const newUser = await User.create({ name, email, password: hashedPassword, role });
        res.status(201).json(newUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password.' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

        // Fetch user profile data
        const userProfile = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        res.json({
            user: userProfile,
            token: {
                access_token: token
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Student Routes
app.get('/api/student/:studentId/passes', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Access denied.' });
    }

    try {
        const { studentId } = req.params;
        if (req.user.id !== studentId) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const passes = await FreePassPool.find({ userId: studentId });
        res.json(passes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/courses/', authenticateJWT, async (req, res) => {
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
});

// Assignments by course offering
app.get('/api/course-offering/:id/assignments', authenticateJWT, async (req, res) => {
    try {
        const courseOfferingId = req.params.id; // Get the course offering ID from the request parameters

        // Fetch assignments
        const assignments = await Assignment.find({ courseOfferingId });

        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Students by course offering
app.get('/api/course-offering/:id/students', authenticateJWT, async (req, res) => {
    try {
        const courseOfferingId = req.params.id; // Get the course offering ID from the request parameters

        // Fetch enrollments
        const enrollments = await CourseEnrollment.find({ courseOfferingId, role: 'student' }).populate('userId');

        // Fetch count of FreePassPool entries for each user, grouped by status
        const freePassCounts = await FreePassPool.aggregate([
            { $group: { _id: '$userId', activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }, usedCount: { $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] } } } }
        ]);

        // Merge the count results with the enrollments
        const enrollmentsWithFreePassCount = enrollments.map(enrollment => {
            const user = enrollment.userId;
            const freePassCount = freePassCounts.find(count => count._id.equals(user._id)) || { activeCount: 0, usedCount: 0 };
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
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/student/request-pass', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Access denied.' });
    }

    try {
        const userId = req.user.id;
        const { courseOfferingId, passTypeId, reason } = req.body;
        const newPass = await FreePassRequest.create({ userId, courseOfferingId, passTypeId, reason, status: 'requested' });
        res.json(newPass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Instructor Routes
app.get('/api/instructor/:instructorId/passes', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ error: 'Access denied.' });
    }

    try {
        const { instructorId } = req.params;
        if (req.user.id !== instructorId) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const passes = await FreePassPool.find({ creatorId: instructorId });
        res.json(passes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/instructor/:courseOfferingId/requests', authenticateJWT, async (req, res) => {
    try {
        const courseOfferingId = req.params.courseOfferingId; // Get the course offering ID from the request parameters
        const requests = await FreePassRequest.find({ status: 'requested', courseOfferingId }).populate('userId').populate('courseOfferingId');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/student/:courseOfferingId/requests', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const courseOfferingId = req.params.courseOfferingId; // Get the course offering ID from the request parameters
        const requests = await FreePassRequest.find({ userId, courseOfferingId }).populate('userId').populate('courseOfferingId').populate('freePassPoolId');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/profile', authenticateJWT, async (req, res) => {
    try {
        const user = await User.findById(req.user.id, { _id: 1, name: 1, email: 1 });
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/instructor/grant-pass/:id/:count', authenticateJWT, async (req, res) => {
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

app.post('/api/instructor/reject-pass/:id', authenticateJWT, async (req, res) => {
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

app.post('/api/freepass', authenticateJWT, async (req, res) => {
    try {
        const { userId, value, courseOfferingId, passTypeId } = req.body;
        const creatorId = req.user.id;
        const newPass = await FreePassPool.create({ userId, value, courseOfferingId, creatorId, passTypeId, status: 'active' });
        res.status(201).json(newPass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/freepass/:courseOfferingId', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseOfferingId } = req.params;
        const passes = await FreePassPool.find({ userId, courseOfferingId }).populate('userId').populate('courseOfferingId').populate('passTypeId');
        res.json(passes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/freepass/:id', authenticateJWT, async (req, res) => {
    try {
        const pass = await FreePassPool.findById(req.params.id).populate('userId').populate('courseOfferingId').populate('passTypeId');
        if (!pass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }
        res.json(pass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/freepass-use/:assignmentId/:id', authenticateJWT, async (req, res) => {
    try {
        const { assignmentId, id } = req.params;
        const userId = req.user.id;

        // Find the FreePassPool
        const freePass = await FreePassPool.findById(id);
        if (!freePass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }

        // Check if the pass belongs to the authenticated user
        if (!freePass.userId.equals(userId)) {
            return res.status(403).json({ error: 'Access denied. You can only use your own free passes.' });
        }

        // Check if the user can use a free pass
        const canUsePass = await canUseFreePass(userId);
        if (!canUsePass) {
            const passUsage = await PassUsage.create({
                freePassId: freePass._id,
                assignmentId: assignmentId,
                status: 'failed',
                usedAt: new Date(),
                userId: userId,
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
            userId: userId,
        });

        res.json(passUsage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/freepass/:id', authenticateJWT, async (req, res) => {
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

app.delete('/api/freepass/:id', authenticateJWT, async (req, res) => {
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

app.get('/api/students', authenticateJWT, async (req, res) => {
    try {
        const students = await User.find({ role: 'student' });

        const passes = await FreePassPool.find({ creatorId: req.user.id }).sort({ timestamp: -1 });

        const studentsWithPasses = students.map(student => {
            const studentPasses = passes.filter(pass => pass.userId.equals(student._id));

            const categorizedPasses = studentPasses.reduce((acc, pass) => {
                const status = pass.status;
                if (!acc[status]) {
                    acc[status] = [];
                }
                acc[status].push(pass);
                return acc;
            }, {});

            return {
                ...student.toObject(),
                passes: categorizedPasses
            };
        });

        res.json(studentsWithPasses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/freepass/:id/assign/:studentId', authenticateJWT, async (req, res) => {
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

app.post('/api/freepassrequest', authenticateJWT, async (req, res) => {
    try {
        const { reason, courseOfferingId, passTypeId } = req.body;
        const userId = req.user.id;

        // Check for existing request with 'requested' status
        const existingRequest = await FreePassRequest.findOne({
            userId,
            status: 'requested',
            courseOfferingId,
            passTypeId
        });

        if (existingRequest) {
            return res.status(400).json({ error: 'You already have a pending request.' });
        }

        const newRequest = await FreePassRequest.create({ userId, reason, courseOfferingId, passTypeId, status: 'requested' });
        res.status(201).json(newRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function generateRandomValue() {
    return Math.floor(Math.random() * 1000000).toString();
}

app.post('/api/generate-passes/:courseOfferingId', authenticateJWT, async (req, res) => {
    const { courseOfferingId } = req.params;
    const { passTypeId, passCount, studentIds } = req.body;

    if (!passCount || passCount <= 0) {
        return res.status(400).json({ error: 'Valid number of passes is required' });
    }

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({ error: 'Valid student IDs are required' });
    }

    try {
        const enrollments = await CourseEnrollment.find({ courseOfferingId, role: 'student', userId: { $in: studentIds } });

        if (enrollments.length === 0) {
            return res.status(404).json({ error: 'No students found for the given IDs in the specified course offering' });
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

        res.status(201).json({ message: `${passCount} passes generated for each student` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/my-courses', authenticateJWT, async (req, res) => {
    try {
        if (req.user.role === 'instructor') {
            const courses = await Course.find({ instructorId: req.user.id });
            res.status(200).json(courses);
        } else if (req.user.role === 'student') {
            const enrollments = await CourseEnrollment.find({ userId: req.user.id }).populate('courseId');
            const courses = enrollments.map(enrollment => enrollment.courseId);
            res.status(200).json(courses);
        } else {
            res.status(403).json({ error: 'Unauthorized access' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the connection process
connectWithRetry();

app.listen(port, () => {
    console.log(`Backend service listening at http://localhost:${port}`);
});
