const express = require('express');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from the 'public' directory

// Initialize Sequelize for your main database
const sequelize = new Sequelize('freepassdb', 'root', 'password', {
  host: 'db',
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

app.put('/api/freepass/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;
    const [updated] = await FreePass.update({ value }, { where: { id } });
    if (updated) {
      const updatedFreePass = await FreePass.findOne({ where: { id } });
      res.status(200).json(updatedFreePass);
    } else {
      throw new Error('FreePass not found');
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
      throw new Error('FreePass not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/add', (req, res) => {
  res.sendFile(__dirname + '/public/add.html');
});

// Start the connection process
connectWithRetry();

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
