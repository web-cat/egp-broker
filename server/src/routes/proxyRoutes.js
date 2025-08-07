const express = require("express");
const router = express.Router();
const lti = require("ltijs").Provider;

const { getToolConfiguration } = require("../controllers/toolConfigController");
const { launchOpenDSA } = require('../utils/tool');

//WIP
router.get('/opendsa-content', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const ltik = authHeader ? authHeader.split(' ')[1] : null;

        if (!ltik) {
            return res.status(401).json({ error: 'Authorization token (LTIK) is missing.' });
        }

        const token = await lti.getToken(frontendLtik);
        if (!token) {
            console.warn("API Call: /opendsa-content - Invalid or expired LTIK (not found in ltijs DB):", frontendLtik);
            return res.status(401).json({ error: 'Invalid or expired LTIK. Please re-launch from LMS.' });
        }
        
        //get necessary data from token
        const deploymentId = token.platformInfo.deploymentId;
        const resourceLinkId = token.resourceLinkId || (token.resource && token.resource.id);
        const canvasUserId = token.userInfo.userId;
        const courseContextId = token.context.id;

        const configuredToolMapping = await getToolConfiguration(deploymentId, resourceLinkId);

        // Now, call your existing launchOpenDSA function
        //const openDSAContent = await launchOpenDSA(userDataForLTI11, resourceLinkId);

        if (!configuredToolMapping || configuredToolMapping.toolType !== 'opendsa') {
            console.warn("API Call: /opendsa-content - No OpenDSA configuration found for this link.");
            return res.status(404).json({ error: 'OpenDSA is not configured for this LTI link. Please configure it first.' });
        }

        const { consumerKey, sharedSecret, launchUrl } = configuredToolMapping.lti11Config;
        if (!consumerKey || !sharedSecret || !launchUrl) {
            console.error("API Call: /opendsa-content - Incomplete LTI 1.1 configuration found for OpenDSA.");
            return res.status(500).json({ error: 'Incomplete OpenDSA configuration found. Please re-configure.' });
        }

        const userDataForLTI11 = {
            userId: canvasUserId,
            roles: token.roles, // Roles from the token
            fullName: token.userInfo.name,
            givenName: token.userInfo.given_name,
            familyName: token.userInfo.family_name,
            userEmail: token.userInfo.email,
            courseContextId: courseContextId
        };

        console.log("Launching OpenDSA with config:", { deploymentId, resourceLinkId, toolType: configuredToolMapping.toolType });

        const openDSAContent = await launchOpenDSA(
            userDataForLTI11,
            resourceLinkId,
            consumerKey,
            sharedSecret,
            launchUrl
        );

        // Send the HTML content back as the response
        res.setHeader('Content-Type', 'text/html');
        res.send(openDSAContent);

    } catch (error) {
        console.error('Error in Express /api/opendsa-content:', error);
        res.status(500).json({ error: 'Failed to fetch OpenDSA content via backend.' });
    }
});

router.post('/configure-tool', async (req, res) => {
    const { toolType } = req.body;
    const authHeader = req.headers.authorization;
    const frontendLtik = authHeader ? authHeader.split(' ')[1] : null;

    if (!frontendLtik) {
      return res.status(401).json({ error: 'LTIK missing from Authorization header' });
    }
    if (!toolType) {
      return res.status(400).json({ error: 'Missing toolType in request body' });
    }

    // Retrieve the LTI 1.3 context using ltijs.getToken
    const ltiContextToken = await lti.getToken(frontendLtik);
    if (!ltiContextToken) {
      console.warn("Invalid or expired frontendLtik received for configure-tool:", frontendLtik);
      return res.status(401).json({ error: 'Invalid or expired LTIK. Please re-launch from LMS.' });
    }

    const deploymentId = ltiContextToken.platformInfo.deploymentId;
    const resourceLinkId = ltiContextToken.resourceLinkId || (ltiContextToken.resource && ltiContextToken.resource.id);

    if (toolType === 'opendsa') {
      if (!process.env.OPENDSA_LTI11_CONSUMER_KEY || !process.env.OPENDSA_LTI11_SHARED_SECRET || !process.env.OPENDSA_LTI11_LAUNCH_URL) {
        console.error("OpenDSA LTI 1.1 credentials missing in environment variables (proxyRoutes).");
        return res.status(500).json({ success: false, error: 'OpenDSA LTI 1.1 credentials not configured on server.' });
      }

      try {
        const result = await upsertToolConfiguration(
          deploymentId,
          resourceLinkId,
          toolType,
          {
            consumerKey: process.env.OPENDSA_LTI11_CONSUMER_KEY,
            sharedSecret: process.env.OPENDSA_LTI11_SHARED_SECRET,
            launchUrl: process.env.OPENDSA_LTI11_LAUNCH_URL,
          }
        );

        if (result instanceof Error) {
            throw result;
        }

        console.log(`OpenDSA LTI 1.1 configured and saved for deployment: ${deploymentId}, resourceLink: ${resourceLinkId}`);
        return res.status(200).json({ success: true, message: `OpenDSA LTI 1.1 configured successfully for this link.` });

      } catch (error) {
        console.error('Error saving OpenDSA configuration to database:', error);
        return res.status(500).json({ success: false, error: 'Failed to save OpenDSA configuration.' });
      }

    } else {
      return res.status(400).json({ success: false, error: 'Unsupported tool type selected.' });
    }
});

module.exports = router;