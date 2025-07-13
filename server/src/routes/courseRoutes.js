// routes/courses.js
const express = require("express");
const router = express.Router();
const {
  Course,
  Instructor,
} = require("../models/models");

router.post("/add", async (req, res) => {

  const { courseCanvasId, title, description, instructorCanvasId, allowedPassTypes } = req.body;

    console.log("canvasId", courseCanvasId);
    console.log("title", title);
    console.log("description", description);
    console.log("canvasInstructorId", instructorCanvasId);
    console.log("allowedPassTypes", allowedPassTypes);


  try {
    const instructor = await Instructor.findOne({ canvasId: instructorCanvasId });
    if (!instructor) {
      return res.status(500).json({ message: "Instructor not found" });
    }
    const course = await Course.create({ 'canvasId':courseCanvasId, 'title':title, 'description':description, 'instructorId':instructor._id, 'allowedPassTypes':allowedPassTypes });
    res.status(201).json(course);
  } catch (err) {
    console.error("Error adding course:", err);
    res.status(500).json({ message: err });
  }
});

router.post("/save-api-key", async (req, res) => {
  const { instructorCanvasId, canvasApiKey } = req.body;

  console.log("Saving API key for instructor:", instructorCanvasId);

  try {
    const instructor = await Instructor.findOne({ canvasId: instructorCanvasId });
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    instructor.canvasApiKey = canvasApiKey;
    await instructor.save();

    res.status(200).json({ message: "Canvas API key saved successfully" });
  } catch (err) {
    console.error("Error saving Canvas API key:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/:courseCanvasId/instructor", async (req, res) => {
  const { courseCanvasId } = req.params;

  console.log("Getting instructor for course:", courseCanvasId);

  try {
    const course = await Course.findOne({ canvasId: courseCanvasId }).populate('instructorId');
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (!course.instructorId) {
      return res.status(404).json({ message: "No instructor found for this course" });
    }

    res.status(200).json({
      instructorCanvasId: course.instructorId.canvasId,
      instructorName: `${course.instructorId.firstName} ${course.instructorId.lastName}`,
      instructorEmail: course.instructorId.email
    });
  } catch (err) {
    console.error("Error getting course instructor:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
