const express = require('express');
const router = express.Router();
const { createBooking, getUserBookings, updateBookingStatus, approveBooking, rejectBooking } = require('../controllers/bookingController');
const auth = require('../middleware/auth');

// POST /api/bookings
router.post('/', auth, createBooking);

// GET /api/bookings?userId=
router.get('/', auth, getUserBookings);

router.patch('/:id/status', updateBookingStatus);

// Email Action Routes
router.get('/approve', approveBooking);
router.get('/reject', rejectBooking);

module.exports = router;
