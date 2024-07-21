const express = require('express');
const bodyParser = require('body-parser');

const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = express();
const port = 3000;
const coreRoutes = require("./src/routes/coreRoutes");
const ltiRoutes = require("./src/routes/ltiRoutes");
const authenticateJWT = require("./src/middlewares/authMiddleware");
const authenticateSeedKey = require("./src/middlewares/seederMiddleware");



async function canUseFreePass(userId) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const lastUsage = await PassUsage.findOne({
        userId: userId,
        usedAt: { $gte: oneWeekAgo },
    }).sort({ usedAt: -1 });

    return !lastUsage;
}

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
} = require("./src/models/models");

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use('/api', coreRoutes);
app.use('/api/lti', ltiRoutes);

// Seed Database route
app.post('/api/seed', authenticateSeedKey, async (req, res) => {
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
                courseOfferingId: courseOfferings[0]._id,
                title: 'Exam Assignment Test',
                description: 'Solve Exam problems from Chapter 1',
                value: 12,
                status: 'assigned',
                dueAt: new Date('2024-09-30'),
                tags: 'Exam'
            },
            {
                courseOfferingId: courseOfferings[0]._id,
                title: 'Exam/Class Assignment Test',
                description: 'Solve Exam/Class problems from Chapter 1',
                value: 22,
                status: 'assigned',
                dueAt: new Date('2024-09-30'),
                tags: 'Exam,Class'
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

        //  Seed PassTypes
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
        // await seedDatabase();
        // console.log('Seed database!');
    } catch (err) {
        console.error('Unable to connect to MongoDB:', err);
        setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
    }
};


// Health check
app.get('/', async (req, res) => {
    try {
        await mongoose.connection.db.command({ ping: 1 });
        res.send('OK');
    } catch (error) {
        res.status(500).send('Database connection failed');
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

app.get('/api/instructor/:courseOfferingId/requests', authenticateJWT, async (req, res) => { //done
    try {
        const courseOfferingId = req.params.courseOfferingId; // Get the course offering ID from the request parameters
        const requests = await FreePassRequest.find({ status: 'requested', courseOfferingId }).populate('userId').populate('courseOfferingId');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/student/:courseOfferingId/requests', authenticateJWT, async (req, res) => { //done
    try {
        const userId = req.user.id;
        const courseOfferingId = req.params.courseOfferingId; // Get the course offering ID from the request parameters
        const requests = await FreePassRequest.find({ userId, courseOfferingId }).populate('userId').populate('courseOfferingId').populate('freePassPoolId');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/profile', authenticateJWT, async (req, res) => { //done
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
// grant pass approve or decline
app.post('/api/instructor/grant-pass/:id/:count', authenticateJWT, async (req, res) => { //done
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

app.post('/api/freepass', authenticateJWT, async (req, res) => { //done
    try {
        const { userId, value, courseOfferingId, passTypeId } = req.body;
        const creatorId = req.user.id;
        const newPass = await FreePassPool.create({ userId, value, courseOfferingId, creatorId, passTypeId, status: 'active' });
        res.status(201).json(newPass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/freepassPool/:courseId', authenticateJWT, async (req, res) => {
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

// to use pass on a assignment by student
app.post('/api/use-pass/:assignmentId/:passValue', authenticateJWT, async (req, res) => { //done
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


app.get('/api/pass-usage-history', authenticateJWT, async (req, res) => {
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

// app.get('/api/freepassPool/:id', authenticateJWT, async (req, res) => {
//     const userId = req.user.id;
//
//     try {
//         const passes = await FreePassPool.findById(req.params.id)
//        // .populate('userId')
// //             .populate('courseOfferingId')
// //             .populate('passTypeId');
//         if (passes.length === 0) {
//             return res.status(404).json({ error: 'No free passes found for this user' });
//         }
//
//         res.json(passes);
//     } catch (error) {
//         console.error('Error fetching free passes:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });

app.get('/api/freepassPool/:id', authenticateJWT, async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.id;
        console.log('courseId is', courseId);
        console.log('userId is', userId);

// Find the course offering by _id
        const courseOffering = await CourseOffering.findOne({ _id: courseId }).populate('courseId');
        console.log('courseOffering', courseOffering);

        if (!courseOffering) {
            return res.status(404).json({ error: 'Course offering not found' });
        }

// Find the free passes associated with the courseOfferingId and userId
        const passes = await FreePassPool.find({
            courseOfferingId: courseOffering._id,
            userId: userId
        })
            .populate('userId')
            .populate({
                path: 'courseOfferingId',
                populate: {
                    path: 'courseId',
                    model: 'Course',
                },
            })
            .populate('passTypeId');

        if (!passes || passes.length === 0) {
            return res.status(404).json({ error: 'Free passes not found' });
        }

        res.json(passes);
    } catch (error) {
        console.error('Error fetching free passes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// pass through assignment
app.post('/api/freepass-use/:assignmentId/:id', authenticateJWT, async (req, res) => { //done
    try {
        const { assignmentId, id } = req.params;
        const userIdFromToken = req.user.id; // Get userId from the token

        // Find the FreePassPool
        const freePass = await FreePassPool.findById(id);
        console.log('freePass::',freePass)
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


app.put('/api/freepass/:id', authenticateJWT, async (req, res) => { //done
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


app.get('/api/students', authenticateJWT, async (req, res) => { //user
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

app.post('/api/freepass/:id/assign/:studentId', authenticateJWT, async (req, res) => { //done
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


function generateRandomValue() {
    return Math.floor(Math.random() * 1000000).toString();
}


// Start the connection process
connectWithRetry();

app.listen(port, () => {
    console.log(`Backend service listening at http://localhost:${port}`);
});
