const mongoose = require('mongoose');

const lawyerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String }, // Added for email notifications
  specializations: [{ type: String }],
  city: { type: String, required: true },
  experience: { type: Number, required: true },
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  cost: { type: Number, required: true },
  languages: [{ type: String }],
  bio: { type: String },
  education: { type: String },
  barRegNo: { type: String },
  winRate: { type: Number },
  casesHandled: { type: Number },
  phone: { type: String }, // for WhatsApp notifications
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Lawyer', lawyerSchema);
