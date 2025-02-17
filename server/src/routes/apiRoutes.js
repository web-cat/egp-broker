const express = require('express');

const router = express.Router();

// Dummy route for GET request
router.get('/dummy-get', (req, res) => {
    res.json({ message: 'GET request successful' });
});

// Dummy route for POST request
router.post('/dummy-post', (req, res) => {
    res.json({ message: 'POST request successful' });
});

// Dummy route for PUT request
router.put('/dummy-put', (req, res) => {
    res.json({ message: 'PUT request successful' });
});

// Dummy route for DELETE request
router.delete('/dummy-delete', (req, res) => {
    res.json({ message: 'DELETE request successful' });
});

module.exports = router;