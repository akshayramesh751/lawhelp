const express = require('express');
const router = express.Router();
const { createBooking, getUserBookings, updateBookingStatus, handleTwilioWebhook } = require('../controllers/bookingController');

// POST /api/bookings
router.post('/', createBooking);

// GET /api/bookings?userId=
router.get('/', getUserBookings);

router.patch('/:id/status', updateBookingStatus);

// POST /api/bookings/webhook
router.post('/webhook', handleTwilioWebhook);

module.exports = router;
