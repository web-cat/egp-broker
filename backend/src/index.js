const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
