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



module.exports = router;
