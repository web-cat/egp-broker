const express = require("express");
const { Student, Course, Enrollment } = require("../models/models");

const router = express.Router();

router.get("/:courseCanvasId", async (req, res) => {
  const { studentCanvasId } = req.query;
  const { courseCanvasId } = req.params;

  console.log("Enrollment API called with courseCanvasId:", courseCanvasId);
  console.log("Student Canvas ID query param:", studentCanvasId);

  try {
    const course = await Course.findOne({ canvasId: courseCanvasId });
    console.log("Course found:", course ? course.canvasId : "NOT FOUND");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    let query = { courseId: course._id };

    if (studentCanvasId) {
      const student = await Student.findOne({ canvasId: studentCanvasId });
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      query.studentId = student._id;
    }

    const enrollments = await Enrollment.find(query)
      .populate("studentId")
      .populate("freePasses")
      .populate("passesLeft.passId")
      .populate("freePasses.passId")
      .populate("freePasses.assignmentId");

    console.log("Enrollments found:", enrollments.length);
    console.log("Query used:", JSON.stringify(query, null, 2));

    if (!enrollments.length) {
      return res.status(404).json({ message: "No enrollments found" });
    }

    const students = enrollments.map((enrollment) => enrollment.studentId);

    res.json(enrollments);
  } catch (err) {
    console.error("Error fetching enrollments:", err);
    res.status(500).json({ message: err });
  }
});

router.get("/:courseCanvasId/usedFreePasses", async (req, res) => {
  const { courseCanvasId } = req.params;

  try {
    const course = await Course.findOne({ canvasId: courseCanvasId });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const enrollments = await Enrollment.find({ courseId: course._id })
      .populate("studentId")
      .populate("freePasses.passId")
      .populate("freePasses.assignmentId");

    if (!enrollments.length) {
      return res.status(404).json({ message: "No enrollments found" });
    }

    const usedFreePasses = enrollments
      .map((enrollment) => {
        return enrollment.freePasses.map((freePass) => ({
          studentId: enrollment.studentId._id,
          firstName: enrollment.studentId.firstName,
          lastName: enrollment.studentId.lastName,
          passId: freePass.passId._id,
          passName: freePass.passId.name,
          assignmentId: freePass.assignmentId._id,
          assignmentTitle: freePass.assignmentId.title,
          usedAt: freePass.usedAt,
        }));
      })
      .flat();
    
    // Sort used free passes by usedAt date in descending order
    usedFreePasses.sort((a, b) => b.usedAt - a.usedAt);

    res.json(usedFreePasses);

  } catch (err) {
    console.error("Error fetching used free passes:", err);
    res.status(500).json({ message: err });
  }
});

module.exports = router;
