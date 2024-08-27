// src/db.js
const mongoose = require('mongoose');
const { seedDatabase } = require('./seeder');

const connectWithRetry = async () => {
    // const mongoURI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?authSource=admin`;
    const mongoURI = `mongodb://${process.env.MONGODB_HOST}/asdfdb?authSource=admin`;
    try {
        await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('MongoDB connected!');
    } catch (err) {
        console.error('Unable to connect to MongoDB:', err);
        setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
    }
};

const dropDatabaseAndSeed = async () => {
    try {
        await mongoose.connection.dropDatabase();
        console.log('Database cleared!');
        await seedDatabase();
        console.log('Database seeded!');
    } catch (error) {
        console.error('Error seeding database:', error);
    }
};

module.exports = { connectWithRetry, dropDatabaseAndSeed };
