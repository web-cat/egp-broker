const path = require('path');
const mongoose = require("mongoose");
const axios = require('axios');
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
            url: process.env.MONGO_URL || 'mongodb://root:rootpassword@mongodb:27017/ltidb?authSource=admin',
            connection: { useNewUrlParser: true, useUnifiedTopology: true }
        }, {
            staticPath: path.join(__dirname, './public'), // Path to static files
            devMode: process.env.DEV_MODE || true // Disable this in production
        }
    );
    await LTI.deploy({ port: process.env.PORT || 3080 }); // Deploy on specified port
    await LTI.registerPlatform({
        url: process.env.CANVAS_URL,
        name: process.env.PLATFORM_NAME,
        clientId: process.env.CLIENT_ID,
        authenticationEndpoint: process.env.AUTH_ENDPOINT,
        accesstokenEndpoint: process.env.TOKEN_ENDPOINT,
        authConfig: { method: 'JWK_SET', key: process.env.JWK_KEY }
    });
    // Fetch user information from Canvas LMS
    const accessToken = await getAccessToken();
    const userInfo = await fetchUserInfo(accessToken);

    return res.send(userInfo);
};

// Function to get access token
async function getAccessToken() {
    const response = await axios.post(process.env.TOKEN_ENDPOINT, {
        grant_type: 'client_credentials',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        scope: 'user:read'
    });
    return response.data.access_token;
}

// Function to fetch user information
async function fetchUserInfo(accessToken) {
    const response = await axios.get(`${process.env.CANVAS_URL}/api/v1/users/self`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return response.data;
}

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
        authConfig: {method: 'JWK_SET', key: 'http://host.docker.internal:3091/api/lti/security/jwks'}
    })
    // await setup();
    return res.send(process.env.CANVAS_URL);
};