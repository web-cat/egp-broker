const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const url = require('url');
const lti = require('ltijs').Provider;

// --- CONFIGURATION ---
// NOTE: These should ideally be read from env variables!
const proxybaseUrl = 'https://lightly-liberal-wasp.ngrok-free.app';  
const opendsaUrl = 'https://opendsax.cs.vt.edu/lti13/launches'; // Target LTI Launch URL
const opendsaClientId = '16'; // Target Tool's Client ID (Your proxy's Client ID on OpenDSA)
const proxyClientId = '1'; //tools id on proxy's database


/**
 * HANDLER 1: GET Request (Internal Redirect from LTI Provider/Canvas)
 */
router.get('/lti13', async (req, res) => {
    console.log("RESULTS:", res.locals.token);
    //console.log("REQUEST:", req);
    // Assuming this code runs inside the lti.onConnect() handler
    // where 'res.locals.token' is the validated LTI token from Canvas.
    const incomingToken = res.locals.token;

    const bookPath = incomingToken.platformContext.targetLinkUri.match(/custom_book_path=([^&]+)/)?.[1];
    const queryParams = incomingToken.platformContext.targetLinkUri.substring(incomingToken.platformContext.targetLinkUri.indexOf('?'));



    const launchPayload = {
        // --- OIDC / JWT Claims ---
        iss: opendsaClientId,
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

        // --- User Info Claims ---
        given_name: incomingToken.userInfo.given_name,
        family_name: incomingToken.userInfo.family_name,
        name: incomingToken.userInfo.name,
        email: incomingToken.userInfo.email,

        // --- Launch Presentation (MAPPED DIRECTLY) ---
        'https://purl.imsglobal.org/spec/lti/claim/launch_presentation': {
            document_target: incomingToken.platformContext.launchPresentation.document_target,
            return_url: proxyBaseUrl + '/launch/return',
            locale: incomingToken.platformContext.launchPresentation.locale,
            validation_context: incomingToken.platformContext.launchPresentation.validation_context,
        },

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
    const authEndpoint = await platform.platformAuthenticationEndpoint();
    const client_id = await platform.platformClientId(); // Your proxy's Client ID on OpenDSA


    // Sign the JWT using the private key and kid retrieved from the Platform object
    const signedJwt = jwt.sign(launchPayload, privateKey, {
        algorithm: 'RS256',
        keyid: kid,
        noTimestamp: true
    });

    //state JWT
    const statePayload = {
        // Must contain the tool_id OpenDSA expects
        tool_id: opendsaClientId, 
        // Standard JWT/OIDC claims
        iss: opendsaClientId, 
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
        noTimestamp: true
    });


    const redirectUri = 'https://opendsax.cs.vt.edu/lti13/launches'; // Must be a pre-registered LTI redirect URI on OpenDSA

    // The response is an HTML form that auto-submits to the OpenDSA authentication endpoint
    const htmlForm = `
        <html>
            <head>
                <title>LTI 1.3 Launch</title>
            </head>
            <body onload="document.forms[0].submit()">
                <form action="${authEndpoint}" method="POST">
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
 * HANDLER 2: POST Request (Secure LTI 1.3 Launch Brokering)
 */
router.post('/lti13', async (req, res) => {
    const incomingIdToken = req.body.id_token;
    const incomingState = req.body.state; 

    if (!incomingIdToken) {
        return res.status(400).send("Invalid LTI Launch: POST request is missing ID Token.");
    }

    console.log("INCOMING ID TOKEN:", incomingIdToken);

    const brokerIdToken = generateBrokerSignedJwt(incomingIdToken);

    if (!brokerIdToken) {
        return res.status(500).send("Brokerage Error: Failed to generate signed JWT.");
    }

    console.log("[BROKER OUTGOING JWT (POST)]:", brokerIdToken);

    const finalForwardingUrl = opendsaUrl;

    const htmlForm = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>LTI Launch Redirection</title>
        </head>
        <body onload="document.forms[0].submit()">
            <p>Redirecting launch securely to OpenDSA...</p>
            <form id="ltiForwardForm" action="${finalForwardingUrl}" method="POST">
                <input type="hidden" name="id_token" value="${brokerIdToken}">
                <input type="hidden" name="state" value="${encodeURIComponent(incomingState)}">
                ${Object.entries(req.body)
            .filter(([key]) => key !== 'id_token' && key !== 'state')
            .map(([key, value]) =>
                `<input type="hidden" name="${key}" value="${encodeURIComponent(value)}">`
            ).join('\n')}
            </form>
            <script>
                window.setTimeout(() => document.getElementById('ltiForwardForm').submit(), 500); 
            </script>
        </body>
        </html>
    `;

    res.send(htmlForm);
});


// This function receives the data from the external tool (opendsa) and returns the data to canvas
router.get('/return', async (req, res) => {
    console.log("DO I GET HERE");
    
    // --- TEMPORARY SOLUTION: ASSUME ORIGINAL URL IS KNOWN/PASSED ---
    // In a production environment, you MUST retrieve this from a session/database
    // to match the user's current context.
    const originalCanvasReturnUrl = 'https://canvas.endeavour.cs.vt.edu/courses/17/external_content/success/external_tool_redirect'; // Example value
    // ------------------------------------------------------------------

    if (!originalCanvasReturnUrl) {
        // Handle error: couldn't find where to send the user back
        console.error("ERROR: Original Canvas return URL not found in session.");
        return res.status(500).send("Return path is unknown.");
    }
    
    // 2. Extract all parameters OpenDSA sent (e.g., lti_msg, lti_log, etc.).
    const returnParams = new url.URLSearchParams(req.query).toString();

    // 3. Construct the final redirect URL.
    const finalRedirectUrl = `${originalCanvasReturnUrl}?${returnParams}`;
    
    console.log("Redirecting user back to Canvas at:", finalRedirectUrl);

    // 4. Issue the redirect.
    // This sends an HTTP 302 response to the user's browser, telling it to go to Canvas.
    return res.redirect(finalRedirectUrl);
});


module.exports = router;