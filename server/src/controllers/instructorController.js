const { Instructor } = require("../models/models");

const getOrAddInstructor = async (canvasId, firstName, lastName, email) => {
    try {
        let instructor = await Instructor.findOne({ canvasId });

        if (instructor) {
            return instructor;
        }

        instructor = await Instructor.create({
            canvasId,
            firstName,
            lastName,
            email,
        });

        return instructor;
    } catch (err) {
        console.error("Error adding or finding instructor:", err);
        return err;
    }
};

module.exports = {
    getOrAddInstructor,
};
