const authenticateSeedKey = (req, res, next) => {
    const seedKey = req.body.seedKey;
    const validSeedKey = process.env.SEED_KEY;

    if (seedKey === validSeedKey) {
        next();
    } else {
        res.status(403).json({ error: 'Invalid seed key' });
    }
};

module.exports = authenticateSeedKey;
