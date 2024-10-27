const mongoose = require('mongoose');

const InfluencerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  promoCode: {
    type: String,
    required: true,
    unique: true,
  },
  promoCodeExpiresAt: {
    type: Date,
    required: true,
  },
  totalUsers: {
    type: Number,
    default: 0,
  },
  totalPaidSubscribers: {
    type: Number,
    default: 0,
  },
  paidSubscribersThisMonth: {
    type: Number,
    default: 0,
  },
  totalPaid: {
    type: Number,
    default: 0,
  },
  pendingPayment: {
    type: Number,
    default: 0,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  discount: {
    type: Number,
    default: 0, // Discount percentage (e.g., 10 for 10%)
  },
});

module.exports = mongoose.model('Influencer', InfluencerSchema);
