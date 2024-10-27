const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Goal = require('../models/goal');
const User = require('../models/user');

// Add new goal
router.post('/add', auth, async (req, res) => {
  const { date, goalAmount, moneySaved, note } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const newGoal = new Goal({
      user: req.user.id,
      date,
      goalAmount,
      moneySaved,
      note,
    });

    await newGoal.save();

    res.status(201).json({ msg: 'Goal added successfully', goal: newGoal });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all goals for a user and total goals detail
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
    }

    const goals = await Goal.find({
      user: req.user.id,
      createdAt: { $gte: startDate, $lt: endDate }
    });

    if (!goals.length) {
      return res.status(200).json({
        goals: [],
        totalGoalsAmount: 0,
        totalMoneySaved: 0,
        percentageSaved: 0,
      });
    }

    const validGoals = [];
    for (const goal of goals) {
      const today = new Date();
      const targetDate = new Date(goal.date);
      const timeDiff = targetDate - today;
      const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      if (daysLeft >= 0) {
        validGoals.push({
          ...goal._doc,
          daysLeft
        });
      } else {
        await Goal.deleteOne({ _id: goal._id });
      }
    }

    if (!validGoals.length) {
      return res.status(200).json({
        goals: [],
        totalGoalsAmount: 0,
        totalMoneySaved: 0,
        percentageSaved: 0,
      });
    }

    const totalGoalsAmount = validGoals.reduce((total, goal) => total + goal.goalAmount, 0);
    const totalMoneySaved = validGoals.reduce((total, goal) => total + goal.moneySaved, 0);
    const percentageSaved = (totalGoalsAmount === 0) ? 0 : (totalMoneySaved / totalGoalsAmount) * 100;

    res.status(200).json({
      goals: validGoals,
      totalGoalsAmount,
      totalMoneySaved,
      percentageSaved,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});


// Update goal by ID
router.put('/update/:id', auth, async (req, res) => {
  const { date, goalAmount, moneySaved, note } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    let goal = await Goal.findById(req.params.id);
    if (!goal || goal.user.toString() !== req.user.id) {
      return res.status(404).json({ msg: 'Goal not found' });
    }

    goal.date = date || goal.date;
    goal.goalAmount = goalAmount !== undefined ? goalAmount : goal.goalAmount;
    goal.moneySaved = moneySaved !== undefined ? moneySaved : goal.moneySaved;
    goal.note = note || goal.note;

    await goal.save();

    res.status(200).json({ msg: 'Goal updated successfully', goal });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});


router.delete('/delete/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const goal = await Goal.findById(req.params.id);
    if (!goal || goal.user.toString() !== req.user.id) {
      return res.status(404).json({ msg: 'Goal not found' });
    }

    await Goal.deleteOne({ _id: req.params.id });

    res.status(200).json({ msg: 'Goal deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});
module.exports = router;
