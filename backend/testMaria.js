const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('ltidb', 'user', 'pass', {
  host: 'localhost',
  dialect: 'mariadb'
});

sequelize.authenticate()
  .then(() => {
    console.log('MariaDB connection successful');
    sequelize.close();
  })
  .catch(err => {
    console.error('MariaDB connection error:', err);
  });
