const express = require("express");
const router = express.Router();
const { Assignment, Course } = require("../models/models");
const CanvasService = require("../services/canvasService");
const { Instructor } = require("../models/models");
const { Enrollment } = require("../models/models");

const canvasService = new CanvasService();

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

router.get('/:assignmentCanvasId/analytics', async (req, res) => {
    const { assignmentCanvasId } = req.params;
    const { courseCanvasId } = req.query;
  
    try {
      const course = await Course.findOne({ canvasId: courseCanvasId });
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
  
      const assignment = await Assignment.findOne({ canvasId: assignmentCanvasId, courseId: course._id });
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
  
      const enrollments = await Enrollment.find({ courseId: course._id })
        .populate('freePasses.passId')
        .populate('studentId');
  
      // Find all passes used for this assignment
      const relevantPasses = enrollments.flatMap(e => 
        e.freePasses
          .filter(p => p.assignmentId && p.assignmentId.toString() === assignment._id.toString())
          .map(p => ({ ...p.toObject(), studentCanvasId: e.studentId.canvasId, usedAt: p.usedAt }))
      );

      // Individual student data points
      const studentDataPoints = [];
      if (assignment.dueDate) {
        relevantPasses.forEach(pass => {
          const usedAt = new Date(pass.usedAt);
          const dueDate = new Date(assignment.dueDate);
          const daysBeforeDue = Math.round((dueDate - usedAt) / (1000 * 60 * 60 * 24) * 10) / 10; // Round to 1 decimal place
          studentDataPoints.push({
            studentId: pass.studentCanvasId,
            daysBeforeDue: daysBeforeDue,
            usedAt: pass.usedAt
          });
        });
      }

      // Student usage stats
      const studentsWhoUsedPass = new Set(relevantPasses.map(p => p.studentCanvasId));
      const totalStudents = enrollments.length;
      const usedCount = studentsWhoUsedPass.size;
      const notUsedCount = totalStudents - usedCount;

      res.json({
        totalStudents,
        usedCount,
        notUsedCount,
        studentDataPoints, // Array of {studentId, daysBeforeDue, usedAt}
        assignmentDueDate: assignment.dueDate,
      });
  
    } catch (err) {
      console.error('Error fetching assignment analytics:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
});

// POST /api/assignment/sync/:courseCanvasId
router.post("/sync/:courseCanvasId", async (req, res) => {
  const { courseCanvasId } = req.params;
  const { instructorCanvasId } = req.body;

  if (!instructorCanvasId) {
    return res.status(400).json({ error: "Missing instructorCanvasId" });
  }

  try {
    // Get instructor's API key
    const instructor = await Instructor.findOne({ canvasId: instructorCanvasId });
    if (!instructor || !instructor.canvasApiKey) {
      return res.status(400).json({ error: "Instructor API key not found" });
    }

    // Fetch assignments from Canvas
    const canvasAssignments = await canvasService.getCourseAssignments(courseCanvasId, instructor.canvasApiKey);

    // Get course document
    const course = await Course.findOne({ canvasId: courseCanvasId });
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Upsert each assignment
    const upsertedAssignments = [];
    for (const a of canvasAssignments) {
      const upserted = await Assignment.findOneAndUpdate(
        { canvasId: a.id.toString(), courseId: course._id },
        {
          canvasId: a.id.toString(),
          courseId: course._id,
          title: a.name,
          description: a.description,
          dueDate: a.due_at ? new Date(a.due_at) : null,
          assignment_group_name: a.assignment_group_name,
          external_tool_tag_attributes: a.external_tool_tag_attributes,
          published: a.published,
          points_possible: a.points_possible,
          canvasData: a,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      upsertedAssignments.push(upserted);
    }

    // Return all assignments for this course
    const allAssignments = await Assignment.find({ courseId: course._id });
    res.json(allAssignments);
  } catch (err) {
    console.error("Error syncing assignments:", err);
    res.status(500).json({ error: "Failed to sync assignments" });
  }
});

module.exports = router;
