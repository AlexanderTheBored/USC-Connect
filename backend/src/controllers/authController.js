const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { resolveRoleForEmail } = require('../config/admins');
const { HttpError } = require('../middleware/error');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /auth/login
 *
 * Body: { credential: <Google ID token from frontend> }
 *
 * Flow:
 *   1. Verify ID token with Google (audience must match our client).
 *   2. Enforce @usc.edu.ph domain — reject everything else.
 *   3. Upsert the user in Postgres, assigning admin role if their email
 *      is listed in ADMIN_CONFIG.
 *   4. Issue our own JWT for subsequent API calls.
 */
async function login(req, res, next) {
    try {
        const { credential } = req.body || {};
        if (!credential) {
            throw new HttpError(400, 'Missing Google credential.');
        }

        // Verify the ID token with Google.
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            throw new HttpError(401, 'Google token did not contain an email.');
        }
        if (!payload.email_verified) {
            throw new HttpError(401, 'Google has not verified this email address.');
        }

        // Strict domain enforcement — this is the security gate.
        const email = String(payload.email).toLowerCase();
        const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || 'usc.edu.ph').toLowerCase();
        const atIndex = email.lastIndexOf('@');
        const domain = atIndex === -1 ? '' : email.slice(atIndex + 1);
        if (domain !== allowedDomain) {
            throw new HttpError(
                403,
                `Only @${allowedDomain} accounts can access this system.`
            );
        }

        // Decide if this email corresponds to an admin.
        const { role, admin_category } = resolveRoleForEmail(email);

        // Upsert. If the row exists and the admin assignment changed in env,
        // update it; otherwise the EXCLUDED clause is a no-op beyond metadata.
        const upsert = await query(
            `
            INSERT INTO users (email, full_name, picture_url, role, admin_category)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO UPDATE SET
                full_name      = EXCLUDED.full_name,
                picture_url    = EXCLUDED.picture_url,
                role           = EXCLUDED.role,
                admin_category = EXCLUDED.admin_category
            RETURNING id, email, full_name, picture_url, role, admin_category, created_at
            `,
            [email, payload.name || null, payload.picture || null, role, admin_category]
        );

        const user = upsert.rows[0];

        // Issue our own JWT. Short subject + role + category are enough to
        // drive the UI without re-fetching the user on every request.
        const token = jwt.sign(
            {
                sub: user.id,
                email: user.email,
                role: user.role,
                admin_category: user.admin_category,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                picture_url: user.picture_url,
                role: user.role,
                admin_category: user.admin_category,
            },
        });
    } catch (err) {
        // google-auth-library throws generic Errors for invalid tokens.
        if (err.name === 'Error' && !err.status) {
            return next(new HttpError(401, 'Invalid Google credential.'));
        }
        return next(err);
    }
}

/**
 * GET /auth/me — returns the current user based on the JWT.
 */
async function me(req, res, next) {
    try {
        const { rows } = await query(
            `SELECT id, email, full_name, picture_url, role, admin_category, created_at
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        if (!rows.length) throw new HttpError(404, 'User not found.');
        return res.json({ user: rows[0] });
    } catch (err) {
        return next(err);
    }
}

module.exports = { login, me };
