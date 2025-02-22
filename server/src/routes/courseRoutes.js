// routes/courses.js
const express = require("express");
const router = express.Router();
const {
  Course,
  Enrollment,
  Student,
  Assignment,
  FreePass,
  CoursePassType,
} = require("../models/models");

// Function to get course ID by LTI ID
async function getCourseIdByLtiId(ltiId) {
  try {
    const course = await Course.findOne({ ltiId });
    if (!course) {
      throw new Error("Course not found");
    }
    return course._id;
  } catch (err) {
    throw new Error(err.message);
  }
}

// Get course details with instructor
router.get("/:id", async (req, res) => {
  try {
    const course = await Course.find({ ltiId: req.params.id }).populate(
      "instructorId",
      "firstName lastName email"
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all students enrolled in a course with their free passes
router.get("/:id/students", async (req, res) => {
  try {
    const courseId = await getCourseIdByLtiId(req.params.id);
    const enrollments = await Enrollment.find({ courseId: courseId }).populate({
      path: "studentId",
      select: "firstName lastName email",
    });

    const studentIds = enrollments.map((e) => e.studentId._id);

    // Get free passes for all students in this course
    const freePasses = await FreePass.find({
      courseId: courseId,
      studentId: { $in: studentIds },
    });

    // Map free passes to students
    const studentsWithPasses = enrollments.map((enrollment) => {
      const studentPasses = freePasses.filter(
        (pass) =>
          pass.studentId.toString() === enrollment.studentId._id.toString()
      );

      return {
        student: enrollment.studentId,
        enrolledAt: enrollment.enrolledAt,
        freePasses: studentPasses,
      };
    });

    res.json(studentsWithPasses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id/student/:studentId", async (req, res) => {
  try {
    const courseId = await getCourseIdByLtiId(req.params.id);
    const student = await Student.findById(req.params.studentId);

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const enrollment = await Enrollment.findOne({
      courseId: courseId,
      studentId: student._id,
    });

    if (!enrollment) {
      return res.status(404).json({ message: "Student not enrolled in this course" });
    }

    const freePasses = await FreePass.find({
      courseId: courseId,
      studentId: student._id,
    });

    res.json({
      student,
      enrolledAt: enrollment.enrolledAt,
      freePasses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all assignments for a course with free pass usage stats
router.get("/:id/assignments", async (req, res) => {
  try {
    const courseId = await getCourseIdByLtiId(req.params.id);
    const assignments = await Assignment.find({ courseId: courseId });

    // Get all free passes used for these assignments
    const freePassesUsed = await FreePass.find({
      courseId: courseId,
      assignmentId: { $in: assignments.map((a) => a._id) },
      usedAt: { $ne: null },
    });

    const assignmentsWithStats = assignments.map((assignment) => {
      const passesForAssignment = freePassesUsed.filter(
        (pass) => pass.assignmentId.toString() === assignment._id.toString()
      );

      return {
        ...assignment.toObject(),
        freePassesUsed: passesForAssignment.length,
        studentsPassed: passesForAssignment.map((pass) => pass.studentId),
      };
    });

    res.json(assignmentsWithStats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get course statistics
router.get("/:id/stats", async (req, res) => {
  try {
    const courseId = await getCourseIdByLtiId(req.params.id);
    // Get basic course info
    const course = await Course.findById(courseId).populate(
      "instructorId",
      "firstName lastName email"
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Get enrollment count
    const enrollmentCount = await Enrollment.countDocuments({ courseId });

    // Get assignment stats
    const assignments = await Assignment.find({ courseId });
    const assignmentCount = assignments.length;

    // Get free pass stats
    const freePasses = await FreePass.find({ courseId });
    const freePassStats = {
      total: freePasses.length,
      used: freePasses.filter((pass) => pass.usedAt).length,
      remaining: freePasses.filter((pass) => pass.remaining > 0).length,
      byType: freePasses.reduce((acc, pass) => {
        acc[pass.type] = (acc[pass.type] || 0) + 1;
        return acc;
      }, {}),
    };

    // Get allowed pass types for this course
    const coursePassTypes = await CoursePassType.find({ courseId });

    res.json({
      course,
      stats: {
        enrollmentCount,
        assignmentCount,
        freePasses: freePassStats,
        allowedPassTypes: coursePassTypes.map((cpt) => cpt.passType),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
