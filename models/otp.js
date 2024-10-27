const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // 5 minutes
  },
  used: {
    type: Boolean,
    default: false,
  },
  verified:{
    type: Boolean,
    default: false,
  }
});

module.exports = mongoose.model('OTP', OTPSchema);
