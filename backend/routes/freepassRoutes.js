const express = require('express');
const FreePass = require('../models/FreePass');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { value } = req.body;
    const freePass = await FreePass.create({ value });
    res.json(freePass);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const freePasses = await FreePass.findAll();
    res.json(freePasses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;
    const [updated] = await FreePass.update({ value }, { where: { id } });
    if (updated) {
      const updatedFreePass = await FreePass.findOne({ where: { id } });
      res.status(200).json(updatedFreePass);
    } else {
      res.status(404).send('FreePass not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await FreePass.destroy({ where: { id } });
    if (deleted) {
      res.status(204).send();
    } else {
      res.status(404).send('FreePass not found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
