const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(403).send('Access denied.');
    }

    const token = authHeader.split(' ')[1]; // Extract the Bearer token
    if (!token) {
        return res.status(403).send('Invalid token.');
    }


    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).send('Invalid token.');
        }

        req.user = user;

        next();
    });
};

module.exports = authenticateJWT;
