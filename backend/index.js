const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
const port = 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'freepassdb',
};

// Initialize Sequelize
const sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
  host: dbConfig.host,
  dialect: 'mariadb',
});

// Define Models
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Instructor = sequelize.define('Instructor', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

const Subject = sequelize.define('Subject', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  instructorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Instructor,
      key: 'id',
    },
  },
});

const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subjectId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Subject,
      key: 'id',
    },
  },
});

const FreePass = sequelize.define('FreePass', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Student,
      key: 'id',
    },
  },
  subjectId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Subject,
      key: 'id',
    },
  },
  value: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'requested', // 'granted', 'under review'
  },
}, {
  timestamps: false,
});

// Define Associations
Instructor.hasMany(Subject, { foreignKey: 'instructorId' });
Subject.belongsTo(Instructor, { foreignKey: 'instructorId' });

Subject.hasMany(Student, { foreignKey: 'subjectId' });
Student.belongsTo(Subject, { foreignKey: 'subjectId' });

Student.hasMany(FreePass, { foreignKey: 'studentId' });
FreePass.belongsTo(Student, { foreignKey: 'studentId' });

// Middleware
app.use(bodyParser.json());
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


// Connect to the database and sync
const connectWithRetry = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected!');
    await sequelize.sync({ force: true });
    console.log('Database synced!');
    await seedDatabase(); // Seed the database after syncing
  } catch (err) {
    console.error('Unable to connect to the database:', err);
    setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
  }
};

// Seed the database
const seedDatabase = async () => {
  const hashedPassword = await bcrypt.hash('password', 10);

  // Create instructors
  const [jharana, anisha] = await Instructor.bulkCreate([
    { name: 'Jharana',id: 100 },
    { name: 'Anisha',id: 200},
  ]);

  // Create users for instructors
  await User.bulkCreate([
    { name: 'Jharana', email: 'jharana@example.com', password: hashedPassword, role: 'instructor', id: jharana.id },
    { name: 'Anisha', email: 'anisha@example.com', password: hashedPassword, role: 'instructor', id: anisha.id },
  ]);

  // Create subjects
  const [math, science, english] = await Subject.bulkCreate([
    { name: 'Math', instructorId: jharana.id },
    { name: 'Science', instructorId: jharana.id },
    { name: 'English', instructorId: anisha.id },
  ]);

  // Create students
  const students = await Student.bulkCreate([
    {id:1, name: 'Student1', subjectId: math.id },
    {id:2, name: 'Student2', subjectId: math.id },
    {id:3, name: 'Student3', subjectId: science.id },
    {id:4, name: 'Student4', subjectId: science.id },
    {id:5, name: 'Student5', subjectId: english.id },
    {id:6, name: 'Student6', subjectId: english.id },
  ]);

  // Create users for students
  for (const student of students) {
    await User.create({ name: student.name, email: `${student.name.toLowerCase()}@example.com`, password: hashedPassword, role: 'student', id: student.id });
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
      token
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

app.post('/api/student/:studentId/request-pass', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    const { studentId } = req.params;
    if (req.user.id !== parseInt(studentId)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { subjectId, value } = req.body;
    const newPass = await FreePass.create({ studentId, subjectId, value, status: 'requested' });
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

    const subjects = await Subject.findAll({ where: { instructorId: req.user.id } });
    const subjectIds = subjects.map(subject => subject.id);
    const students = await Student.findAll({ where: { subjectId: subjectIds } });
    const studentIds = students.map(student => student.id);
    const passes = await FreePass.findAll({ where: { studentId: studentIds } });
    res.json(passes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/instructor/:instructorId/requests', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    const { instructorId } = req.params;
    if (req.user.id !== parseInt(instructorId)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const subjects = await Subject.findAll({ where: { instructorId: req.user.id } });
    const subjectIds = subjects.map(subject => subject.id);
    const students = await Student.findAll({ where: { subjectId: subjectIds } });
    const studentIds = students.map(student => student.id);
    const requests = await FreePass.findAll({ where: { studentId: studentIds, status: 'requested' } });
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

app.post('/api/instructor/:instructorId/grant-pass/:id', authenticateJWT, async (req, res) => {
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    const { instructorId } = req.params;
    if (req.user.id !== parseInt(instructorId)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { id } = req.params;
    const { value, comment } = req.body;
    const pass = await FreePass.findOne({ where: { id } });
    const student = await Student.findOne({ where: { id: pass.studentId } });
    const subject = await Subject.findOne({ where: { id: student.subjectId } });

    if (subject.instructorId !== parseInt(instructorId)) {
      return res.status(403).json({ error: 'You are not authorized to grant this pass' });
    }

    const [updated] = await FreePass.update({ value, status: 'granted', comment }, { where: { id } });
    if (updated) {
      const updatedPass = await FreePass.findOne({ where: { id } });
      res.status(200).json(updatedPass);
    } else {
      throw new Error('Pass not found');
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
