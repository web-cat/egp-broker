const jwt = require('jsonwebtoken');
const { JWT_SECRET } = process.env;

const authenticateAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Extract token from Bearer header

    if (!token) {
        return res.status(401).json({ error: 'No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid token.' });
        }

        req.admin = decoded; // Attach decoded token to request object
        next();
    });
};

module.exports = authenticateAdmin;
