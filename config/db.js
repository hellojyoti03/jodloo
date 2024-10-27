const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const clientOptions = { serverApi: { version: '1', strict: false, deprecationErrors: true } };

    await mongoose.connect(process.env.MONGODB_URI, clientOptions);
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
