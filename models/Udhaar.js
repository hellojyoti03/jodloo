const mongoose = require('mongoose');

const UdhaarSchema = new mongoose.Schema({
  lender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['got', 'given'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  dateGiven: {
    type: Date,
    required: true,
  },
  purpose: {
    type: String,
    required: true,
  },
  repaymentDate: {
    type: Date,
    required: true,
  },
  interestType: {
    type: String,
    enum: ['simple', 'compound'],
    required: true,
  },
  interestRate: {
    type: Number,
    required: true,
  },
  installmentFrequency: {
    type: String,
    enum: ['monthly', 'weekly', 'yearly'],
    required: true,
  },
  installmentAmount: {
    type: Number,
    required: true,
  },
  notes: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Udhaar', UdhaarSchema);
