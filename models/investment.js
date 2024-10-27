const mongoose = require('mongoose');

const InvestmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  account: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  investedAmount: {
    type: Number,
    required: true,
  },
  currentValue: {
    type: Number,
    required: true,
  },
  note: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Investment', InvestmentSchema);
