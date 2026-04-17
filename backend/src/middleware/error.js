/**
 * Catch-all error handler. Controllers can throw or call next(err).
 *
 * Custom errors can set err.status to control the HTTP response code;
 * anything else becomes a generic 500.
 */
function errorHandler(err, req, res, _next) {
    const status = err.status || 500;
    const message = status >= 500 ? 'Internal server error.' : err.message;

    if (status >= 500) {
        console.error('[error]', err);
    }

    res.status(status).json({ error: message });
}

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

module.exports = { errorHandler, HttpError };
