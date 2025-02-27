require("dotenv").config();
const jwt = require("jsonwebtoken");

const SECRET_KEY = process.env.SECRET_KEY || "your-secret-key";

function authenticateJWT(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(403).json({ error: "Unauthorized" });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log("Decoded Token:", decoded);
        next();
    } catch (err) {
        res.status(403).json({ error: "Invalid or expired token" });
    }
}

module.exports = {
    authenticateJWT,
};