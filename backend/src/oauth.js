// oauth.js
const OAuth = require('oauth').OAuth;

const consumer = new OAuth(
    null,
    null,
    process.env.CONSUMER_KEY,
    process.env.CONSUMER_SECRET,
    '1.0',
    null,
    'HMAC-SHA1'
);

const validateRequest = (req, res, next) => {
    const { oauth_signature, ...params } = req.body;
    const url = req.originalUrl;
    const method = req.method;

    // Validate the signature
    consumer._performSecureRequest(
        process.env.CONSUMER_KEY,
        process.env.CONSUMER_SECRET,
        method,
        url,
        params,
        null,
        'application/json',
        (error) => {
            if (error) {
                return res.status(401).json({ error: 'Invalid OAuth signature' });
            }
            next();
        }
    );
};

const signResponse = (url, method, params, callback) => {
    consumer.signUrl(url, process.env.CONSUMER_KEY, process.env.CONSUMER_SECRET, method, params, callback);
};

module.exports = {
    validateRequest,
    signResponse
};
