const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your_jwt_secret';

const STATIC_ADMIN = {
    id: '64f90d52a2b3c202f6478d65',
    name: 'Admin User',
    email: 'admin@test.test',
    password: '12345678'
};

// Admin login
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Check if the provided email and password match the static details
    if (email !== STATIC_ADMIN.email || password !== STATIC_ADMIN.password) {
        return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: STATIC_ADMIN.id, email: STATIC_ADMIN.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({
        user: {
            id: STATIC_ADMIN.id,
            name: STATIC_ADMIN.name,
            email: STATIC_ADMIN.email
        },
        token: {
            access_token: token
        }
    });
});

module.exports = router;
