const express = require("express");
const axios = require("axios");
const router = express.Router();

//WIP
router.get('/opendsa-content', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const ltik = authHeader ? authHeader.split(' ')[1] : null;

        if (!ltik) {
            return res.status(401).json({ error: 'Authorization token (LTIK) is missing.' });
        }

        const agsContext = lti13AgsContextStore.get(ltik); // This map is for AGS, but has user/resource info
        if (!agsContext) {
             return res.status(401).json({ error: 'Invalid or expired LTIK.' });
        }
        
        // Reconstruct userData and resourceLinkId from the stored context
        const userDataForLTI11 = {
            userId: agsContext.userId,
            roles: ['Instructor'], // Placeholder, retrieve actual roles
            fullName: 'OpenDSA User', // Placeholder
            givenName: 'OpenDSA',
            familyName: 'User',
            userEmail: 'user@example.com',
            courseContextId: 'your-course-id' // Retrieve from context
        };
        const resourceLinkId = agsContext.resourceLinkId || 'some-resource-link-id'; // Retrieve from context


        // Now, call your existing launchOpenDSA function
        const openDSAContent = await launchOpenDSA(userDataForLTI11, resourceLinkId);

        // Send the HTML content back as the response
        res.setHeader('Content-Type', 'text/html');
        res.send(openDSAContent);

    } catch (error) {
        console.error('Error in Express /api/opendsa-content:', error);
        res.status(500).json({ error: 'Failed to fetch OpenDSA content via backend.' });
    }
});

module.exports = router;