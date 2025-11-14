const { Proxy } = require("../models/models");

/**
 * Retrieves the document containing all tool configurations for a given LTI context.
 * @param {string} deploymentId - LTI 1.3 Deployment ID.
 * @param {string} resourceLinkId - LTI 1.3 Resource Link ID.
 * @returns {Promise<Object>} The full configuration document or null/error.
 */
const getToolConfiguration = async (deploymentId, resourceLinkId) => {
    try {
        let config = await Proxy.findOne({ deploymentId, resourceLinkId });
        return config;
    }
    catch (err) {
        console.error("Error finding tool configuration:", err);
        return err;
    }
}

/**
 * Creates or updates a specific tool configuration (LTI 1.1 or LTI 1.3)
 * without overwriting other configurations for the same LTI context.
 * * @param {string} deploymentId - LTI 1.3 Deployment ID.
 * @param {string} resourceLinkId - LTI 1.3 Resource Link ID.
 * @param {string} toolType - e.g., 'opendsa11' or 'opendsa13'. Used as the dynamic key.
 * @param {Object} toolConfig - The LTI 1.1 or LTI 1.3 credentials object.
 * @returns {Promise<Object>} The updated document.
 */
const upsertToolConfiguration = async (deploymentId, resourceLinkId, toolType, lti11Config) => {
    try {
        // Define the dynamic key for the nested field - "configs.opendsa11" or "configs.opendsa13"
        const updateKey = `configs.${toolType}`;

        // Prepare the update object using the dynamic key
        const update = {
            // $set updates only the specified field, leaving other configs intact
            $set: {
                [updateKey]: toolConfig, // The entire LTI 1.1 or LTI 1.3 config object
                lastConfiguredAt: new Date()
            }
        };

        let config = await Proxy.findOneAndUpdate(
            { deploymentId, resourceLinkId }, // Query to find existing document
            {
                toolType: toolType,
                lti11Config: lti11Config,
                lastConfiguredAt: new Date()
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );
        return config;
    }
    catch (err) {
        console.error("Error upserting tool configuration:", err);
        return err;
    }
}

module.exports = {
    getToolConfiguration,
    upsertToolConfiguration,
};

