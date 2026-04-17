const { query, withTransaction } = require('../config/db');
const { ALLOWED_CATEGORIES } = require('../config/admins');
const { HttpError } = require('../middleware/error');
const { adminCanActOnCategory } = require('../middleware/admin');

const ALLOWED_STATUSES = new Set(['Pending', 'Under Review', 'Resolved']);
const SORTABLE_COLUMNS = {
    upvotes: 'upvote_count',
    date: 'created_at',
};

/**
 * GET /tickets
 *
 * Query params:
 *   ?sort=upvotes|date      (default: date)
 *   ?order=desc|asc         (default: desc)
 *   ?category=Academic      (optional; must be an allowed category)
 *   ?status=Pending         (optional; must be an allowed status)
 *   ?mine=true              (authenticated only — returns only the caller's tickets)
 *   ?limit=50&offset=0      (pagination)
 *
 * When the caller is authenticated, each ticket is returned with a
 * `has_upvoted` boolean so the UI can render the vote button correctly.
 */
async function listTickets(req, res, next) {
    try {
        const sortKey = SORTABLE_COLUMNS[req.query.sort] || 'created_at';
        const order = String(req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // $1 is always the current user id (or NULL) so the has_upvoted
        // subquery has a stable position regardless of which filters are set.
        const params = [req.user ? req.user.id : null];
        const where = [];

        if (req.query.category) {
            if (!ALLOWED_CATEGORIES.has(req.query.category)) {
                throw new HttpError(400, 'Invalid category filter.');
            }
            params.push(req.query.category);
            where.push(`t.category = $${params.length}`);
        }

        if (req.query.status) {
            if (!ALLOWED_STATUSES.has(req.query.status)) {
                throw new HttpError(400, 'Invalid status filter.');
            }
            params.push(req.query.status);
            where.push(`t.status = $${params.length}`);
        }

        if (req.query.mine === 'true') {
            if (!req.user) throw new HttpError(401, 'Authentication required for ?mine=true');
            params.push(req.user.id);
            where.push(`t.author_id = $${params.length}`);
        }

        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
        params.push(limit);   // $N-1
        params.push(offset);  // $N

        const sql = `
            SELECT
                t.id,
                t.title,
                t.body,
                t.category,
                t.status,
                t.upvote_count,
                t.created_at,
                t.updated_at,
                u.id        AS author_id,
                u.full_name AS author_name,
                u.email     AS author_email,
                u.role      AS author_role,
                CASE
                    WHEN $1::int IS NULL THEN FALSE
                    ELSE EXISTS (
                        SELECT 1 FROM upvotes uv
                        WHERE uv.ticket_id = t.id AND uv.user_id = $1
                    )
                END AS has_upvoted
            FROM tickets t
            JOIN users u ON u.id = t.author_id
            ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
            ORDER BY t.${sortKey} ${order}, t.id DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `;

        const { rows } = await query(sql, params);
        return res.json({ tickets: rows });
    } catch (err) {
        return next(err);
    }
}

/**
 * GET /tickets/:id — single ticket with all responses.
 */
async function getTicket(req, res, next) {
    try {
        const ticketId = parseInt(req.params.id, 10);
        if (!Number.isFinite(ticketId)) throw new HttpError(400, 'Invalid ticket id.');

        const userId = req.user ? req.user.id : null;

        const ticketResult = await query(
            `
            SELECT
                t.id, t.title, t.body, t.category, t.status,
                t.upvote_count, t.created_at, t.updated_at,
                u.id AS author_id, u.full_name AS author_name,
                u.email AS author_email, u.role AS author_role,
                CASE
                    WHEN $2::int IS NULL THEN FALSE
                    ELSE EXISTS (
                        SELECT 1 FROM upvotes uv WHERE uv.ticket_id = t.id AND uv.user_id = $2
                    )
                END AS has_upvoted
            FROM tickets t
            JOIN users u ON u.id = t.author_id
            WHERE t.id = $1
            `,
            [ticketId, userId]
        );
        if (!ticketResult.rows.length) throw new HttpError(404, 'Ticket not found.');

        const responsesResult = await query(
            `
            SELECT
                r.id, r.body, r.is_official_admin_response, r.created_at,
                u.id AS author_id, u.full_name AS author_name,
                u.email AS author_email, u.role AS author_role,
                u.admin_category AS author_admin_category
            FROM responses r
            JOIN users u ON u.id = r.author_id
            WHERE r.ticket_id = $1
            ORDER BY r.is_official_admin_response DESC, r.created_at ASC
            `,
            [ticketId]
        );

        return res.json({
            ticket: ticketResult.rows[0],
            responses: responsesResult.rows,
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /tickets — authenticated student (or admin) creates a concern.
 */
async function createTicket(req, res, next) {
    try {
        const { title, body, category } = req.body || {};

        if (typeof title !== 'string' || title.trim().length < 5 || title.length > 200) {
            throw new HttpError(400, 'Title must be between 5 and 200 characters.');
        }
        if (typeof body !== 'string' || body.trim().length < 10) {
            throw new HttpError(400, 'Body must be at least 10 characters.');
        }
        if (!ALLOWED_CATEGORIES.has(category)) {
            throw new HttpError(400, 'Category is required and must be one of the allowed tags.');
        }

        const { rows } = await query(
            `
            INSERT INTO tickets (title, body, author_id, category)
            VALUES ($1, $2, $3, $4)
            RETURNING id, title, body, category, status, upvote_count, created_at, updated_at
            `,
            [title.trim(), body.trim(), req.user.id, category]
        );

        return res.status(201).json({ ticket: rows[0] });
    } catch (err) {
        return next(err);
    }
}

/**
 * PUT /tickets/:id/status — admin only. Additionally, the admin's department
 * must match the ticket's category.
 */
async function updateStatus(req, res, next) {
    try {
        const ticketId = parseInt(req.params.id, 10);
        if (!Number.isFinite(ticketId)) throw new HttpError(400, 'Invalid ticket id.');

        const { status } = req.body || {};
        if (!ALLOWED_STATUSES.has(status)) {
            throw new HttpError(400, 'Status must be Pending, Under Review, or Resolved.');
        }

        // Confirm the ticket exists and the admin is allowed to act on it.
        const existing = await query('SELECT category FROM tickets WHERE id = $1', [ticketId]);
        if (!existing.rows.length) throw new HttpError(404, 'Ticket not found.');

        if (!adminCanActOnCategory(req.user.admin_category, existing.rows[0].category)) {
            throw new HttpError(
                403,
                'Your admin department does not match this ticket category.'
            );
        }

        const { rows } = await query(
            `
            UPDATE tickets SET status = $1 WHERE id = $2
            RETURNING id, title, body, category, status, upvote_count, created_at, updated_at
            `,
            [status, ticketId]
        );

        return res.json({ ticket: rows[0] });
    } catch (err) {
        return next(err);
    }
}

/**
 * POST /tickets/:id/upvote
 *
 * Toggle behavior: if the user already upvoted, the row is removed;
 * otherwise a row is inserted. The composite primary key on upvotes
 * is what actually prevents double voting at the database level — this
 * handler just makes the UX cooperative.
 */
async function toggleUpvote(req, res, next) {
    try {
        const ticketId = parseInt(req.params.id, 10);
        if (!Number.isFinite(ticketId)) throw new HttpError(400, 'Invalid ticket id.');

        const result = await withTransaction(async (client) => {
            // Make sure the ticket exists before doing anything else.
            const ticket = await client.query('SELECT id FROM tickets WHERE id = $1', [ticketId]);
            if (!ticket.rows.length) throw new HttpError(404, 'Ticket not found.');

            // Try to delete an existing upvote first; if nothing deleted, insert.
            const del = await client.query(
                'DELETE FROM upvotes WHERE ticket_id = $1 AND user_id = $2 RETURNING ticket_id',
                [ticketId, req.user.id]
            );

            let has_upvoted;
            if (del.rowCount > 0) {
                has_upvoted = false;
            } else {
                // INSERT ... ON CONFLICT DO NOTHING is belt-and-suspenders against a
                // race where two requests arrive simultaneously.
                await client.query(
                    'INSERT INTO upvotes (ticket_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [ticketId, req.user.id]
                );
                has_upvoted = true;
            }

            const counted = await client.query(
                'SELECT upvote_count FROM tickets WHERE id = $1',
                [ticketId]
            );

            return {
                has_upvoted,
                upvote_count: counted.rows[0].upvote_count,
            };
        });

        return res.json(result);
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    listTickets,
    getTicket,
    createTicket,
    updateStatus,
    toggleUpvote,
};
