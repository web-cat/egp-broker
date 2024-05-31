const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const port = 3000;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'myuser',
  password: process.env.DB_PASSWORD || 'mypassword',
  database: process.env.DB_NAME || 'mydatabase',
};

app.get('/', async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.query('SELECT 1');
    connection.end();
    res.send('OK');
  } catch (error) {
    res.status(500).send('Database connection failed');
  }
});

app.listen(port, () => {
  console.log(`Backend service listening at http://localhost:${port}`);
});
