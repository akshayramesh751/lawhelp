const Booking = require('../models/Booking');
const User = require('../models/User');
const Lawyer = require('../models/Lawyer');
const { sendWhatsAppMessage } = require('../utils/twilio');

const createBooking = async (req, res) => {
  try {
    const { userId, lawyerId, date, timeSlot, cost } = req.body;
    
    const booking = new Booking({
      userId,
      lawyerId,
      date,
      timeSlot,
      cost,
      status: 'pending'
    });
    
    const newBooking = await booking.save();

    // Fetch User and Lawyer to get their names and phone numbers
    let user = await User.findById(userId);
    if (!user) {
      user = { name: "Test User", phone: "+919902746555" };
    }
    const lawyer = await Lawyer.findById(lawyerId);

    if (user && lawyer && lawyer.phone) {
      const formattedDate = new Date(date).toLocaleDateString();
      const message = `*⚖️ NyayaConnect Consultation Request*\n\n*Client:* ${user.name}\n*Date:* ${formattedDate}\n*Time Slot:* ${timeSlot}\n*Session Fee:* ₹${cost}\n\nPlease reply with *CONFIRM* to accept this booking, or *REJECT* to decline.`;
      
      // Send alert to Lawyer's phone
      await sendWhatsAppMessage(lawyer.phone, message);
    }

    res.status(201).json(newBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Handle Incoming WhatsApp replies from Twilio
const handleTwilioWebhook = async (req, res) => {
  try {
    const incomingMsg = req.body.Body ? req.body.Body.trim().toUpperCase() : '';
    const fromNumber = req.body.From; // 'whatsapp:+91...'

    // IMPORTANT: Twilio needs you to find the most recent pending booking linked to this phone number
    // For now, this is a skeleton showing where the reply logic belongs!
    console.log(`[TWILIO WEBHOOK] Received reply: ${incomingMsg} from ${fromNumber}`);

    // ... you would search MongoDB for the pending booking and update its status here.

    // Respond to Twilio so it stops trying to send the message
    res.set('Content-Type', 'text/xml');
    res.send(`<Response><Message>Your response "${incomingMsg}" was logged successfully.</Message></Response>`);
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).send('Error handling response');
  }
};

const getUserBookings = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId is required' });
    
    const bookings = await Booking.find({ userId }).populate('lawyerId', 'name city specializations cost phone');
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
    
    // We populate lawyerId and userId so we can access their names and phone numbers
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('lawyerId').populate('userId');
    
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    
    // Trigger Twilio WhatsApp for status updates
    if (booking.userId && booking.userId.phone) {
      let message = '';
      const formattedDate = new Date(booking.date).toLocaleDateString();
      
      if (status === 'confirmed') {
        message = `✅ Your booking with ${booking.lawyerId.name} on ${formattedDate} at ${booking.timeSlot} is confirmed.`;
      } else if (status === 'rejected') {
        message = `❌ Your booking with ${booking.lawyerId.name} was not accepted. Please try booking another lawyer.`;
      }

      if (message) {
        // Send alert to User's phone
        await sendWhatsAppMessage(booking.userId.phone, message);
      }
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createBooking, getUserBookings, updateBookingStatus, handleTwilioWebhook };
