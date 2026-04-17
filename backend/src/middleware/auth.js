const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer token on a request and attaches req.user.
 *
 * Usage:
 *   router.get('/me', requireAuth, handler);
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            admin_category: payload.admin_category || null,
        };
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

/**
 * Soft auth — attaches req.user if a valid token is present, but never
 * rejects the request. Useful for endpoints like GET /tickets where the
 * same data is returned either way but the response can be enriched
 * (for example, a "has the current user upvoted this?" flag).
 */
function attachUserIfPresent(req, _res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme === 'Bearer' && token) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            req.user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                admin_category: payload.admin_category || null,
            };
        } catch {
            // Ignore — treat as anonymous.
        }
    }
    return next();
}

module.exports = { requireAuth, attachUserIfPresent };
