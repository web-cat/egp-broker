/**
 * Dual Authentication Middleware
 *
 * Allows both LTI (ltik-based) and session (Passport-based) authentication to coexist.
 */

/**
 * Unified Authentication Middleware
 * Checks for either LTI authentication (res.locals.token) or session authentication (req.isAuthenticated)
 */

function requireAuth(req, res, next) {

    console.log('=== requireAuth ===');
    console.log('req.path:', req.path);
    console.log('req.originalUrl:', req.originalUrl);
    console.log('req.isAuthenticated():', req.isAuthenticated ? req.isAuthenticated() : 'undefined');
    // Check if LTI user (ltijs validated successfully)
    if (res.locals.token && res.locals.context) {
        console.log('LTI authenticated user:', res.locals.token.user);
        return next();
    }

    // Check if session user (Passport authenticated)
    if (req.isAuthenticated && req.isAuthenticated()) {
        console.log('Session authenticated user:', req.user.email);
        return next();
    }
    // Neither authentication present
    console.log('Unauthorized access attempt to:', req.path);
    return res.status(401).json({ error: 'Authentication required' });
}

module.exports = { requireAuth };