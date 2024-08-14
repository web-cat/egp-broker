const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();
const port = 3000;
const coreRoutes = require("./src/routes/coreRoutes");
const freePassRoutes = require("./src/routes/freepassRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const ltiRoutes = require("./src/routes/ltiRoutes");
const toolRoutes = require("./src/routes/toolRoutes");

const authenticateJWT = require("./src/middlewares/authMiddleware");
const authenticateSeedKey = require("./src/middlewares/seederMiddleware");
const { connectWithRetry, dropDatabaseAndSeed } = require("./src/db"); // Import the new file

const OAuthServer = require('express-oauth-server');
const model = require('./src/models/oauth-model');
// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

app.oauth = new OAuthServer({
    model: model,
    grants: ['password'],
    debug: true
});

app.post('/egp-broker-service/oauth/token', (req, res, next) => {
    console.log('Token request received:', req.body);
    return app.oauth.token()(req, res, next);
});

app.get('/egp-broker-service/secure', app.oauth.authenticate(), (req, res) => {
    res.send('Secured with OAuth!');
});
// Routes
app.use('/egp-broker-service', freePassRoutes);
app.use('/egp-broker-service/api', coreRoutes);
app.use('/egp-broker-service/api/admin', adminRoutes);
app.use('/egp-broker-service/api/tool', toolRoutes);

app.use('/egp-broker-service/api/lti', ltiRoutes);

// Seed Database route
app.post('/egp-broker-service/api/seed', authenticateSeedKey, async (req, res) => {
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
app.get('/egp-broker-service', async (req, res) => {
    try {
        await mongoose.connection.db.command({ ping: 1 });
        res.send('OK');
    } catch (error) {
        res.status(500).send('Database connection failed');
    }
});

//app.use('/egp-broker-service', app);

app.listen(port, () => {
    console.log(`Backend service listening at http://localhost:${port}`);
});
