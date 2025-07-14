const express = require("express");
const router = express.Router();
const { Assignment, Course } = require("../models/models");
const CanvasService = require("../services/canvasService");
const { Instructor } = require("../models/models");

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

    // Upsert each assignment
    const upsertedAssignments = [];
    for (const a of canvasAssignments) {
      const upserted = await Assignment.findOneAndUpdate(
        { canvasId: a.id.toString() },
        {
          canvasId: a.id.toString(),
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

    // Optionally, associate assignments with a Course document if you want
    // (not required for pass logic, but useful for analytics)

    // Return all assignments for this course
    const allAssignments = await Assignment.find({ canvasId: { $in: canvasAssignments.map(a => a.id.toString()) } });
    res.json(allAssignments);
  } catch (err) {
    console.error("Error syncing assignments:", err);
    res.status(500).json({ error: "Failed to sync assignments" });
  }
});

module.exports = router;
