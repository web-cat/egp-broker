const mongoose = require('mongoose');

const mongoURI = 'mongodb://user:pass@localhost:27017/ltidb?authSource=admin';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connection successful');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
