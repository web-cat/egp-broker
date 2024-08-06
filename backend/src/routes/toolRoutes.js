const express = require('express');
const router = express.Router();
const authenticateAdmin = require('../middlewares/adminMiddleware');
const {Tool} = require("../models/models");


const dummyTool = {
    toolId: 'dummyTool123',
    clientId: 'dummyClientId456',
    clientSecret: 'dummyClientSecret789',
    publicKey: 'dummyPublicKeyABC',
    privateKey: 'dummyPrivateKeyXYZ',
    grants: ['read', 'write']
};

// Create a new tool
router.post('/', authenticateAdmin, async (req, res) => {
    try {
        const tool = new Tool(req.body);
        await tool.save();
        res.status(201).json(tool);
    } catch (err) {
        res.status(400).json({ error: 'Failed to create tool.' });
    }
});

// Get all tools
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const tools = await Tool.find();
        res.json(tools);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve tools.' });
    }
});

// Get a tool by ID
router.get('/:id', authenticateAdmin, async (req, res) => {
    try {
        const tool = await Tool.findById(req.params.id);
        if (!tool) {
            return res.status(404).json({ error: 'Tool not found.' });
        }
        res.json(tool);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve tool.' });
    }
});

// Update a tool
router.put('/:id', authenticateAdmin, async (req, res) => {
    try {
        const tool = await Tool.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!tool) {
            return res.status(404).json({ error: 'Tool not found.' });
        }
        res.json(tool);
    } catch (err) {
        console.error(err); // Add logging for debugging
        res.status(400).json({ error: 'Failed to update tool.' });
    }
});
// Delete a tool
router.delete('/:id', authenticateAdmin, async (req, res) => {
    try {
        const tool = await Tool.findByIdAndDelete(req.params.id);
        if (!tool) {
            return res.status(404).json({ error: 'Tool not found.' });
        }
        res.status(204).end();
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete tool.' });
    }
});

router.get('/api/tool/autofill', (req, res) => {
    res.json(dummyTool);
});

module.exports = router;
