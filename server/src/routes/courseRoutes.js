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

module.exports = router;
