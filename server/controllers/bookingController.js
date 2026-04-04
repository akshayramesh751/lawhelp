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
    // Twilio `req.body.From` looks like 'whatsapp:+919902746555'
    const fromNumber = req.body.From ? req.body.From.replace('whatsapp:', '') : '';

    console.log(`[TWILIO WEBHOOK] Received reply: ${incomingMsg} from ${fromNumber}`);

    let responseMessage = `Your response "${incomingMsg}" was logged successfully.`;
    const newStatus = incomingMsg === 'CONFIRM' ? 'confirmed' : incomingMsg === 'REJECT' ? 'rejected' : null;

    if (newStatus) {
      // Find the lawyer with this phone number
      const lawyer = await Lawyer.findOne({ phone: fromNumber });
      
      if (lawyer) {
        // Find most recent pending booking for this lawyer
        const booking = await Booking.findOne({ 
          lawyerId: lawyer._id, 
          status: 'pending' 
        }).sort({ createdAt: -1 }).populate('userId');

        if (booking) {
          booking.status = newStatus;
          await booking.save();
          
          responseMessage = `Successfully ${newStatus} the booking for ${booking.userId ? booking.userId.name : 'client'}.`;

          // Notify the client about the status change
          if (booking.userId && booking.userId.phone) {
            const formattedDate = new Date(booking.date).toLocaleDateString();
            let userMessage = '';
            
            if (newStatus === 'confirmed') {
              userMessage = `✅ Your booking with ${lawyer.name} on ${formattedDate} at ${booking.timeSlot} is confirmed.`;
            } else if (newStatus === 'rejected') {
              userMessage = `❌ Your booking with ${lawyer.name} was not accepted. Please try booking another lawyer.`;
            }

            if (userMessage) {
              await sendWhatsAppMessage(booking.userId.phone, userMessage);
            }
          }
        } else {
          responseMessage = `No pending bookings found to process.`;
        }
      } else {
        responseMessage = `We couldn't find a Lawyer profile matching your phone number.`;
      }
    } else {
      responseMessage = `Invalid command. Please reply CONFIRM or REJECT.`;
    }

    // Respond to Twilio so it stops retrying and optionally sends a message to the lawyer confirming success
    res.set('Content-Type', 'text/xml');
    res.send(`<Response><Message>${responseMessage}</Message></Response>`);
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
