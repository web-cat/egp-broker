const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { User, Student, Instructor, Subject, Course, CourseEnrollment, FreePass, FreePassRequest, sequelize } = require('./src/db/db');

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
        await sequelize.sync({ force: true });
        console.log('Database synced!');
        await seedDatabase();
        res.send('Database seeded');
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const seedDatabase = async () => {
    const hashedPassword = await bcrypt.hash('password', 10);

    // Create instructors
    const [jharana, anisha] = await Instructor.bulkCreate([
        { name: 'Jharana', id: 100 },
        { name: 'Anisha', id: 101 },
    ]);

    // Create users for instructors
    await User.bulkCreate([
        { name: 'Jharana', email: 'jharana@example.com', password: hashedPassword, role: 'instructor', id: jharana.id },
        { name: 'Anisha', email: 'anisha@example.com', password: hashedPassword, role: 'instructor', id: anisha.id },
    ]);

    // Create courses
    const [math, science, english] = await Course.bulkCreate([
        { name: 'Math', instructorId: jharana.id },
        { name: 'Science', instructorId: jharana.id },
        { name: 'English', instructorId: anisha.id },
    ]);

    // Create students
    const students = await Student.bulkCreate([
        { name: 'Student1' },
        { name: 'Student2' },
        { name: 'Student3' },
        { name: 'Student4' },
        { name: 'Student5' },
        { name: 'Student6' },
    ]);

    // Create users for students
    for (const student of students) {
        await User.create({ name: student.name, email: `${student.name.toLowerCase()}@example.com`, password: hashedPassword, role: 'student', id: student.id });
    }

    // Enroll students in courses
    const enrollments = [
        { studentId: students[0].id, courseId: math.id },
        { studentId: students[0].id, courseId: science.id },
        { studentId: students[1].id, courseId: english.id },
        { studentId: students[2].id, courseId: math.id },
        { studentId: students[3].id, courseId: science.id },
        { studentId: students[3].id, courseId: english.id },
        { studentId: students[4].id, courseId: math.id },
        { studentId: students[5].id, courseId: english.id },
    ];

    await CourseEnrollment.bulkCreate(enrollments);
};

// Start the connection process
const connectWithRetry = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected!');
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
            attributes: ['id', 'name', 'email', 'role'],
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
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ error: 'Access denied. Only instructors can create free passes.' });
    }

    try {
        const { studentId, value, courseId } = req.body;
        const instructorId = req.user.id;
        const newPass = await FreePass.create({ studentId, instructorId, value, status: 'active',courseId });
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
                },{
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
                },{
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
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ error: 'Access denied. Only instructors can update free passes.' });
    }

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
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ error: 'Access denied. Only instructors can delete free passes.' });
    }

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
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ error: 'Access denied. Only instructors can view free passes.' });
    }

    try {
        const instructorId = req.user.id;

        // Fetch the list of students
        const students = await User.findAll({
            where: {
                role: 'student'
            },
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
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ error: 'Access denied. Only instructors can assign students to free passes.' });
    }

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
        const { reason, courseId } = req.body;
        const studentId = req.user.id;

        // Check for existing request with 'requested' status
        const existingRequest = await FreePassRequest.findOne({
            where: {
                studentId,
                status: 'requested',
                courseId
            }
        });

        if (existingRequest) {
            return res.status(400).json({ error: 'You already have a pending request.' });
        }

        // Create new request if no pending request exists
        const newRequest = await FreePassRequest.create({ studentId, reason, courseId, status: 'requested' });
        res.status(201).json(newRequest);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



function generateRandomValue() {
    return Math.floor(Math.random() * 1000000).toString();
}

// API endpoint to set X number of passes to each student
app.post('/api/generate-passes/:courseId/:numberOfPasses', authenticateJWT, async (req, res) => {
    if (req.user.role !== 'instructor') {
        return res.status(403).json({ error: 'Access denied. Only instructors can generate passes.' });
    }

    const { numberOfPasses, courseId } = req.params;

    if (!numberOfPasses || numberOfPasses <= 0) {
        return res.status(400).json({ error: 'Valid number of passes is required' });
    }

    try {
        // Fetch all students
        const students = await User.findAll({
            where: {
                role: 'student'
            }
        });

        const enrollments = await CourseEnrollment.findAll({
            where: {
                courseId: courseId
            },
            include: [{
                model: Course,
                required: true
            }]
        });

        // Generate and save the specified number of passes for each student
        const passes = [];
        for (const enrollment of enrollments) {
            for (let i = 0; i < numberOfPasses; i++) {
                passes.push({
                    value: generateRandomValue(),
                    courseId: courseId,
                    studentId: enrollment.studentId,
                    instructorId: req.user.id, // Assuming the passes are assigned by the current instructor
                    status: 'active', // Default status, adjust as needed
                    timestamp: new Date()
                });
            }
        }

        // Bulk create passes in the database
        await FreePass.bulkCreate(passes);

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
