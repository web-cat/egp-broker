const bcrypt = require('bcrypt');
const saltRounds = 10; // Number of salt rounds to use for hashing

const password = '12345678'; //admin password to hash

bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
    if (err) {
        console.error('Error hashing password:', err);
        return;
    }
    console.log('Hashed password:', hashedPassword);
});
