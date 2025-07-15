const { Instructor } = require("../models/models");

exports.getOrAddInstructor = async (canvasId, firstName, lastName, email) => {
  try {
    let instructor = await Instructor.findOne({ canvasId: canvasId });

    if (!instructor) {
      instructor = new Instructor({
        canvasId: canvasId,
        firstName: firstName,
        lastName: lastName,
        email: email,
      });
      await instructor.save();
    }

    return instructor;
  } catch (error) {
    console.error("Error getting or adding instructor:", error);
    throw error;
  }
};