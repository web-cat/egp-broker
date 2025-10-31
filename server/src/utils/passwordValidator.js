// Validate passwords as per vt guidelines https://it.vt.edu/projects/accounts/passphrase.html
function validateVTPassword(password) {
    const errors = [];

    // Check length
    if (password.length < 12) {
        errors.push("Password must be at least 12 characters long");
    }

    if (password.length >= 12 && password.length <= 19) {
        // Shorter passphrases rules
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumeral = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);

        if (!hasUppercase) {
            errors.push("Password must contain at least one uppercase letter");
        }

        if (!hasLowercase) {
            errors.push("Password must contain at least one lowercase letter");
        }

        if (!hasNumeral && !hasSpecialChar) {
            errors.push("Password must contain either a numeral or a special character");
        }
    }
    // Passwords 20+ characters don't need complexity requirements

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

module.exports = { validateVTPassword };