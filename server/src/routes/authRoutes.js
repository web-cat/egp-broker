const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const path = require('path');
const { Instructor } = require('../models/models');

const router = express.Router();

// Serve signup page
router.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '../pages/signup.html'));
});

// Serve login page
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../pages/login.html'));
});

// Handle signup
router.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    try {
        const instructor = await Instructor.findOne({ email: email.toLowerCase() });

        if (!instructor) {
            return res.status(404).json({ error: 'No instructor found with that email' });
        }

        if (instructor.passwordHash) {
            return res.status(400).json({ error: 'Password already set. Please login.' });
        }

        const hash = await bcrypt.hash(password, 10);
        instructor.passwordHash = hash;
        instructor.isLocalAuthEnabled = true;
        await instructor.save();

        res.json({ success: true, message: 'Password set successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Signup failed' });
    }
});

// Handle login
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, instructor, info) => {
        if (err) return res.status(500).json({ error: 'Login failed' });
        if (!instructor) return res.status(401).json({ error: info.message });

        req.logIn(instructor, (err) => {
            if (err) return res.status(500).json({ error: 'Login failed' });
            res.json({ success: true, redirectUrl: '/dashboard' });
        });
    })(req, res, next);
});

// Get session info (like /lti/info but for direct login)
router.get('/session-info', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    // Hardcoded course for now
    const HARDCODED_COURSE_ID = "100"; // Change to a real course canvas ID from your DB

    const info = {
        name: req.user.firstName + ' ' + req.user.lastName,
        email: req.user.email,
        role: 'Instructor',  // ← Change from array to string
        canvas_user_id: req.user.canvasId,  // ← Flatten structure
        canvas_course_id: HARDCODED_COURSE_ID  // ← Flatten structure
    };

    res.json(info);
});

module.exports = router;