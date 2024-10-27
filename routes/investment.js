const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Investment = require('../models/investment');
const User = require('../models/user');

// Add new investment
router.post('/add', auth, async (req, res) => {
  const { account, category, investedAmount, note } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const newInvestment = new Investment({
      user: req.user.id,
      account,
      category,
      investedAmount,
      currentValue: investedAmount, // Initial current value equals invested amount
      note,
    });

    await newInvestment.save();

    res.status(201).json({ msg: 'Investment added successfully', investment: newInvestment });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all investments for a user and total investment details
router.get('/', auth, async (req, res) => {
  try {
    const { 'month-year': monthYear } = req.query;

    // Prepare date range based on month-year query parameter
    let startDate;
    let endDate;

    if (monthYear) {
      const [month, year] = monthYear.split('-').map(Number);
      if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 1900 || year > 2100) {
        return res.status(400).json({ msg: 'Invalid month-year format' });
      }

      startDate = new Date(year, month - 1, 1); // Start of the month
      endDate = new Date(year, month, 1); // Start of the next month
    } else {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      startDate = new Date(currentYear, currentMonth, 1); // Start of the current month
      endDate = new Date(currentYear, currentMonth + 1, 1); // Start of the next month
      console.log(startDate)
    }

    const investments = await Investment.find({
      user: req.user.id,
      createdAt: { $gte: startDate, $lt: endDate }
    });

    if (!investments.length) {
      return res.status(200).json({
        investments: [],
        totalInvestedAmount: 0,
        totalCurrentValue: 0,
        totalProfitLoss: 0
      });
    }

    const totalInvestedAmount = investments.reduce((total, investment) => total + investment.investedAmount, 0);
    const totalCurrentValue = investments.reduce((total, investment) => total + investment.currentValue, 0);
    const totalProfitLoss = totalCurrentValue - totalInvestedAmount;

    // Add profit/loss for each investment
    const investmentsWithProfitLoss = investments.map(investment => ({
      ...investment._doc,
      profitLoss: investment.currentValue - investment.investedAmount,
    }));

    res.status(200).json({
      investments: investmentsWithProfitLoss,
      totalInvestedAmount,
      totalCurrentValue,
      totalProfitLoss,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});
router.put('/update/:id', auth, async (req, res) => {
  const { date, investedAmount, currentValue, category, note } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    let investment = await Investment.findById(req.params.id);
    if (!investment || investment.user.toString() !== req.user.id) {
      return res.status(404).json({ msg: 'Investment not found' });
    }

    investment.date = date || investment.date;
    investment.investedAmount = investedAmount !== undefined ? investedAmount : investment.investedAmount;
    investment.currentValue = currentValue !== undefined ? currentValue : investment.currentValue;
    investment.category = category || investment.category;
    investment.note = note || investment.note;

    await investment.save();

    res.status(200).json({ msg: 'Investment updated successfully', investment });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create delete route
router.delete('/delete/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const investment = await Investment.findById(req.params.id);
    if (!investment || investment.user.toString() !== req.user.id) {
      return res.status(404).json({ msg: 'Investment not found' });
    }

    await Investment.deleteOne({ _id: req.params.id });

    res.status(200).json({ msg: 'Investment deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
