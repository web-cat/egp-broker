const { Pass, Course, Student, Enrollment } = require("../models/models");

const getOrAddEnrollment = async (studentCanvasId, courseCanvasId) => {

  try {
    const course = await Course.findOne({ canvasId: courseCanvasId });
    const student = await Student.findOne({ canvasId: studentCanvasId });

    if (!course || !student) {
      return null;
    }

    let enrollment = await Enrollment.findOne({
      courseId: course._id,
      studentId: student._id,
    });

    if (enrollment) {
      return enrollment;
    }

    passesLeft = course.allowedPassTypes.map((pass) => {
        return {
            passId: pass.passId,
            count: pass.initialCount,
        }
        });

    enrollment = await Enrollment.create({
      courseId: course._id,
      studentId: student._id,
      passesLeft: passesLeft,
      freePasses: [],
    });

    return enrollment;
  } catch (err) {
    console.error("Error adding or finding enrollment:", err);
  }
};

module.exports = {
  getOrAddEnrollment,
};
