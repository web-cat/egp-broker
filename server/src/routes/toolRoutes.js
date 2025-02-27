const express = require("express");
const { authenticateJWT } = require("../middleware/toolMiddleware");
const { Student, Course, Enrollment } = require("../models/models");

const router = express();

router.post("/student_passes", authenticateJWT, async (req, res) => {
    const { canvasStudentId, studentEmail, canvasCourseId, passType } = req.body;
    console.log(`Canvas Student ID: ${canvasStudentId}, Student Email: ${studentEmail}, Canvas Course ID: ${canvasCourseId}`);

    try {
        // Get student object ID from canvasStudentId
        const student = await Student.findOne({ canvasId: canvasStudentId });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Get course object ID from canvasCourseId
        const course = await Course.findOne({ canvasId: canvasCourseId });
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        // Get student passes from student object ID and course object ID
        const enrollment = await Enrollment.findOne({ studentId: student._id, courseId: course._id }).populate("passesLeft.passId");
        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found" });
        }

        // Filter passes by passType if provided
        const passes = enrollment.passesLeft
        .filter((pass) => passType ? pass.passId.passType.toLowerCase() === passType.toLowerCase() : true)
        .map((pass) => ({
                name: pass.passId.name,
                description: pass.passId.description,
                count: pass.count
            }));

        res.json(passes);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error });
    }
});

router.post("/redeem_pass", authenticateJWT, async (req, res) => {
    const { canvasStudentId, studentEmail, canvasCourseId, passId } = req.body;
    console.log(`Canvas Student ID: ${canvasStudentId}, Student Email: ${studentEmail}, Canvas Course ID: ${canvasCourseId}, Pass ID: ${passId}`);

    try {
        // Get student object ID from canvasStudentId
        const student = await Student.findOne({ canvasId: canvasStudentId });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        // Get course object ID from canvasCourseId
        const course = await Course.findOne({ canvasId: canvasCourseId });
        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        // Get enrollment record
        const enrollment = await Enrollment.findOne({ studentId: student._id, courseId: course._id }).populate("passesLeft.passId");
        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found" });
        }

        // Find the pass in passesLeft
        const passIndex = enrollment.passesLeft.findIndex(pass => pass.passId._id.toString() === passId);
        if (passIndex === -1 || enrollment.passesLeft[passIndex].count <= 0) {
            return res.status(400).json({ message: "Pass not available or already redeemed" });
        }

        // Redeem the pass
        enrollment.passesLeft[passIndex].count -= 1; // Decrease the count of the pass
        await enrollment.save(); // Save the updated enrollment

        res.json({ message: "Pass redeemed successfully!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});

module.exports = router;