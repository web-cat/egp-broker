const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from the 'public' directory

const JWT_SECRET = process.env.JWT_SECRET || 'xxx'; 

const sequelize = new Sequelize('freepassdb', 'root', 'password', {
    host: 'db',
    dialect: 'mariadb'
  });
  
// Define the models
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

// Define associations
Instructor.hasMany(Subject, { foreignKey: 'instructorId' });
Subject.belongsTo(Instructor, { foreignKey: 'instructorId' });

Subject.hasMany(Student, { foreignKey: 'subjectId' });
Student.belongsTo(Subject, { foreignKey: 'subjectId' });

Student.hasMany(FreePass, { foreignKey: 'studentId' });
FreePass.belongsTo(Student, { foreignKey: 'studentId' });

// Connect to the main database with retries
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
    { name: 'Jharana' },
    { name: 'Anisha' },
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
    { name: 'Student1', subjectId: math.id },
    { name: 'Student2', subjectId: math.id },
    { name: 'Student3', subjectId: science.id },
    { name: 'Student4', subjectId: science.id },
    { name: 'Student5', subjectId: english.id },
    { name: 'Student6', subjectId: english.id },
  ]);

  // Create users for students
  for (const student of students) {
    await User.create({ name: student.name, email: `${student.name.toLowerCase()}@example.com`, password: hashedPassword, role: 'student', id: student.id });
  }
};

// Middleware to authenticate using JWT
const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(403).send('Access denied.');
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send('Invalid token.');
    }

    req.user = user;
    next();
  });
};

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
    res.json({ token });
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

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
