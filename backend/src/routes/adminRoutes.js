const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const { Admin } = require("../models/models");

// Admin login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        // Find the admin document in MongoDB
        const admin = await Admin.findOne({ email });

        if (!admin) { 
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Compare the provided password with the hashed password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Generate JWT token
        const token = jwt.sign({ id: admin._id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({
            user: {
                id: admin._id,
                name: admin.name,
                email: admin.email
            },
            token: {
                access_token: token
            }
        });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;