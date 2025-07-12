const express = require("express");
const router = express.Router();
const CanvasService = require("../services/canvasService");
const { Course, Instructor, Student } = require("../models/models");

const canvasService = new CanvasService();

// Get all assignments for a course from Canvas
router.get("/assignments/:courseCanvasId", async (req, res) => {
  const { courseCanvasId } = req.params;
  const { instructorCanvasId } = req.query;

  console.log("Fetching assignments for course:", courseCanvasId);

  try {
    // Find the instructor to get their API key
    const instructor = await Instructor.findOne({ canvasId: instructorCanvasId });
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    if (!instructor.canvasApiKey) {
      return res.status(400).json({ message: "Instructor has no Canvas API key configured" });
    }

    // Verify the course exists in our database
    const course = await Course.findOne({ canvasId: courseCanvasId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Fetch assignments from Canvas
    const assignments = await canvasService.getCourseAssignments(courseCanvasId, instructor.canvasApiKey);
    
    res.status(200).json(assignments);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get assignments for a specific student in a course from Canvas
router.get("/assignments/:courseCanvasId/student/:studentCanvasId", async (req, res) => {
  const { courseCanvasId, studentCanvasId } = req.params;
  const { instructorCanvasId } = req.query;

  console.log("Fetching assignments for student:", studentCanvasId, "in course:", courseCanvasId);

  try {
    // Find the instructor to get their API key
    const instructor = await Instructor.findOne({ canvasId: instructorCanvasId });
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    if (!instructor.canvasApiKey) {
      return res.status(400).json({ message: "Instructor has no Canvas API key configured" });
    }

    // Verify the course and student exist in our database
    const course = await Course.findOne({ canvasId: courseCanvasId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const student = await Student.findOne({ canvasId: studentCanvasId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Fetch student assignments from Canvas
    const assignments = await canvasService.getStudentAssignments(courseCanvasId, studentCanvasId, instructor.canvasApiKey);
    
    res.status(200).json(assignments);
  } catch (error) {
    console.error("Error fetching student assignments:", error);
    res.status(500).json({ message: error.message });
  }
});

// Update assignment due date for a specific student
router.put("/assignments/:courseCanvasId/:assignmentCanvasId/due-date", async (req, res) => {
  const { courseCanvasId, assignmentCanvasId } = req.params;
  const { studentCanvasId, newDueDate, instructorCanvasId } = req.body;

  console.log("Updating due date for assignment:", assignmentCanvasId, "student:", studentCanvasId, "new date:", newDueDate);

  try {
    // Find the instructor to get their API key
    const instructor = await Instructor.findOne({ canvasId: instructorCanvasId });
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    if (!instructor.canvasApiKey) {
      return res.status(400).json({ message: "Instructor has no Canvas API key configured" });
    }

    // Verify the course and student exist in our database
    const course = await Course.findOne({ canvasId: courseCanvasId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const student = await Student.findOne({ canvasId: studentCanvasId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Validate the due date format
    const dueDate = new Date(newDueDate);
    if (isNaN(dueDate.getTime())) {
      return res.status(400).json({ message: "Invalid due date format" });
    }

    // Update the assignment due date in Canvas
    const result = await canvasService.updateStudentAssignmentDueDate(
      courseCanvasId, 
      assignmentCanvasId, 
      studentCanvasId, 
      dueDate.toISOString(), 
      instructor.canvasApiKey
    );
    
    res.status(200).json({
      message: "Assignment due date updated successfully",
      result: result
    });
  } catch (error) {
    console.error("Error updating assignment due date:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get assignment overrides for a specific assignment
router.get("/assignments/:courseCanvasId/:assignmentCanvasId/overrides", async (req, res) => {
  const { courseCanvasId, assignmentCanvasId } = req.params;
  const { instructorCanvasId } = req.query;

  console.log("Fetching overrides for assignment:", assignmentCanvasId, "in course:", courseCanvasId);

  try {
    // Find the instructor to get their API key
    const instructor = await Instructor.findOne({ canvasId: instructorCanvasId });
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    if (!instructor.canvasApiKey) {
      return res.status(400).json({ message: "Instructor has no Canvas API key configured" });
    }

    // Verify the course exists in our database
    const course = await Course.findOne({ canvasId: courseCanvasId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Fetch assignment overrides from Canvas
    const overrides = await canvasService.getAssignmentOverrides(courseCanvasId, assignmentCanvasId, instructor.canvasApiKey);
    
    res.status(200).json(overrides);
  } catch (error) {
    console.error("Error fetching assignment overrides:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 