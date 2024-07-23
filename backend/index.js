const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const port = 3000;
const coreRoutes = require("./src/routes/coreRoutes");
const freePassRoutes = require("./src/routes/freePassRoutes");
const ltiRoutes = require("./src/routes/ltiRoutes");
const authenticateJWT = require("./src/middlewares/authMiddleware");
const authenticateSeedKey = require("./src/middlewares/seederMiddleware");
const { connectWithRetry, dropDatabaseAndSeed } = require("./src/db"); // Import the new file


// Middleware
app.use(bodyParser.json());
app.use(cors());
// Routes
app.use(freePassRoutes);
app.use('/api', coreRoutes);
app.use('/api/lti', ltiRoutes);

// Seed Database route
app.post('/api/seed', authenticateSeedKey, async (req, res) => {
    try {
        await dropDatabaseAndSeed();
        res.send('Database seeded');
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Connect to MongoDB
connectWithRetry();

// Health check
app.get('/', async (req, res) => {
    try {
        await mongoose.connection.db.command({ ping: 1 });
        res.send('OK');
    } catch (error) {
        res.status(500).send('Database connection failed');
    }
});

app.listen(port, () => {
    console.log(`Backend service listening at http://localhost:${port}`);
});
