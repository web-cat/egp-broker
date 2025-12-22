const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const url = require('url');
const lti = require('ltijs').Provider;
const jwksClient = require('jwks-rsa');

if (!global.ltikMap) global.ltikMap = {};

// --- CONFIGURATION ---
// NOTE: These should ideally be read from env variables!
const proxyBaseUrl = 'https://lightly-liberal-wasp.ngrok-free.app';  
const opendsaUrl = 'https://opendsax.cs.vt.edu/lti13/launches'; // Target LTI Launch URL
const opendsaClientId = '16'; // Target Tool's Client ID (Your proxy's Client ID on OpenDSA)
const proxyClientId = '16'; //tools id on proxy's database

// --- JWKS Client for OpenDSA ---
// This fetches OpenDSA's public keys to verify their signatures
const client = jwksClient({
  jwksUri: 'https://opendsax.cs.vt.edu/lti13/.well-known/jwks?lms_instance_id=16', // OpenDSA JWKS endpoint
  requestHeaders: {
    'Accept': 'application/json' // This tells Rails to process as JSON, not HTML
  },
  cache: true,
  rateLimit: true
});

async function getOpenDSAKey(header, callback) {
  try {
    // Instead of getSigningKey(header.kid), get ALL keys
    const keys = await client.getSigningKeys(); 
    
    // Just take the first key in the list (since OpenDSA only provides one)
    const signingKey = keys[0].getPublicKey(); 
    
    console.log("Forcing verification using key:", keys[0].kid);
    callback(null, signingKey);
  } catch (err) {
    console.error("Error retrieving keys from OpenDSA:", err.message);
    callback(err);
  }
}

/**
 * HANDLER 1: GET Request (Internal Redirect from LTI Provider/Canvas)
 */
router.get('/lti13', async (req, res) => {
    console.log("GET /lti13");
    console.log("RESULTS:", res.locals.token);
    //console.log("REQUEST:", req);
    // Assuming this code runs inside the lti.onConnect() handler
    // where 'res.locals.token' is the validated LTI token from Canvas.
    const incomingToken = res.locals.token;
    const originalEndpoint = incomingToken.platformContext.endpoint;

    //data to be referenced on return
    const ltik = res.locals.ltik;
    const originalLineItemUrl = originalEndpoint.lineitem;

    console.log("TEST", req.query.ltik);
    console.log("LTIK", ltik);

    if (!ltik) {
        return res.status(500).send('LTI session key (ltik) not found.');
    }

    // Store the ltik, associating it with the user ID.
    global.ltikMap[incomingToken.user] = {
        ltik: ltik,
        canvasGradeUrl: originalLineItemUrl
    };

    const lineItemId = originalLineItemUrl.split('/').pop(); // Extracts '526'
    const proxyGradeEndpointUrl = `${proxyBaseUrl}/launches/grades/callback/${lineItemId}`;

    const bookPath = incomingToken.platformContext.targetLinkUri.match(/custom_book_path=([^&]+)/)?.[1];
    const queryParams = incomingToken.platformContext.targetLinkUri.substring(incomingToken.platformContext.targetLinkUri.indexOf('?'));



    const launchPayload = {
        // --- OIDC / JWT Claims ---
        iss: proxyBaseUrl,
        aud: opendsaClientId,
        sub: incomingToken.user,
        nonce: crypto.randomBytes(16).toString('hex'), // Must be newly generated
        login_hint: incomingToken.user, // Re-use the user ID for the login_hint
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,

        // --- LTI Core Claims ---
        'https://purl.imsglobal.org/spec/lti/claim/message_type': 'LtiResourceLinkRequest',
        'https://purl.imsglobal.org/spec/lti/claim/version': '1.3.0',
        'https://purl.imsglobal.org/spec/lti/claim/deployment_id': opendsaClientId,
        'https://purl.imsglobal.org/spec/lti/claim/target_link_uri': opendsaUrl + queryParams,

        // --- Context & Resource Link Claims ---
        'https://purl.imsglobal.org/spec/lti/claim/resource_link': {
        id: incomingToken.platformContext.resource.id,
        title: incomingToken.platformContext.resource.title
        },
        'https://purl.imsglobal.org/spec/lti/claim/context': incomingToken.platformContext.context,
        'https://purl.imsglobal.org/spec/lti/claim/roles': incomingToken.platformContext.roles,
        'https://purl.imsglobal.org/spec/lti/claim/email': incomingToken.userInfo.email,


        // --- User Info Claims ---
        given_name: incomingToken.userInfo.given_name,
        family_name: incomingToken.userInfo.family_name,
        name: incomingToken.userInfo.name,
        email: incomingToken.userInfo.email,

        // --- Launch Presentation ---
        'https://purl.imsglobal.org/spec/lti/claim/launch_presentation': incomingToken.platformContext.launchPresentation,

        //endpoint
        'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint': {
            lineitem: proxyGradeEndpointUrl,
            scope: incomingToken.platformContext.endpoint.scope,
            lineitems: incomingToken.platformContext.endpoint.lineitems
        },

        'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice': incomingToken.platformContext.namesRoles,

        // Custom/Deep Linking Claims for OpenDSA (if needed)
        'https://purl.imsglobal.org/spec/lti/claim/custom': {
            // Use custom claims to pass OpenDSA-specific parameters
            custom_ex_short_name: bookPath,
            ...incomingToken.platformContext.custom
        }
    };

    // The final step: generate the OIDC response and auto-submit the form
    const platform = await lti.getPlatform(opendsaUrl, proxyClientId);
    console.log("PLATFORM", platform);
    // Get the necessary values using the Platform class methods:
    const privateKey = await platform.platformPrivateKey();
    const kid = await platform.platformKid();
    console.log("\nPLATFORM INFO ", privateKey, kid, "\n");
    //const authEndpoint = await platform.platformAuthenticationEndpoint();
    //const client_id = await platform.platformClientId(); // Your proxy's Client ID on OpenDSA


    // Sign the JWT using the private key and kid retrieved from the Platform object
    const signedJwt = jwt.sign(launchPayload, privateKey, {
        algorithm: 'RS256',
        keyid: kid,
        //noTimestamp: true
    });

    //state JWT
    const statePayload = {
        // Must contain the tool_id OpenDSA expects
        tool_id: opendsaClientId, 
        // Standard JWT/OIDC claims
        iss: proxyBaseUrl, 
        aud: opendsaClientId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300, // Short lifespan
        nonce: crypto.randomBytes(8).toString('hex') 
    };

    // NOTE: This State-JWT must be signed using the same key pair as the LTI id_token
    // Use the same signing function/keys as your primary LTI JWT
    const state = jwt.sign(statePayload, privateKey, {
        algorithm: 'RS256',
        keyid: kid,
        //noTimestamp: true
    });


    const redirectUri = 'https://opendsax.cs.vt.edu/lti13/launches'; // Must be a pre-registered LTI redirect URI on OpenDSA

    // The response is an HTML form that auto-submits to the OpenDSA authentication endpoint
    const htmlForm = `
        <html>
            <head>
                <title>LTI 1.3 Launch</title>
            </head>
            <body onload="document.forms[0].submit()">
                <form action="${opendsaUrl}" method="POST">
                    <input type="hidden" name="id_token" value="${signedJwt}"/>
                    <input type="hidden" name="state" value="${state}"/>
                    <input type="hidden" name="redirect_uri" value="${redirectUri}"/>
                    <noscript>
                        <p>Please click the button to continue to OpenDSA.</p>
                        <input type="submit" value="Continue"/>
                    </noscript>
                </form>
            </body>
        </html>
    `;

    console.log("LAUNCH PAYLOAD: ", launchPayload);
    console.log("HTML ", htmlForm);

    return res.send(htmlForm);

});


/**
 * HANDLER 3: POST Request (AGS Grade Callback from OpenDSA)
 * This is the endpoint that OpenDSA will call to send a grade.
 */
router.post('/grades/callback', async (req, res) => {
    try {
        // 1. Parse the grade payload from OpenDSA
        // The body format is defined by the LTI AGS spec (a 'score' object)
        const gradeFromOpenDSA = req.body;
        
        console.log("Received grade callback from OpenDSA:", gradeFromOpenDSA);

        // OpenDSA MUST send back the 'userId'. This 'userId' is the
        // 'sub' (sub: incomingToken.user) that your proxy sent in the launch.
        const canvasUserId = gradeFromOpenDSA.userId; 

        if (!canvasUserId) {
            console.error("Grade callback missing 'userId'");
            return res.status(400).send("Bad Request: Missing 'userId' in grade payload.");
        }

        // 2. Prepare the grade object in the format Canvas expects
        const gradeForCanvas = {
            scoreGiven: gradeFromOpenDSA.scoreGiven,     // e.g., 85
            scoreMaximum: gradeFromOpenDSA.scoreMaximum, // e.g., 100
            userId: canvasUserId,                        // The User ID for Canvas
            activityProgress: 'Completed',
            gradingProgress: 'FullyGraded'
            // You can also add 'comment': gradeFromOpenDSA.comment
        };

        // 3. Find the original 'ltik' needed to talk to Canvas
        const ltik = global.ltikMap[canvasUserId];

        if (!ltik) {
            console.error(`Could not find ltik for user ${canvasUserId}. Session might be lost.`);
            // Note: This is why a global var is bad. Use a real database!
            return res.status(404).send('User session not found by proxy.');
        }

        // 4. Use ltijs to securely send the grade to Canvas
        console.log(`Forwarding grade for user ${canvasUserId} to Canvas...`);
        
        // This magic 'ltijs' function handles all the security,
        // gets a new access token, and sends the grade to the
        // 'lineitem' URL that Canvas originally provided.
        await lti.Grade.submitScore(ltik, gradeForCanvas);
        
        // 5. Tell OpenDSA that you successfully received the grade
        console.log("Grade forwarded successfully.");
        res.status(200).send('Grade received by proxy and forwarded to Canvas.');

    } catch (err) {
        console.error('Grade passback proxy failed:', err);
        res.status(500).send('Proxy error while forwarding grade.');
    }
});


router.post('/token', async (req, res) => {
    const { 
        grant_type, 
        client_assertion_type, 
        client_assertion,
        scope 
    } = req.body;

    console.log("--- Token Endpoint Request Received from OpenDSA ---");

    if (grant_type !== 'client_credentials' || 
        client_assertion_type !== 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' || 
        !client_assertion || 
        !scope) {
        
        return res.status(400).json({
            error: "invalid_request",
            error_description: "Missing required parameters."
        });
    }

    try {
        // 1. Manually verify the JWT from OpenDSA
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(client_assertion, getOpenDSAKey, { algorithms: ['RS256'], ignoreKeyid: true}, (err, decoded) => { //ignoring keyid because opendsa is weird
                if (err) reject(err);
                else resolve(decoded);
            });
        });

        console.log("Successfully verified OpenDSA signature for client:", decoded.sub);

        // 2. Obtain a REAL Access Token from Canvas using the correct ltijs method
        const canvasUrl = process.env.CANVAS_URL; 
        
        // Retrieve the platform object registered with ltijs
        const platform = await lti.getPlatform(canvasUrl, process.env.CANVAS_CLIENT_ID);
        
        if (!platform) {
            throw new Error("Platform not found for URL: " + canvasUrl);
        }

        // Get the platform access token for the requested scopes
        const tokenData = await platform.platformAccessToken(scope);

        console.log("Successfully fetched Canvas token for OpenDSA: ", tokenData);

        // 3. Respond to OpenDSA
        // Note: lti.getAccessToken returns the token string directly
        return res.json({
            token_type: "Bearer",
            expires_in: 3600,
            access_token: tokenData.access_token,
            scope: scope
        });

    } catch (err) {
        console.error("Token Exchange Failure:", err.message);
        return res.status(401).json({
            error: "invalid_client",
            error_description: err.message
        });
    }
});

module.exports = router;