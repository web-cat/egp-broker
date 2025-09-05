const express = require("express");
const router = express.Router();
const mongoose = require('mongoose');

const { getToolConfiguration } = require("../controllers/toolConfigController");

// Replace with your MongoDB connection URI
const uri = "mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority";
const dbName = "your_database_name";

// Connect to MongoDB using Mongoose
mongoose.connect(uri, { dbName: dbName })
    .then(() => console.log("Connected successfully to MongoDB"))
    .catch(err => console.error("Failed to connect to MongoDB", err));

// Define the Mongoose Schema for the tool configuration
const toolConfigSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    toolType: { type: String, required: true },
    ltiVersion: { type: String, required: true},
    ltiConfig: {
        ltiConsumerKey: String,
        ltiSharedSecret: String,
        ltiLaunchUrl: String
    },
    lastUpdated: { type: Date, default: Date.now }
}, {
    // This removes the default __v version key from the document
    versionKey: false 
});

// Create a Mongoose Model from the schema
const ToolConfig = mongoose.model('ToolConfig', toolConfigSchema);

// Placeholder function for LTI key validation and user lookup.
// In a real application, you would validate the LTI key with your
// LTI library and extract the user's unique ID from the payload.
const getUserIdFromLtik = (ltik) => {
    // This is a dummy implementation. Replace with your actual LTI validation logic.
    if (ltik) {
        // Assuming the LTI key can be used to deterministically get a user ID
        return "user-id-from-lti-key"; 
    }
    return null;
};

// --- API Endpoints ---

// GET /api/tool-config
// Fetches the user's tool configuration from the database.
router.get('/', async (req, res) => {
    // Authenticate user using the LTI key from the Authorization header
    const ltik = req.headers['authorization']?.split(' ')[1];
    const userId = getUserIdFromLtik(ltik);

    if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    try {
        // Find the configuration document for the user
        const config = await ToolConfig.findOne({ userId: userId });

        if (config) {
            res.json({ success: true, config: config.ltiConfig });
        } else {
            res.json({ success: false, message: 'No configuration found.' });
        }
    } catch (err) {
        console.error("GET /api/tool-config error:", err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// POST /api/tool-config
// Saves or updates the user's tool configuration in the database.
router.post('/', async (req, res) => {
    // Authenticate user using the LTI key
    const ltik = req.headers['authorization']?.split(' ')[1];
    const userId = getUserIdFromLtik(ltik);

    if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const { toolType, ltiVersion, ltiConfig } = req.body;

    if (!toolType || !ltiVersion || !ltiConfig) {
        return res.status(400).json({ success: false, error: 'Missing data in request body.' });
    }

    try {
        // Find and update the configuration, or create a new one if it doesn't exist.
        const result = await ToolConfig.findOneAndUpdate(
            { userId: userId },
            { 
                userId,
                toolType,
                ltiVersion,
                ltiConfig,
                lastUpdated: new Date()
            },
            { new: true, upsert: true }
        );

        if (result) {
            res.json({ success: true, message: 'Configuration saved successfully.' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to save configuration.' });
        }
    } catch (err) {
        console.error("POST /api/tool-config error:", err);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

module.exports = router;

// A new endpoint to receive grade data and send it to Canvas
router.post('/grade', async (req, res) => {
  const { userId, grade, deploymentId, resourceLinkId } = req.body;

  if (!deploymentId || !resourceLinkId) {
    return res.status(400).send({ message: "Missing deploymentId or resourceLinkId in request body." });
  }

  try {
    const toolConfig = await getToolConfiguration(deploymentId, resourceLinkId);
    if (!toolConfig) {
      return res.status(404).send({ message: "Tool configuration not found for this deployment and resource." });
    }

    const idToken = JSON.parse(toolConfig.idToken);
    const lineItemUrl = toolConfig.lineItemUrl;

    const response = await lti.Grade.send(
      idToken,
      {
        userId: userId,
        scoreGiven: grade,
        scoreMaximum: 100,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded'
      },
      lineItemUrl
    );

    console.log('Grade passback successful:', response);
    res.status(200).send({ message: 'Grade successfully passed back.' });
  } catch (err) {
    console.error('Error with grade passback:', err);
    res.status(500).send({ message: 'Error with grade passback.', error: err.message });
  }
});

//WIP
/*
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
*/