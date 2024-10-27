const mongoose = require('mongoose');

const VerifiedEmailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  verifiedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('VerifiedEmail', VerifiedEmailSchema);
