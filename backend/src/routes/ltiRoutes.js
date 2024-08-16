const express = require('express');
const router = express.Router();
const coreController = require('../controllers/coreController');
const authenticateJWT = require('../middlewares/authMiddleware');
const ltiController = require("../controllers/ltiController");
const { LTIId, User } = require('../models/models');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');



router.post('/oidc', (req, res) => {
    console.log('OIDC Request Body:', req.body);

    const { client_id, login_hint, lti_message_hint } = req.body;

    // Log received parameters
    console.log('client_id:', client_id);
    console.log('login_hint:', login_hint);
    console.log('lti_message_hint:', lti_message_hint);

    // Use static values if the parameters are missing
    const redirectUri = req.body.redirect_uri || 'https://egp-broker.cs.vt.edu/lti/launch'; // Default redirect URI
    const state = req.body.state || 'static_state_value'; // Example static state
    const nonce = req.body.nonce || 'static_nonce_value'; // Example static nonce

    // Log the static/default values used
    console.log('redirect_uri (used):', redirectUri);
    console.log('state (used):', state);
    console.log('nonce (used):', nonce);

    if (!client_id || !login_hint) {
        console.error('Missing required parameters in OIDC request');
        return res.status(400).send('Missing required parameters in OIDC request');
    }

    // Proceed with generating the ID Token
    const payload = {
        iss: 'https://egp-broker.cs.vt.edu/lti/launch', // Your tool's identifier
        aud: client_id,
        sub: login_hint, // The user identifier, typically passed as `sub` (subject)
        nonce: nonce, // Use the provided or default nonce
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (5 * 60), // Token expiration time
        'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
        'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
        'https://purl.imsglobal.org/spec/lti/claim/deployment_id': 'your_deployment_id', // Deployment ID
        'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': redirectUri, // Use fallback if necessary
    };

    // Sign the ID Token with your private key
    const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAqlv5ttGvzU3cVX0V1katJBnHlAMWl+9lYWc2ntgv865v9Nsj
/tPymEteMTVorCkRU0jvKMi4rUMohBGFdd8IMBBRoCk++N3tP7DkbHmiCVTliBNC
POL7gj7EYK44wTkcTevftKZhXHIONk/vejIymRZwcOijfjIqE/n0AvCR3KMhZFia
MZHLfTg76rx24tSX1hKnMCM9tyrF9SIISE/EGldGfUzpGUU4HsHdL1HsPfhik6qx
B9th6IqeYKOiVCPUesyIKWg4GhsycczPE1lLDkIzscb3SYcNVxcb61iaeCnBQ+ib
0uyP78SxD9sjMhAuRVw5fC2366cLAolOuWGvOwIDAQABAoIBAQCqIWpTijsAVBaL
hXzOXgzBNcGbbi4dE6XyTSo+HfZdbEJAjKz461+lefcaO5VKAUVdIEQ/PZ044w3O
PtVCrra1kUaDJU3PKYqqhZTJQ/tvSEplx53pwmCcZOSnDLZ/OPKsWrgw58vpj7nj
wZaOOR1QxxkJmTrVZ3GgO4nVebyhUuM/TOTsNZBzu4UJnq487TIHB6/qNr33L3Aj
hwBwcQTAi3ZxdoXUoGyqokLAcUfcel/2xPpJZ0OcLFVWj98H2wNqDJyu7qHDRcbf
A6RzV/eMGmgb1/uHqhcyjWBDBTif79nD7FqEIz01v+H0wBDr9d4T6duIvbah2IBK
yyvDdK/hAoGBANhw07PiWyg3+lmhY6VgJQcKsJQsR04HNiUO+37KijpO057KZAmH
YH70LxBczAc8fFuDJXHvZO7oMKODnliPiOUxjzv2YnYfFtjFy/nuZohxA2P9Hem7
VHL6UtsLc3vJAAsZCddq/IfQdsE/r6KVLZ+uqdWwz9wEvN75CF/jKqWrAoGBAMl/
BCpWOoju/poCpRKRMA+COH7wor8SgbeF361xi+0FrDR91N56X3mW6LCgPMXaI2uC
gwtKeeUotcCKTffgDDeDuSWOWHplyRhkBtu6MxCTq5p3UR1L5nOe9SyvozymMC+q
YvvmTjjI2nbdbvzgFps9NwttvMrKimVZr7guA2yxAoGARf9/R/7dsk0gRxp9yn8k
mnlnkBQd32tPpH6K8X95YtAZepJD9hz1JTm9etI4HeL+6O2qD4X3o5guGsO3Uzbg
dBcqFp9hSohVcDfP9v2V5Wx/RzgWE4BFGIZCg5rZd2ATBoPLfgKYtyfBMFBzceZD
AhCP1o8/Og3CM25gufoS0c8CgYBC48OCOnXcF1q1zcL20vPdciFHIqMkQwSE5BBJ
B7SnzoZINq1/3afsOUitucPy+mNfwUe3a9XjWQxdCoyviNUFaNkBuqtslnWXfz03
nCxviFYjRRDMZPHv2AkT+Ip8C79bU3jgnqfA+gxsAT5i/BEFH+EyDg/qUip3Urqe
rce9QQKBgQCae70V7Dbb3e1BZJjm3p1JjMAIFv3NNqHhepWMUSD/PA66d3Ofq0ad
F1KgcjICz9eAjihkP9fzBaTmoCpbhPAfCiu7odxr7jfKUIb7RHxO79Rcc1Appy70
hRlGkMrbNBUxKfMS1Hpiqu0DCu4SAibwXaU8n9nvGV4FMrDU5X0vaQ==
-----END RSA PRIVATE KEY-----`;
    const idToken = jwt.sign(payload, privateKey, { algorithm: 'RS256', keyid: 'your-key-id' });

    // Redirect the user back to the LMS with the ID Token and state
    const redirectUrl = `${redirectUri}?id_token=${idToken}&state=${state}`;
    res.redirect(redirectUrl);
});

router.get('/test', authenticateJWT, ltiController.test);
router.get('/assignments', authenticateJWT, ltiController.assignments);

router.get('/:userId', authenticateJWT, async (req, res) => {
    try {
        const ltiId = req.params.userId; // LTI ID from the request parameter
        const userId = req.user.id; // User ID from JWT token (decoded in middleware)

        // 1. Check if a user with this email exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        console.log('user', user)
        // 2. Check if LTIId entry already exists for this user
        const existingLTIId = await LTIId.findOne({ userId });
        if (existingLTIId) {
            return res.json({ ltiId: existingLTIId.ltiId });
        }

        // 3. If no LTIId entry exists, create one
        const newLTIId = await LTIId.create({
            ltiId,
            userId: user._id,
            client: 'canvas'
        });
        console.log('newLTIId', newLTIId)
        res.json({ ltiId: newLTIId.ltiId });
    } catch (error) {
        console.error('Error fetching or creating LTI ID:', error);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});





module.exports = router;
