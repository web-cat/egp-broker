// src/db.js
const mongoose = require('mongoose');
const { seedDatabase } = require('./seeder');

const connectWithRetry = async () => {
    const mongoURI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}?authSource=admin`;

    try {
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
        });
        console.log('MongoDB connected!');
    } catch (err) {
        console.error('Unable to connect to MongoDB:', err.message);
        console.error('Retrying in 5 seconds...');
        setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
    }

    console.log('mongo url: ', mongoURI);
};

const dropDatabaseAndSeed = async () => {
    try {
        if (mongoose.connection.readyState === 1) { // Ensure the connection is established
            await mongoose.connection.dropDatabase();
            console.log('Database cleared!');
            await seedDatabase();
            console.log('Database seeded!');
        } else {
            console.error('Database is not connected. Cannot clear and seed.');
        }
    } catch (error) {
        console.error('Error seeding database:', error.message);
    }
};

module.exports = { connectWithRetry, dropDatabaseAndSeed };
