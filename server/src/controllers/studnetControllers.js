const { Student } = require("../models/models");

const getOrAddStudent = async (canvasId, firstName, lastName, email) => {
  try {
    let student = await Student.findOne({ canvasId });

    if (student) {
      return student;
    }

    student = await Student.create({
      canvasId,
      firstName,
      lastName,
      email,
    });

    return student;
  } catch (err) {
    console.error("Error adding or finding student:", err);
    return err;
  }
};

module.exports = {
  getOrAddStudent,
};
