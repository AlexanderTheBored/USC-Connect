/**
 * Enforces that req.user exists and has role === 'admin'.
 *
 * Must be used *after* requireAuth.
 */
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required.' });
    }
    return next();
}

/**
 * Factory — returns a middleware that additionally checks the admin's
 * department matches a ticket category. Used when we need to ensure an
 * IT Services admin can't resolve a Facilities ticket, etc.
 *
 * The calling route handler is responsible for calling this with the
 * ticket's actual category. See responsesController for the typical pattern.
 */
function adminCanActOnCategory(adminCategory, ticketCategory) {
    return adminCategory && ticketCategory && adminCategory === ticketCategory;
}

module.exports = { requireAdmin, adminCanActOnCategory };
