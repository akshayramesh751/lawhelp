const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  passwordHash: { type: String } // Optional now, since Firebase manages credentials securely
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
