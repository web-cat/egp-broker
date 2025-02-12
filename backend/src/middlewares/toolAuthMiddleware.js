const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const authenticateToolJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    next();
};

module.exports = authenticateToolJWT;
