const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user');

// Save FCM token
router.post('/save-token', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({ msg: 'Expo Push Token is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.expoPushToken = expoPushToken;
    await user.save();

    res.status(200).json({ msg: 'Expo Push Token saved successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});


module.exports = router;
