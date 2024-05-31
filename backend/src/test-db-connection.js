const { Sequelize } = require('sequelize');

// Database connection details
const sequelize = new Sequelize('freepassdb', 'root', 'password', {
  host: 'db',
  dialect: 'mariadb'
});

// Function to test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error.message);
  } finally {
    await sequelize.close();
  }
};

// Run the test
testConnection();
