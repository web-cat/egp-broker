const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const { Instructor } = require('../models/models');

passport.use('local', new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
        try {
            const instructor = await Instructor.findOne({ email: email.toLowerCase() });

            if (!instructor || !instructor.passwordHash) {
                return done(null, false, { message: 'Invalid credentials' });
            }

            const isMatch = await bcrypt.compare(password, instructor.passwordHash);
            if (!isMatch) {
                return done(null, false, { message: 'Invalid credentials' });
            }

            return done(null, instructor);
        } catch (err) {
            return done(err);
        }
    }
));

passport.serializeUser((instructor, done) => {
    done(null, instructor._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const instructor = await Instructor.findById(id);
        done(null, instructor);
    } catch (err) {
        done(err);
    }
});

module.exports = passport;