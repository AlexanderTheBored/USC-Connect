require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const { errorHandler } = require('./middleware/error');
const { pool } = require('./config/db');

// ---------- sanity checks ---------------------------------------------------

const requiredEnv = ['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'JWT_SECRET'];
for (const key of requiredEnv) {
    if (!process.env[key]) {
        console.error(`[startup] Missing required env var: ${key}`);
        process.exit(1);
    }
}

// ---------- app -------------------------------------------------------------

const app = express();
app.set('trust proxy', 1); // needed behind Railway's proxy

app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));

const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, cb) => {
            // Same-origin (no Origin header) and configured origins pass.
            if (!origin || corsOrigins.includes(origin)) return cb(null, true);
            return cb(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true,
    })
);

// ---------- routes ----------------------------------------------------------

app.get('/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok' });
    } catch (err) {
        res.status(503).json({ status: 'db-unavailable', error: err.message });
    }
});

app.use('/auth', authRoutes);
app.use('/tickets', ticketRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(errorHandler);

// ---------- boot ------------------------------------------------------------

const port = parseInt(process.env.PORT, 10) || 4000;
app.listen(port, () => {
    console.log(`[server] USC Routing API listening on :${port}`);
    console.log(`[server] allowed email domain: @${process.env.ALLOWED_EMAIL_DOMAIN || 'usc.edu.ph'}`);
    console.log(`[server] CORS origins: ${corsOrigins.join(', ') || '(none)'}`);
});

// Graceful shutdown so Railway can cycle the container cleanly.
for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, async () => {
        console.log(`[server] Received ${sig}, shutting down...`);
        try {
            await pool.end();
        } catch (err) {
            console.error('[server] Error ending pool:', err.message);
        }
        process.exit(0);
    });
}
