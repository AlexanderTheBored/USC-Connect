const express = require('express');
const {
    listTickets,
    getTicket,
    createTicket,
    updateStatus,
    toggleUpvote,
} = require('../controllers/ticketsController');
const { createResponse } = require('../controllers/responsesController');
const { requireAuth, attachUserIfPresent } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

// Public read endpoints — but we still attach the user if a token is present
// so the has_upvoted flag can be computed.
router.get('/', attachUserIfPresent, listTickets);
router.get('/:id', attachUserIfPresent, getTicket);

// Authenticated student (or admin) actions.
router.post('/', requireAuth, createTicket);
router.post('/:id/upvote', requireAuth, toggleUpvote);
router.post('/:id/respond', requireAuth, createResponse);

// Admin-only mutation. Additional department check lives in the controller.
router.put('/:id/status', requireAuth, requireAdmin, updateStatus);

module.exports = router;
