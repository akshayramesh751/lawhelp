const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, htmlContent) => {
  try {
    if (!to) {
      console.warn('⚠️ sendEmail skipped: No recipient email provided.');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail', // Standard integration. User needs to configure standard app password.
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"NyayaConnect Bookings" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SENT] To: ${to} | Subject: ${subject} | ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
};

module.exports = { sendEmail };
