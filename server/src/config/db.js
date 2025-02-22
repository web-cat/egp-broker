mongoose = require('mongoose');

const connectWithRetry = async () => {
    const mongoURI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME_EGP}?authSource=admin`;

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

module.exports = connectWithRetry;