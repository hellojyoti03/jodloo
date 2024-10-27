const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SessionSchema = new mongoose.Schema({
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true, default: 'Full Name' },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true }, // Add this line
  password: { type: String, required: true },
  currency: { type: String, default: 'USD' },
  totalBudget: { type: Number, default: 0 },
  sessions: [SessionSchema],
  expoPushToken: {
    type: String,
    default: null,
  },
  promoCode: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  subscriptionActive: { type: Boolean, default: false }, // Track if the subscription is active
  subscriptionActiveTill: { type: Date, default: null },
  active: { type: Boolean, default: true },
  activeBudgetId: { type: Schema.Types.ObjectId, ref: 'Budget', default: null },
});

module.exports = mongoose.model('User', UserSchema);
