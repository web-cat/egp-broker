require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const lti = require('ltijs').Provider;
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect('mongodb://user:pass@mongodb:27017/ltidb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  authSource: "admin"
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Initialize Sequelize for your main database
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mariadb'
});

// Define the FreePass model
const FreePass = sequelize.define('FreePass', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  value: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false,
});

// Connect to the main database with retries
const connectWithRetry = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected!');
    await sequelize.sync();
  } catch (err) {
    console.error('Unable to connect to the database:', err);
    setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
  }
};

// LTI provider setup
lti.setup(process.env.LTI_KEY, {
  url: 'mongodb://user:pass@mongodb:27017/ltidb',
  connection: { user: process.env.DB_USER, pass: process.env.DB_PASS }
}, {
  staticPath: path.join(__dirname, 'public'),
  cookies: { secure: false, sameSite: '' },
  devMode: true
});

// When receiving successful LTI launch redirects to app
lti.onConnect(async (token, req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// When receiving deep linking request redirects to deep screen
lti.onDeepLinking(async (token, req, res) => {
  const items = [
    {
      type: 'ltiResourceLink',
      title: 'My LTI Tool',
      url: `${process.env.CANVAS_URL}/`,
      custom: {
        value1: 'customValue1',
      },
    },
  ];
  return lti.redirect(res, '/deeplink', { items });
});

const setup = async () => {
  await lti.deploy({
    port: process.env.PORT || 3000
  });

  connectWithRetry();
  console.log(`Server and LTI provider are running on port ${process.env.PORT || 3000}`);
};

setup();

// Routes for FreePass operations
app.post('/api/freepass', async (req, res) => {
  try {
    const { value } = req.body;
    const freePass = await FreePass.create({ value });
    res.json(freePass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/freepass', async (req, res) => {
  try {
    const freePasses = await FreePass.findAll();
    res.json(freePasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api.freepass/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;
    const [updated] = await FreePass.update({ value }, { where: { id } });
    if (updated) {
      const updatedFreePass = await FreePass.findOne({ where: { id } });
      res.status(200).json(updatedFreePass);
    } else {
      res.status(404).send('FreePass not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/freepass/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await FreePass.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      res.status(404).send('FreePass not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/add', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add.html'));
});
