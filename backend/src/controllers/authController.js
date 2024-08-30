const {
    User,
    Course,
    CourseEnrollment,
    PassType,
    Assignment,
    FreePassPool,
    FreePassRequest,
    PassUsage,
    Term,
    CourseOffering,
    LTIId
} = require('../models/models');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authenticateJWT = require("../middlewares/authMiddleware");
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Register route
exports.register = async (req, res) => {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const newUser = await User.create({ name, email, password: hashedPassword, role });
        res.status(201).json(newUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Login route
exports.login =  async (req, res) => {
    const { email, password } = req.body;
    console.log(email, password);
    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid password.' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

        // Fetch user profile data
        const userProfile = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        res.json({
            user: userProfile,
            token: {
                access_token: token
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};