const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { User, Course, CourseEnrollment, PassType, FreePassPool, FreePassRequest, sequelize } = require('./src/db/db');
const { Term, CourseOffering, LTIId } = require('./src/db/db');

const app = express()
const port = 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';


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
        // Disable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        // Drop all tables and recreate them
        await sequelize.drop();
        await sequelize.sync({ force: true });

        // Enable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('Database synced!');
        await seedDatabase();
        res.send('Database seeded');
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


const seedDatabase = async () => {
    try {
        // Disable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        // Drop all tables in correct order
        await sequelize.getQueryInterface().dropAllTables();

        // Enable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        // Recreate tables
        await sequelize.sync({ force: true });

        const hashedPassword = await bcrypt.hash('12345678', 10);

        // Create terms
        const [term1, term2] = await Term.bulkCreate([
            { name: 'Fall 2024' },
            { name: 'Spring 2025' },
        ]);
        const jharana = { id: 101 };
        const anisha = { id: 121 };

        // Create users for instructors
        await User.bulkCreate([
            { name: 'Jharana', email: 'jharana@test.test', password: hashedPassword, id: jharana.id },
            { name: 'Anisha', email: 'anisha@test.test', password: hashedPassword, id: anisha.id },
        ]);

        await PassType.bulkCreate([
            { id: 1, name: 'Default'},
        ]);
        await LTIId.bulkCreate([
            { ltiId: 'jharana_canvas', userId: jharana.id, client: 'canvas' },
            { ltiId: 'anisha_canvas', userId: anisha.id, client: 'canvas' },
        ]);

        // Create courses
        const [math, science, english, cs] = await Course.bulkCreate([
            { name: 'Math' },
            { name: 'Science' },
            { name: 'English' },
            { name: 'Computer Science' },
        ]);

        // Create course offerings with multiple sections
        const [mathFall, scienceFall, englishFall, cs1, cs2, cs3, cs5, cs6] = await CourseOffering.bulkCreate([
            { courseId: math.id, termId: term1.id, sectionNumber: 'A' },
            { courseId: science.id, termId: term1.id, sectionNumber: 'A' },
            { courseId: english.id, termId: term1.id, sectionNumber: 'A' },
            { courseId: cs.id, termId: term1.id, sectionNumber: '1' },
            { courseId: cs.id, termId: term1.id, sectionNumber: '2' },
            { courseId: cs.id, termId: term1.id, sectionNumber: '3' },
            { courseId: cs.id, termId: term1.id, sectionNumber: '5' },
            { courseId: cs.id, termId: term1.id, sectionNumber: '6' },
        ]);

        // Assign instructors to course offerings
        await CourseEnrollment.bulkCreate([
            { userId: jharana.id, courseOfferingId: mathFall.id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: scienceFall.id, role: 'instructor' },
            { userId: anisha.id, courseOfferingId: englishFall.id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: cs1.id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: cs2.id, role: 'ta' },
            { userId: anisha.id, courseOfferingId: cs2.id, role: 'instructor' },
            { userId: anisha.id, courseOfferingId: cs3.id, role: 'instructor' },
            { userId: anisha.id, courseOfferingId: cs5.id, role: 'instructor' },
            { userId: jharana.id, courseOfferingId: cs6.id, role: 'ta' },
        ]);

        // Create students
        const students = [
            { name: 's1', id: 901 },
            { name: 's2', id: 902 },
            { name: 's3', id: 903 },
            { name: 's4', id: 904 },
            { name: 's5', id: 905 },
            { name: 's6', id: 906 },
        ];

        // Create users for students and assign LTI IDs
        for (const student of students) {
            await User.create({ name: student.name, email: `${student.name.toLowerCase()}@test.test`, password: hashedPassword, id: student.id });
            await LTIId.create({ ltiId: `${student.name.toLowerCase()}_canvas`, userId: student.id, client: 'canvas' });
        }

        // Enroll students in course offerings
        const enrollments = [
            { userId: students[0].id, courseOfferingId: mathFall.id, role: 'student' },
            { userId: students[0].id, courseOfferingId: scienceFall.id, role: 'student' },
            { userId: students[1].id, courseOfferingId: englishFall.id, role: 'student' },
            { userId: students[2].id, courseOfferingId: mathFall.id, role: 'student' },
            { userId: students[3].id, courseOfferingId: scienceFall.id, role: 'student' },
            { userId: students[3].id, courseOfferingId: englishFall.id, role: 'student' },
            { userId: students[4].id, courseOfferingId: mathFall.id, role: 'student' },
            { userId: students[5].id, courseOfferingId: englishFall.id, role: 'student' },
            { userId: students[0].id, courseOfferingId: cs1.id, role: 'student' },
            { userId: students[1].id, courseOfferingId: cs2.id, role: 'student' },
            { userId: students[2].id, courseOfferingId: cs3.id, role: 'student' },
            { userId: students[3].id, courseOfferingId: cs5.id, role: 'student' },
            { userId: students[4].id, courseOfferingId: cs6.id, role: 'student' },
        ];

        await CourseEnrollment.bulkCreate(enrollments);

        console.log('Database seeded successfully!');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
};

// Start the connection process
const connectWithRetry = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected!');
        seedDatabase();
        // await sequelize.sync();
        // console.log('Database synced!');
    } catch (err) {
        console.error('Unable to connect to the database:', err);
        setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
    }
};


// Routes

// Health check
app.get('/', async (req, res) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.query('SELECT 1');
        connection.end();
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
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password.' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

        // Fetch user profile data
        const userProfile = {
            id: user.id,
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
        if (req.user.id !== parseInt(studentId)) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const passes = await FreePass.findAll({ where: { studentId } });
        res.json(passes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/courses/', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user.id; // Get the current user ID from the authenticated user

        const enrollments = await CourseEnrollment.findAll({
            where: {
                userId: userId, // Filter by the current user's ID
            },
            attributes: [
                'id', 'role', 'enrolledAt'
            ],
            include: [
                {
                    model: CourseOffering,
                    include: [
                        {
                            model: Course,
                            attributes: ['id', 'name'],
                        },
                        {
                            model: Term,
                            attributes: ['id', 'name'],
                        }
                    ]
                }
            ]
        });

        res.json(enrollments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// students by course offering
app.get('/api/course-offering/:id/students', authenticateJWT, async (req, res) => {
    try {
        const courseOfferingId = req.params.id; // Get the course offering ID from the request parameters

        // Fetch enrollments
        const enrollments = await CourseEnrollment.findAll({
            where: {
                courseOfferingId: courseOfferingId,
                role: 'student', // Ensure the role is specified as a string
            },
            attributes: [
                'id', 'role', 'enrolledAt'
            ],
            include: [
                {
                    model: User,
                    attributes: ['id', 'name'],
                    include: [
                        {
                            model: FreePassPool,
                            attributes: ['id', 'status'],
                        }
                    ],
                }
            ],
        });

        // Fetch count of FreePassPool entries for each user
        const freePassCounts = await sequelize.query(
            `SELECT userId, COUNT(*) as freePassCount
            FROM FreePassPools
            GROUP BY userId`,
            { type: sequelize.QueryTypes.SELECT }
        );

        // Merge the count results with the enrollments
        const enrollmentsWithFreePassCount = enrollments.map(enrollment => {
            const user = enrollment.User;
            const freePassCount = freePassCounts.find(count => count.userId === user.id)?.freePassCount || 0;
            return {
                ...enrollment.toJSON(),
                User: {
                    ...user.toJSON(),
                    freePassCount
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
        const studentId = req.user.id;
        const { } = req.body;
        const newPass = await FreePass.create({ studentId, value: "To be set", status: 'requested' });
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
        if (req.user.id !== parseInt(instructorId)) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        // const subjects = await Subject.findAll({ where: { instructorId: req.user.id } });
        // const subjectIds = subjects.map(subject => subject.id);
        // const students = await Student.findAll({ where: { subjectId: subjectIds } });
        // const studentIds = students.map(student => student.id);
        // const passes = await FreePass.findAll({ where: { studentId: studentIds } });
        res.json(passes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/instructor/requests', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ error: 'Access denied.' });
    }

    try {
        const instructorId = req.user.id; //TODO use this for instructor wise
        const requests = await FreePassRequest.findAll({
            where: {
                status: 'requested',
                '$Course.instructorId$': instructorId
            }, include: [{
                model: Student,
                attributes: ['id', 'name'],
                required: false // Include even if studentId is not present
            }, {
                model: Course,
                attributes: ['id', 'name'],
                required: false,
                // where: { instructorId } 
            }],
        });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/profile', authenticateJWT, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'name', 'email'],
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/instructor/grant-pass/:id/:count', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ error: 'Access denied.' });
    }

    try {
        const instructorId = req.user.id;
        const { id, count } = req.params;
        const pass = await FreePassRequest.findOne({ where: { id } });
        const student = await Student.findOne({ where: { id: pass.studentId } });
        const [updated] = await FreePassRequest.update({ status: 'granted' }, { where: { id } });
        if (updated) {
            const passes = [];

            for (let i = 0; i < count; i++) {
                passes.push({
                    value: generateRandomValue(),
                    studentId: student.id,
                    courseId: pass.courseId,
                    instructorId: instructorId,
                    status: 'active',
                    timestamp: new Date()
                });
            }

            await FreePass.bulkCreate(passes);
            const updatedPass = await FreePass.findOne({ where: { id } });
            res.status(200).json(updatedPass);
        } else {
            throw new Error('Pass not found');
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new free pass
app.post('/api/freepass', authenticateJWT, async (req, res) => {
    // if (req.user.role !== 'instructor') {
    //     return res.status(403).json({ error: 'Access denied. Only instructors can create free passes.' });
    // }

    try {
        const { studentId, value, courseId } = req.body;
        const instructorId = req.user.id;
        const newPass = await FreePass.create({ studentId, instructorId, value, status: 'active', courseId });
        res.status(201).json(newPass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all free passes
app.get('/api/freepass', authenticateJWT, async (req, res) => {
    if (req.user.role == 'instructor') {
        try {
            const instructorId = req.user.id;
            const passes = await FreePass.findAll({
                where: {
                    instructorId: instructorId
                },
                order: [['timestamp', 'DESC']],
                include: [{
                    model: Student,
                    attributes: ['id', 'name'],
                    required: false // Include even if studentId is not present
                }, {
                    model: Course,
                    attributes: ['id', 'name'],
                    required: false
                }]
            });
            res.json(passes);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else if (req.user.role == 'student') {
        try {
            const studentId = req.user.id;
            const passes = await FreePass.findAll({
                where: {
                    studentId: studentId
                },
                order: [['timestamp', 'DESC']],
                include: [{
                    model: Student,
                    attributes: ['id', 'name'],
                    required: false
                }, {
                    model: Course,
                    attributes: ['id', 'name'],
                    required: false
                }
                ]
            });
            res.json(passes);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }



    return res.status(403).json({ error: 'Access denied. Only instructors can view free passes.' });
});

// Get a specific free pass by ID
app.get('/api/freepass/:id', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ error: 'Access denied. Only instructors can view free passes.' });
    }

    try {
        const pass = await FreePass.findByPk(req.params.id);
        if (!pass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }
        res.json(pass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/freepass-use/:id', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Access denied. Only student can use free passes.' });
    }

    try {
        const pass = await FreePass.findByPk(req.params.id);
        if (!pass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }
        if (pass.studentId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. You can only use your own free passes.' });
        }
        pass.status = "used";
        await pass.save();
        res.json(pass);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a free pass by ID
app.put('/api/freepass/:id', authenticateJWT, async (req, res) => {
    // if (req.user.role !== 'instructor') {
    //     return res.status(403).json({ error: 'Access denied. Only instructors can update free passes.' });
    // }

    try {
        const { value, status } = req.body;
        const pass = await FreePass.findByPk(req.params.id);
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

// Delete a free pass by ID
app.delete('/api/freepass/:id', authenticateJWT, async (req, res) => {
    // if (req.user.role !== 'instructor') {
    //     return res.status(403).json({ error: 'Access denied. Only instructors can delete free passes.' });
    // }

    try {
        const pass = await FreePass.findByPk(req.params.id);
        if (!pass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }

        if (pass.instructorId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. You can only delete your own free passes.' });
        }

        await pass.destroy();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//student with passes
app.get('/api/students', authenticateJWT, async (req, res) => {
    // if (req.user.role !== 'instructor') {
    //     return res.status(403).json({ error: 'Access denied. Only instructors can view free passes.' });
    // }

    try {
        const instructorId = req.user.id;

        // Fetch the list of students
        const students = await User.findAll({
            attributes: ['id', 'name', 'email', 'createdAt']
        });

        // Fetch the free passes
        const passes = await FreePass.findAll({
            where: {
                instructorId: instructorId
            },
            order: [['timestamp', 'DESC']]
        });

        // Organize the free passes under each respective student and categorize them by status
        const studentsWithPasses = students.map(student => {
            const studentPasses = passes.filter(pass => pass.studentId === student.id);

            const categorizedPasses = studentPasses.reduce((acc, pass) => {
                const status = pass.status; // Assuming 'status' is a field in FreePass model
                if (!acc[status]) {
                    acc[status] = [];
                }
                acc[status].push(pass);
                return acc;
            }, {});

            return {
                ...student.toJSON(),
                passes: categorizedPasses
            };
        });

        res.json(studentsWithPasses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/freepass/:id/assign/:studentId', authenticateJWT, async (req, res) => {
    // if (req.user.role !== 'instructor') {
    //     return res.status(403).json({ error: 'Access denied. Only instructors can assign students to free passes.' });
    // }

    const { id, studentId } = req.params;

    if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
    }

    try {
        const pass = await FreePass.findByPk(id);
        if (!pass) {
            return res.status(404).json({ error: 'Free pass not found' });
        }

        // Update the pass with the studentId
        pass.studentId = studentId;
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
            where: {
                userId,
                status: 'requested',
                courseOfferingId,
                passTypeId
            }
        });

        if (existingRequest) {
            return res.status(400).json({ error: 'You already have a pending request.' });
        }

        // Create new request if no pending request exists
        const newRequest = await FreePassRequest.create({ userId, reason, courseOfferingId, passTypeId, status: 'requested' });
        res.status(201).json(newRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



function generateRandomValue() {
    return Math.floor(Math.random() * 1000000).toString();
}

// API endpoint to set X number of passes to each student
app.post('/api/generate-passes/:courseOfferingId/:numberOfPasses', authenticateJWT, async (req, res) => {
    // if (req.user.role !== 'instructor') {
    //     return res.status(403).json({ error: 'Access denied. Only instructors can generate passes.' });
    // }
    const { numberOfPasses, courseOfferingId } = req.params;

    if (!numberOfPasses || numberOfPasses <= 0) {
        return res.status(400).json({ error: 'Valid number of passes is required' });
    }

    try {

        const enrollments = await CourseEnrollment.findAll({
            where: {
                courseOfferingId: courseOfferingId,
                role: 'student'
            },
        });

        // Generate and save the specified number of passes for each student
        const passes = [];
        for (const enrollment of enrollments) {
            for (let i = 0; i < numberOfPasses; i++) {
                passes.push({
                    value: generateRandomValue(),
                    courseOfferingId: courseOfferingId,
                    userId: enrollment.userId,
                    creatorId: req.user.id,
                    status: 'active',
                });
            }
        }

        console.log(passes);

        // Bulk create passes in the database
        await FreePassPool.bulkCreate(passes);

        res.status(201).json({ message: `${numberOfPasses} passes generated for each student` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.get('/api/my-courses', authenticateJWT, async (req, res) => {
    try {
        if (req.user.role === 'instructor') {
            const courses = await Course.findAll({
                where: {
                    instructorId: req.user.id
                }
            });
            res.status(200).json(courses);
        } else if (req.user.role === 'student') {
            const enrollments = await CourseEnrollment.findAll({
                where: {
                    studentId: req.user.id
                },
                include: [{
                    model: Course,
                    required: true
                }]
            });

            const courses = enrollments.map(enrollment => enrollment.Course);

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
