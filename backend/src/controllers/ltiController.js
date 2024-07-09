const path = require('path');
const LTI = require('ltijs').Provider;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// // Configure ltijs
// // When receiving successful LTI launch
// LTI.onConnect((token, req, res) => {
//     // Your custom logic for LTI launch
//     return res.send('LTI launch successful');
// });

// Function to test setup
exports.test = async (req, res) => {
    LTI.setup(JWT_SECRET, {
            url: process.env.MONGO_URL || 'mongodb://mongodb:27017/lti',
            connection: {useNewUrlParser: true, useUnifiedTopology: true}
        }, {
            staticPath: path.join(__dirname, './public'), // Path to static files
            devMode: process.env.DEV_MODE || true // Disable this in production
        }
    );
    await LTI.deploy({port: process.env.PORT || 3080}); // Deploy on specified port
    await LTI.registerPlatform({
        url: 'http://host.docker.internal:3091',
        name: 'exampledomain',
        clientId: '10000000000001',
        authenticationEndpoint: 'http://host.docker.internal:3091/api/lti/authorize_redirect',
        accesstokenEndpoint: 'http://host.docker.internal:3091/login/oauth2/token',
        authConfig: { method: 'JWK_SET', key: 'http://host.docker.internal:3091/api/lti/security/jwks' }
    })
    // await setup();
    return res.send(process.env.CANVAS_URL);
};

exports.assignments = async (req, res) => {
    LTI.setup(JWT_SECRET, {
            url: process.env.MONGO_URL || 'mongodb://mongodb:27017/lti',
            connection: {useNewUrlParser: true, useUnifiedTopology: true}
        }, {
            staticPath: path.join(__dirname, './public'), // Path to static files
            devMode: process.env.DEV_MODE || true // Disable this in production
        }
    );
    await LTI.deploy({port: process.env.PORT || 3000}); // Deploy on specified port
    await LTI.registerPlatform({
        url: 'http://host.docker.internal:3091',
        name: 'exampledomain',
        clientId: '10000000000001',
        authenticationEndpoint: 'http://host.docker.internal:3091/api/lti/authorize_redirect',
        accesstokenEndpoint: 'http://host.docker.internal:3091/login/oauth2/token',
        authConfig: { method: 'JWK_SET', key: 'http://host.docker.internal:3091/api/lti/security/jwks' }
    })
    // await setup();
    return res.send(process.env.CANVAS_URL);
};