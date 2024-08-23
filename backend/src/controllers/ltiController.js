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
exports.ltiSetup = async (req, res) => {
    try {

        console.log("==========================================================");

        console.log('LTI Provider deployed on port:', process.env.PORT || 3080);

        LTI.setup(JWT_SECRET, {
            url: `mongodb://${process.env.MONGODB_HOST}/ltidb?authSource=admin`,
            connection: { useNewUrlParser: true, useUnifiedTopology: true }
        }, {
            staticPath: path.join(__dirname, './public'), // Path to static files
            devMode: process.env.DEV_MODE || true // Disable this in production
        }
        );
        console.log('MongoDB URL:', `mongodb://${process.env.MONGODB_HOST}/ltidb?authSource=admin`,);

        LTI.onConnect(async (token, req, res) => {
            console.log('LTI launch successful');
            return res.send('LTI launch successful');
        })

        await LTI.deploy({ port: process.env.LTI_PORT || 3080 }); // Deploy on specified port
        console.log('LTI Provider deployed on port:', process.env.LTI_PORT || 3080);
        await LTI.registerPlatform({
            url: process.env.CANVAS_URL,
            name: process.env.PLATFORM_NAME,
            clientId: process.env.CLIENT_ID,
            authenticationEndpoint: process.env.AUTH_ENDPOINT,
            accesstokenEndpoint: process.env.TOKEN_ENDPOINT,
            authConfig: { method: 'JWK_SET', key: process.env.JWK_KEY }
        });
        console.log('Canvas LMS platform registered');

        // Fetch user information from Canvas LMS
        const accessToken = "7~MAavHVGzvU7r9ZWHRPvQyGzABEUXvJkJ7Avf6VHxJ6ZancV9xZTULEaZtMMYz7AZ"//await getAccessToken();
        const userInfo = await fetchUserInfo(accessToken);

        return res.send(userInfo);

    } catch (error) {
        console.error(error);
        return res.status(500).send(error.message);
    }
};

// Function to get access token
async function getAccessToken() {
    try {
        const response = await axios.post(process.env.TOKEN_ENDPOINT, {
            grant_type: 'client_credentials',
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            scope: 'user:read'
        });
        return response.data.access_token;
    } catch (error) {
        console.log(error);
        return error;
    }

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
        url: process.env.MONGODB_HOST || 'mongodb://mongodb:27017/lti',
        connection: { useNewUrlParser: true, useUnifiedTopology: true }
    }, {
        staticPath: path.join(__dirname, './public'), // Path to static files
        devMode: process.env.DEV_MODE || true // Disable this in production
    }
    );
    await LTI.deploy({ port: process.env.PORT || 3000 }); // Deploy on specified port
    await LTI.registerPlatform({
        url: 'https://canvas.instructure.com', // Replace with your Canvas instance URL
        name: 'Canvas',
        clientId: config.lti.clientId, // Replace with your Client ID
        authenticationEndpoint: 'https://canvas.instructure.com/api/lti/authorize_redirect',
        accesstokenEndpoint: 'https://canvas.instructure.com/login/oauth2/token',
        authConfig: {
        method: 'JWK_SET',
        key: 'https://canvas.instructure.com/api/lti/security/jwks'
        }
        // url: 'http://host.docker.internal:3091',
        // name: 'exampledomain',
        // clientId: '10000000000001',
        // authenticationEndpoint: 'http://host.docker.internal:3091/api/lti/authorize_redirect',
        // accesstokenEndpoint: 'http://host.docker.internal:3091/login/oauth2/token',
        // authConfig: { method: 'JWK_SET', key: 'http://host.docker.internal:3091/api/lti/security/jwks' }
    })
    // await setup();
    return res.send(process.env.CANVAS_URL);
};