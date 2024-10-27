// routes/subscription.js

const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const auth = require('../middleware/auth');
const User = require('../models/user');
const subscriptionPlans = require('../config/plans'); // Import plans configuration
require('dotenv').config();

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Route to get available subscription plans
router.get('/plans', async (req, res) => {
  try {
    // Fetch all available plans
    // const plans = Object.values(subscriptionPlans);

    res.status(200).json({ subscriptionPlans });
  } catch (err) {
    console.error('Error fetching subscription plans:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Route to create a subscription order
router.post('/buy-subscription', auth, async (req, res) => {
  const { planId } = req.body;

  // Find the selected plan from our configuration
  const selectedPlan = subscriptionPlans[planId];

  if (!selectedPlan) {
    return res.status(400).json({ msg: 'Invalid subscription plan' });
  }

  try {
    // Fetch the user from the database
    const user = await User.findById(req.user.id);

    // Check if the user already has an active subscription
    if (user.subscriptionActive && user.subscriptionActiveTill > new Date()) {
      return res.status(400).json({ msg: 'You already have an active subscription' });
    }

    // Create a new Razorpay subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: selectedPlan.id,
      quantity: selectedPlan.interval_count,
      total_count: selectedPlan.interval_count,
      notes: {
        userId: req.user.id,
      },
    });

    // Respond with the subscription details
    res.status(201).json({
      subscriptionId: subscription.id,
      url: subscription.short_url, // Send the Razorpay key_id to the frontend
    });
  } catch (err) {
    console.error('Error creating subscription:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Route to verify the payment and update user subscription status


router.post('/webhook', express.json({ type: '*/*' }), async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Extract the Razorpay signature from headers
  const razorpaySignature = req.headers['x-razorpay-signature'];

  try {
    // Verify the signature
    const isValidSignature = Razorpay.validateWebhookSignature(
      JSON.stringify(req.body),
      razorpaySignature,
      secret
    );

    if (!isValidSignature) {
      return res.status(400).json({ msg: 'Invalid webhook signature' });
    }

    const event = req.body;

    // Handle subscription-related events
    if (event.event === 'subscription.charged') {
      const subscriptionData = event.payload.subscription.entity;
      const { notes } = subscriptionData;

      // Retrieve the user ID from the notes field
      const userId = notes.userId;
      if (!userId) {
        return res.status(400).json({ msg: 'User ID not found in subscription notes' });
      }

      // Find the user by the extracted userId
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }

      // Get the plan associated with the subscription
      const plan = Object.values(subscriptionPlans).find(p => p.id === subscriptionData.plan_id);
      if (!plan) {
        return res.status(400).json({ msg: 'Subscription plan not found' });
      }

      const duration = plan.interval_count;

      // Update the user's subscription status and expiration date
      user.subscriptionActive = true;
      user.subscriptionActiveTill = new Date();
      user.subscriptionActiveTill.setMonth(user.subscriptionActiveTill.getMonth() + duration);

      await user.save();

      res.status(200).json({ msg: 'Subscription updated successfully' });
    } else {
      res.status(200).json({ msg: 'Event not handled' });
    }
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

  
module.exports = router;
