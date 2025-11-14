const express = require('express');
const passport = require('passport');
const bcrypt = require('bcrypt');
const path = require('path');
const { Instructor } = require('../models/models');
const { validateVTPassword } = require('../utils/passwordValidator');

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

    // Validate password
    const passwordValidation = validateVTPassword(password);
    if (!passwordValidation.valid) {
        return res.status(400).json({
            error: 'Password does not meet VT requirements',
            details: passwordValidation.errors
        });
    }

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
            res.json({ success: true, redirectUrl:  '/select-course' }); //redirect instructors to select course
        });
    })(req, res, next);
});

router.post('/set-course', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { courseCanvasId } = req.body;

    if (!courseCanvasId) {
        return res.status(400).json({ error: 'Course ID required' });
    }

    // Store in session
    req.session.selectedCourseCanvasId = courseCanvasId;

    res.json({ success: true });
});

// Get session info (like /lti/info but for direct login)
router.get('/session-info', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const info = {
        name: req.user.firstName + ' ' + req.user.lastName,
        email: req.user.email,
        role: 'Instructor',
        canvas_user_id: req.user.canvasId,
        canvas_course_id: req.session.selectedCourseCanvasId
    };

    res.json(info);
});

module.exports = router;