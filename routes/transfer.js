const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transfer = require('../models/transfer');
const User = require('../models/user');

// Add new transfer
router.post('/add', auth, async (req, res) => {
  const { dateTime, account, from, to, amount, note } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const newTransfer = new Transfer({
      user: req.user.id,
      dateTime,
      account,
      from,
      to,
      amount,
      note,
    });

    await newTransfer.save();

    res.status(201).json({ msg: 'Transfer added successfully', transfer: newTransfer });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all transfers for a user
router.get('/', auth, async (req, res) => {
  try {
    const transfers = await Transfer.find({ user: req.user.id });

    if (!transfers.length) {
      return res.status(404).json({ msg: 'No transfers found' });
    }

    const totalSent = transfers.reduce((acc, transfer) => acc + (transfer.from === req.user.id ? transfer.amount : 0), 0);
    const totalReceived = transfers.reduce((acc, transfer) => acc + (transfer.to === req.user.id ? transfer.amount : 0), 0);
    const totalAmount = transfers.reduce((acc, transfer) => acc + transfer.amount, 0);

    res.status(200).json({ 
      transfers, 
      totalTransactions: totalAmount,
      totalSent,
      totalReceived,
      totalAmount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});
// Update transfer by ID
router.put('/update/:id', auth, async (req, res) => {
  const { dateTime, account, from, to, amount, note } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    let transfer = await Transfer.findById(req.params.id);
    if (!transfer || transfer.user.toString() !== req.user.id) {
      return res.status(404).json({ msg: 'Transfer not found' });
    }

    transfer.dateTime = dateTime || transfer.dateTime;
    transfer.account = account || transfer.account;
    transfer.from = from || transfer.from;
    transfer.to = to || transfer.to;
    transfer.amount = amount !== undefined ? amount : transfer.amount;
    transfer.note = note || transfer.note;

    await transfer.save();

    res.status(200).json({ msg: 'Transfer updated successfully', transfer });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
