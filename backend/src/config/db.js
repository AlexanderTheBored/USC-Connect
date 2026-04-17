const { Pool } = require('pg');

/**
 * PostgreSQL connection pool.
 *
 * Railway's Postgres plugin provides DATABASE_URL automatically. The SSL
 * configuration below is what Railway expects in production; locally against
 * a plain postgres instance we skip SSL.
 */
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
    // Log and keep running — do not crash on a single bad client.
    console.error('[db] Unexpected idle client error:', err.message);
});

/**
 * Thin wrapper that logs slow queries in development.
 */
async function query(text, params) {
    const started = Date.now();
    const result = await pool.query(text, params);
    const elapsed = Date.now() - started;
    if (!isProduction && elapsed > 200) {
        console.warn(`[db] Slow query (${elapsed}ms):`, text.replace(/\s+/g, ' ').slice(0, 120));
    }
    return result;
}

/**
 * Run a function inside a transaction, automatically committing or rolling
 * back. Use this for the upvote toggle and any multi-statement logic.
 */
async function withTransaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { pool, query, withTransaction };
