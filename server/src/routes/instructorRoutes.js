const express = require('express');
const { Instructor } = require('../models/models');
const CanvasService = require('../services/canvasService');

const router = express.Router();
const canvasService = new CanvasService();

// Get instructor's API key (masked for security)
router.get('/:instructorCanvasId/api-key', async (req, res) => {
  const { instructorCanvasId } = req.params;

  try {
    const instructor = await Instructor.findOne({ canvasId: instructorCanvasId });
    
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    // Return whether API key exists and last updated time
    res.json({
      hasApiKey: !!instructor.canvasApiKey,
      lastUpdated: instructor.updatedAt || null
    });
  } catch (err) {
    console.error("Error fetching instructor API key:", err);
    res.status(500).json({ message: err.message });
  }
});

// Test instructor's API key
router.get('/:instructorCanvasId/test-api-key', async (req, res) => {
  const { instructorCanvasId } = req.params;

  try {
    const instructor = await Instructor.findOne({ canvasId: instructorCanvasId });
    
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    if (!instructor.canvasApiKey) {
      return res.json({ valid: false, message: "No API key configured" });
    }

    // Test the API key by making a simple Canvas API call
    try {
      // Try to get the user's profile to test the API key
      const userProfile = await canvasService.getUserProfile(instructor.canvasApiKey);
      
      if (userProfile && userProfile.id) {
        res.json({ 
          valid: true, 
          message: "API key is valid",
          user: {
            id: userProfile.id,
            name: userProfile.name,
            email: userProfile.email
          }
        });
      } else {
        res.json({ valid: false, message: "Invalid API key" });
      }
    } catch (canvasError) {
      console.error("Canvas API error:", canvasError);
      res.json({ valid: false, message: "API key test failed" });
    }

  } catch (err) {
    console.error("Error testing instructor API key:", err);
    res.status(500).json({ message: err.message });
  }
});

// Test a new API key before saving
router.post('/:instructorCanvasId/test-new-api-key', async (req, res) => {
  const { instructorCanvasId } = req.params;
  const { canvasApiKey } = req.body;

  if (!canvasApiKey) {
    return res.status(400).json({ valid: false, message: "No API key provided" });
  }

  try {
    // Test the new API key by making a simple Canvas API call
    const userProfile = await canvasService.getUserProfile(canvasApiKey);
    
    if (userProfile && userProfile.id) {
      res.json({ 
        valid: true, 
        message: "API key is valid and working",
        user: {
          id: userProfile.id,
          name: userProfile.name,
          email: userProfile.email
        }
      });
    } else {
      res.json({ valid: false, message: "Invalid API key" });
    }
  } catch (canvasError) {
    console.error("Canvas API error:", canvasError);
    res.json({ valid: false, message: "API key test failed - please check your key" });
  }
});

module.exports = router; 