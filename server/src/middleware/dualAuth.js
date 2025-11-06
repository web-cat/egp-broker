/**
 * Dual Authentication Middleware
 *
 * Allows both LTI (ltik-based) and session (Passport-based) authentication to coexist.
 *
 * Flow:
 * 1. LTI-specific routes (/lti/*) always require ltik - let ltijs handle them
 * 2. For other routes, check if user has valid Passport session first
 * 3. If session valid, bypass ltijs validation
 * 4. If no session, fall through to ltijs (will validate ltik)
 */

function dualAuthMiddleware(req, res, next) {
    // LTI-specific routes MUST use ltik (they call ltijs methods like Grade.submitScore, NamesAndRoles.getMembers)
    if (req.path.startsWith('/lti/')) {
        return next(); // Let ltijs middleware handle these
    }

    // For all other routes: check if user has valid Passport session
    if (req.isAuthenticated && req.isAuthenticated()) {
        // User has valid session - bypass ltijs validation
        console.log('Dual auth: Session authenticated user accessing:', req.path);
        return next();
    }

    // No session - fall through to ltijs validation (will check for ltik)
    console.log('Dual auth: No session, falling through to ltijs for:', req.path);
    next();
}

module.exports = dualAuthMiddleware;