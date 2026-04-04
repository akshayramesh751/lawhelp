const express = require('express');
const router = express.Router();
const { createBooking, getUserBookings, updateBookingStatus, handleTwilioWebhook } = require('../controllers/bookingController');
const auth = require('../middleware/auth');

// POST /api/bookings
router.post('/', auth, createBooking);

// GET /api/bookings?userId=
router.get('/', auth, getUserBookings);

router.patch('/:id/status', updateBookingStatus);

// POST /api/bookings/webhook
router.post('/webhook', handleTwilioWebhook);

module.exports = router;
