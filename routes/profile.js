const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/user');
const crypto = require('crypto');

// Get user profile
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update user currency
router.put('/update-currency', auth, async (req, res) => {
  const { currency } = req.body;

  if (!currency) {
    return res.status(400).json({ msg: 'Currency is required' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.currency = currency;
    await user.save();

    res.status(200).json({ msg: 'Currency updated successfully', currency: user.currency });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Logout all sessions
router.post('/logout-all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.tokenSecret = crypto.randomBytes(16).toString('hex');
    await user.save();

    res.status(200).json({ msg: 'Logged out from all sessions successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all sessions of the logged-in user
router.get('/sessions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.status(200).json(user.sessions);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.delete('/sessions', auth, async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ msg: 'Token is required' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.sessions = user.sessions.filter(session => session.token !== token);
    await user.save();

    res.status(200).json({ msg: 'Session deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

//create an route to check if username is taken or not
router.post('/usernameExists', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ msg: 'Username is required' });
  }

  const user = await User.findOne({ username });

  if (user) {
    return res.status(400).json({ msg: 'Username is already taken' });
  }

  res.status(200).json({ msg: 'Username is available' });
});
module.exports = router;
