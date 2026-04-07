const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth'); // the firebase auth middleware

// POST /api/users/sync
// Syncs a Firebase user to MongoDB (Creates or Updates)
router.post('/sync', auth, async (req, res) => {
  try {
    const { uid, email, name, picture } = req.user; // req.user comes from token
    const { firstName, lastName } = req.body; // passed from frontend

    let user = await User.findOne({ email });

    const displayName = (firstName && lastName) ? `${firstName} ${lastName}` : name || email.split('@')[0];

    if (!user) {
      user = new User({
        firebaseUid: uid,
        email: email,
        name: displayName,
      });
      await user.save();
    } else {
      // If user exists but firebaseUid is missing, update it
      if (!user.firebaseUid) {
        user.firebaseUid = uid;
      }
      user.name = displayName; 
      await user.save();
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ message: 'Internal server error while syncing user' });
  }
});

module.exports = router;
