const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CategorySchema = new Schema({
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  usedAmount: { type: Number, default: 0 }
});

// Define an Access Level schema
const AccessLevelSchema = new Schema({
  user: { type: String, required: true }, // Store user ID as a string
  accessLevel: { 
    type: String, 
    enum: ['owner', 'editor', 'viewer'], // Define different access levels
    required: true 
  }
});

const BudgetSchema = new Schema({
  collaborators: [AccessLevelSchema], // Array of collaborators with their access levels
  budgetName: { type: String, required: true },
  resetPeriod: { type: String, required: true },
  alertThreshold: { type: String, required: true },
  categories: [CategorySchema],
});

module.exports = mongoose.model('Budget', BudgetSchema);