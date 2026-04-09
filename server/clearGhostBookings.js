require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./models/Booking');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    // Delete all bookings to clear ghost data
    await Booking.deleteMany({});
    console.log('Cleared all ghost bookings!');
    process.exit(0);
}).catch(console.error);
