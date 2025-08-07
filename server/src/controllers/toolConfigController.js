const { Proxy } = require("../models/models");

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

const upsertToolConfiguration = async (deploymentId, resourceLinkId, toolType, lti11Config) => {
    try {
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

