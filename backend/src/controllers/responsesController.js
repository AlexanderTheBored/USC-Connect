const { query } = require('../config/db');
const { HttpError } = require('../middleware/error');
const { adminCanActOnCategory } = require('../middleware/admin');

/**
 * POST /tickets/:id/respond
 *
 * Any authenticated user may post a standard comment. If the author is an
 * admin whose department matches the ticket's category, the response is
 * marked as official (pinned, highlighted in the UI). Students cannot
 * produce official responses even if they pass is_official_admin_response=true
 * in the body — that flag is computed server-side.
 */
async function createResponse(req, res, next) {
    try {
        const ticketId = parseInt(req.params.id, 10);
        if (!Number.isFinite(ticketId)) throw new HttpError(400, 'Invalid ticket id.');

        const { body } = req.body || {};
        if (typeof body !== 'string' || body.trim().length < 1 || body.length > 4000) {
            throw new HttpError(400, 'Response body must be between 1 and 4000 characters.');
        }

        const ticket = await query('SELECT category FROM tickets WHERE id = $1', [ticketId]);
        if (!ticket.rows.length) throw new HttpError(404, 'Ticket not found.');

        const isOfficial =
            req.user.role === 'admin' &&
            adminCanActOnCategory(req.user.admin_category, ticket.rows[0].category);

        const inserted = await query(
            `
            INSERT INTO responses (ticket_id, author_id, body, is_official_admin_response)
            VALUES ($1, $2, $3, $4)
            RETURNING id, ticket_id, body, is_official_admin_response, created_at
            `,
            [ticketId, req.user.id, body.trim(), isOfficial]
        );

        // Re-fetch with author info so the client doesn't have to.
        const { rows } = await query(
            `
            SELECT
                r.id, r.body, r.is_official_admin_response, r.created_at,
                u.id AS author_id, u.full_name AS author_name,
                u.email AS author_email, u.role AS author_role,
                u.admin_category AS author_admin_category
            FROM responses r
            JOIN users u ON u.id = r.author_id
            WHERE r.id = $1
            `,
            [inserted.rows[0].id]
        );

        return res.status(201).json({ response: rows[0] });
    } catch (err) {
        return next(err);
    }
}

module.exports = { createResponse };
