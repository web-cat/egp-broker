const express = require("express");
const router = express.Router();
const {
  Course,
  Assignment,
} = require("../models/models");

router.get("/:courseCanvasId", async (req, res) => {
    const { courseCanvasId } = req.params;

    try {
        const course = await Course.findOne({ canvasId: courseCanvasId });

        if (!course) {
            return res.status(404).json({ message: "Course not found" });
        }

        const assignments = await Assignment.find({ courseId: course.id } );


        res.status(200).json(assignments);
    }
    catch (err) {
        console.error("Error fetching course:", err);
        res.status(500).json({ message: err });
    }
})

module.exports = router;
