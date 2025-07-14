const express = require("express");
const axios = require("axios");
const router = express.Router();

const { Student, Course, Enrollment, Assignment, Pass } = require("../models/models");

router.get("/", async (req, res) => {
  try {
    const passes = await Pass.find();
    res.json(passes);
  } catch (err) {
    console.error("Error fetching passes:", err);
    res.status(500).json({ message: err });
  }
});

// POST /api/pass/apply
router.post('/apply', async (req, res) => {
  const { studentCanvasId, assignmentCanvasId, courseCanvasId, passId } = req.body;

  if (!studentCanvasId || !assignmentCanvasId || !courseCanvasId || !passId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Look up student
    const student = await Student.findOne({ canvasId: studentCanvasId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Look up course
    const course = await Course.findOne({ canvasId: courseCanvasId });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    // Look up assignment
    const assignment = await Assignment.findOne({ canvasId: assignmentCanvasId });
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    // Extract inst_chapter_module_id from assignment.external_tool_tag_attributes.url
    let inst_chapter_module_id = null;
    if (assignment.external_tool_tag_attributes && assignment.external_tool_tag_attributes.url) {
      const url = assignment.external_tool_tag_attributes.url;
      const match = url.match(/inst_chapter_module_id=(\d+)/);
      if (match) {
        inst_chapter_module_id = parseInt(match[1], 10);
      }
    }
    if (!inst_chapter_module_id) {
      return res.status(422).json({ error: 'inst_chapter_module_id not found in assignment' });
    }

    // Look up pass
    const pass = await Pass.findById(passId);
    if (!pass) return res.status(404).json({ error: 'Pass not found' });
    if (!pass.details || !pass.details.durationHours) {
      return res.status(422).json({ error: 'Pass does not have a durationHours field' });
    }

    // Look up enrollment
    const enrollment = await Enrollment.findOne({ studentId: student._id, courseId: course._id });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    // Check if student has passes left
    const passEntry = enrollment.passesLeft.find(p => p.passId.toString() === passId);
    if (!passEntry || passEntry.count <= 0) {
      return res.status(422).json({ error: 'No passes left for this type' });
    }

    // Prepare OpenDSA payload
    const payload = {
      student_extension: {
        user_email: student.email,
        inst_chapter_module_id,
        due_offset_hours: pass.details.durationHours
      }
    };

    console.log("Payload:", payload);

    // Call OpenDSA endpoint
    let opendsaResponse;
    try {
      opendsaResponse = await axios.post(
        'https://opendsa-lti.localhost.devcom.vt.edu/egp_broker/student_extensions',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      // Improved error handling: log full error details
      console.error('Error in /api/pass/apply:', err);
      let errorMsg = 'Internal server error';
      if (err && typeof err === 'object') {
        if (err.message) errorMsg = err.message;
        if (err.stack) errorMsg += `\nStack: ${err.stack}`;
      }
      return res.status(500).json({ error: errorMsg, type: err && err.name ? err.name : 'Error' });
    }

    // If OpenDSA succeeded, update local DB
    if (opendsaResponse.status === 200) {
      // Decrement pass count
      passEntry.count -= 1;
      // Add to freePasses
      enrollment.freePasses.push({
        passId: pass._id,
        usedAt: new Date(),
        assignmentId: assignment._id
      });
      await enrollment.save();
      return res.status(200).json({ success: true, opendsa: opendsaResponse.data });
    } else {
      return res.status(opendsaResponse.status).json(opendsaResponse.data);
    }
  } catch (err) {
    console.error('Error in /api/pass/apply:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;