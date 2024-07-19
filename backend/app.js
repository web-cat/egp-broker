const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const config = require('./config/config');
const freepassRoutes = require('./routes/freepassRoutes');
const { lti, registerPlatform } = require('./services/ltiService');

const app = express();

app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(config.mongo.uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  authSource: "admin"
}).then(() => {
  console.log('MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Routes
app.use('/api/freepass', freepassRoutes);

// Deploy LTI and application
const setup = async () => {
  await lti.deploy({
    port: config.port
  });

  await registerPlatform();
  console.log(`Server and LTI provider are running on port ${config.port}`);
};

setup();
