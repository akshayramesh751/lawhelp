const twilio = require('twilio');

const sendWhatsAppMessage = async (to, message) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_WHATSAPP_FROM;

    if (!accountSid || !authToken || !fromPhone) {
      console.warn('Twilio credentials not found. Skipping message.');
      return;
    }

    const client = twilio(accountSid, authToken);

    // Format phone number to E.164 format if necessary, assuming it starts with '+'
    const toPhone = to.startsWith('+') ? to : `+${to}`;

    const response = await client.messages.create({
      body: message,
      from: `whatsapp:${fromPhone.replace('whatsapp:', '')}`, // Must be 'whatsapp:+...'
      to: `whatsapp:${toPhone}`
    });

    console.log(`WhatsApp message sent! SID: ${response.sid}`);
    return response;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.message);
  }
};

module.exports = { sendWhatsAppMessage };
