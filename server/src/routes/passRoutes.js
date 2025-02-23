const express = require("express");
const router = express.Router();

const { Pass } = require("../models/models");

router.get("/", async (req, res) => {
  try {
    const passes = await Pass.find();
    res.json(passes);
  } catch (err) {
    console.error("Error fetching passes:", err);
    res.status(500).json({ message: err });
  }
});

module.exports = router;