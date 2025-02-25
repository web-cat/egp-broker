const { Pass } = require("../models/models");


const getAllPasses = async () => {
    try {
        const passes = await Pass.find();
        return passes;
    } catch (err) {
        console.error("Error finding passes:", err);
        return err;
    }
}


module.exports = {
    getAllPasses,
};