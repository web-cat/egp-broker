const express = require("express");
const { Student, Course, Enrollment } = require("../models/models");

const router = express.Router();

router.get("/:courseCanvasId", async (req, res) => {
    const { studentCanvasId } = req.query;
    const { courseCanvasId } = req.params;

    try {
        const course = await Course.findOne({ canvasId: courseCanvasId });

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

        if (!enrollments.length) {
            return res.status(404).json({ message: "No enrollments found" });
        }

        const students = enrollments.map(enrollment => enrollment.studentId);

        res.json(enrollments);
    } catch (err) {
        console.error("Error fetching enrollments:", err);
        res.status(500).json({ message: err });
    }
});

module.exports = router;