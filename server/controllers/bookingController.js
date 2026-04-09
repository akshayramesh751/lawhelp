const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Lawyer = require('../models/Lawyer');
const { sendEmail } = require('../utils/email');

const createBooking = async (req, res) => {
  try {
    const { lawyerId, date, timeSlot, cost } = req.body;
    
    // Get the real logged-in user from the database using Firebase UID
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) {
      return res.status(404).json({ message: "User profile not found in database. Please log in again." });
    }

    // Server-side lock: prevent creating a booking if slot is already confirmed
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existingConfirmed = await Booking.findOne({
      lawyerId,
      timeSlot,
      status: 'confirmed',
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (existingConfirmed) {
      return res.status(400).json({ message: "This slot is already officially booked and confirmed!" });
    }
    
    const approveToken = uuidv4();
    const rejectToken = uuidv4();

    const booking = new Booking({
      userId: user._id,
      lawyerId,
      date,
      timeSlot,
      cost,
      status: 'pending',
      approveToken,
      rejectToken
    });
    
    const newBooking = await booking.save();

    const lawyer = await Lawyer.findById(lawyerId);

    if (lawyer && lawyer.email) {
      const formattedDate = new Date(date).toLocaleDateString();
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const approveLink = `${baseUrl}/api/bookings/approve?token=${approveToken}`;
      const rejectLink = `${baseUrl}/api/bookings/reject?token=${rejectToken}`;

      const subject = `New Consultation Request from ${user.name}`;
      const htmlContent = `
        <h2>⚖️ NyayaConnect Consultation Request</h2>
        <p><strong>Client:</strong> ${user.name}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time Slot:</strong> ${timeSlot}</p>
        <p><strong>Session Fee:</strong> ₹${cost}</p>
        <br/>
        <p>Please approve or reject this request by clicking one of the links below:</p>
        <a href="${approveLink}" style="padding:10px 15px; background-color:green; color:white; text-decoration:none; border-radius:5px;">Approve Booking</a>
        &nbsp;&nbsp;
        <a href="${rejectLink}" style="padding:10px 15px; background-color:red; color:white; text-decoration:none; border-radius:5px;">Reject Booking</a>
        <br/><br/>
        <p><em>These links will expire if already used.</em></p>
      `;

      // Send alert to Lawyer's email
      await sendEmail(lawyer.email, subject, htmlContent);
    } else {
      console.warn(`Lawyer ${lawyer ? lawyer.name : lawyerId} does not have an email set. Skipping email notification.`);
    }

    res.status(201).json(newBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserBookings = async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) {
      return res.json([]); 
    }
    
    const bookings = await Booking.find({ userId: user._id }).populate('lawyerId', 'name city specializations cost email');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('lawyerId').populate('userId');
    
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    
    if (booking.userId && booking.userId.email) {
      const formattedDate = new Date(booking.date).toLocaleDateString();
      let subject = `Booking Update - ${booking.lawyerId.name}`;
      let htmlContent = '';
      
      if (status === 'confirmed') {
        htmlContent = `<p>✅ Your booking with ${booking.lawyerId.name} on ${formattedDate} at ${booking.timeSlot} is confirmed.</p>`;
      } else if (status === 'rejected') {
        htmlContent = `<p>❌ The lawyer ${booking.lawyerId.name} is currently busy at ${booking.timeSlot} on ${formattedDate}. Please try booking for another day and time.</p>`;
      }

      if (htmlContent) {
        await sendEmail(booking.userId.email, subject, htmlContent);
      }
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveBooking = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token missing.');

    const booking = await Booking.findOne({ approveToken: token }).populate('userId').populate('lawyerId');
    if (!booking) return res.status(404).send('Invalid or expired token.');
    if (booking.tokensUsed) return res.status(400).send('This booking action has already been processed.');

    // Check if another parallel request already got confirmed for this slot
    const startOfDay = new Date(booking.date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(booking.date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const checkConflict = await Booking.findOne({
      lawyerId: booking.lawyerId._id,
      timeSlot: booking.timeSlot,
      status: 'confirmed',
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (checkConflict) {
      // Mark this one as rejected automatically because slot was taken
      booking.status = 'rejected';
      booking.tokensUsed = true;
      await booking.save();
      return res.status(400).send('<h1>Slot Already Booked!</h1><p>You have already confirmed another client for this exact slot. This request was automatically rejected.</p>');
    }

    booking.status = 'confirmed';
    booking.tokensUsed = true;
    await booking.save();

    // Notify client
    if (booking.userId && booking.userId.email) {
      const formattedDate = new Date(booking.date).toLocaleDateString();
      await sendEmail(
        booking.userId.email, 
        `Booking Confirmed - ${booking.lawyerId.name}`, 
        `<p>✅ Your booking with ${booking.lawyerId.name} on ${formattedDate} at ${booking.timeSlot} is confirmed.</p>`
      );
    }

    res.send('<h1>✅ Booking Approved Successfully</h1><p>The client has been notified.</p>');
  } catch (error) {
    res.status(500).send('An error occurred.');
  }
};

const rejectBooking = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token missing.');

    const booking = await Booking.findOne({ rejectToken: token }).populate('userId').populate('lawyerId');
    if (!booking) return res.status(404).send('Invalid or expired token.');
    if (booking.tokensUsed) return res.status(400).send('This booking action has already been processed.');

    booking.status = 'rejected';
    booking.tokensUsed = true;
    await booking.save();

    // Notify client
    if (booking.userId && booking.userId.email) {
      const formattedDate = new Date(booking.date).toLocaleDateString();
      await sendEmail(
        booking.userId.email, 
        `Booking Failed - Session Unavailable with ${booking.lawyerId.name}`, 
        `<p>❌ The lawyer ${booking.lawyerId.name} is currently busy at ${booking.timeSlot} on ${formattedDate}. Please try booking for another day and time.</p>`
      );
    }

    res.send('<h1>❌ Booking Rejected</h1><p>The client has been notified to pick another day and time.</p>');
  } catch (error) {
    res.status(500).send('An error occurred.');
  }
};

module.exports = { createBooking, getUserBookings, updateBookingStatus, approveBooking, rejectBooking };
