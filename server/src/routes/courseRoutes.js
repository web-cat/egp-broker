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

router.post("/add", async (req, res) => {
  const { canvasId, title, description, instructorId, allowedPassTypes } = req.body;

  try {
    const course = await Course.create({ canvasId, title, description, instructorId, allowedPassTypes });
    res.status(201).json(course);
  } catch (err) {
    console.error("Error adding course:", err);
    res.status(500).json({ message: err });
  }
});



module.exports = router;
