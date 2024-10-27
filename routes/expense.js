const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/transactions');
const Budget = require('../models/budget');
const User = require('../models/user');
const transactions = require('../models/transactions');
const Category = require('../models/category');
router.post('/add', auth, async (req, res) => {
    const { type, date, account, category, amount, note } = req.body;

    // Validation for required fields
    if (!type || !date || !account || !category || !amount) {
        return res.status(400).json({ msg: 'Type, date, account, category, and amount are required' });
    }

    // Validate transaction type
    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ msg: 'Invalid transaction type' });
    }

    try {
        // Find the user by their ID
        const user = await User.findById(req.user.id).populate('activeBudgetId');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Handle logic only if it's an expense and the user has an active budget
        if (type === 'expense' && user.activeBudgetId) {
            const budget = user.activeBudgetId;

            // Find the specific category budget
            const categoryBudget = budget.categories.find(cat => cat.category === category);
            if (!categoryBudget) {
                return res.status(400).json({ msg: 'No budget category found for this expense' });
            }

            // Check if there is enough budget in the category
            if (categoryBudget.amount - (categoryBudget.usedAmount || 0) < amount) {
                return res.status(400).json({ msg: 'Insufficient budget amount' });
            }

            // Update the used amount for the category
            categoryBudget.usedAmount = (categoryBudget.usedAmount || 0) + amount;

            // IMPORTANT: Mark the nested array as modified
            budget.markModified('categories');
            await budget.save();
        } else if (type === 'income') {
            // Add the income amount to the user's total income
            user.totalIncome = (user.totalIncome || 0) + amount;
            await user.save();
        }

        // Create a new transaction regardless of budget status
        const transaction = new Transaction({
            user: req.user.id,
            type,
            date,
            account,
            category,
            amount,
            note
        });

        await transaction.save();

        res.status(201).json({ msg: 'Transaction created successfully', transaction });
    } catch (err) {
        console.error("Error while adding transaction:", err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const { 'month-year': monthYear } = req.query;

        // Prepare date range based on month-year query parameter
        let startDate, endDate;

        if (monthYear) {
            const [month, year] = monthYear.split('-').map(Number);
            if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 1900 || year > 2100) {
                return res.status(400).json({ msg: 'Invalid month-year format. Please use MM-YYYY format.' });
            }

            startDate = new Date(year, month - 1, 1); // Start of the specified month
            endDate = new Date(year, month, 1); // Start of the next month
        } else {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            startDate = new Date(currentYear, currentMonth, 1); // Start of the current month
            endDate = new Date(currentYear, currentMonth + 1, 1); // Start of the next month
        }

        // Fetch all categories from the Category model
        const categories = await Category.find();
        const categoryMap = categories.reduce((acc, category) => {
            acc[category.name] = category.logo;  // Map category name to its logo
            return acc;
        }, {});

        // Fetch transactions within the date range
        const transactions = await Transaction.find({
            user: req.user.id,
            date: { $gte: startDate, $lt: endDate }
        });

        // If no transactions found, return an empty response
        if (!transactions || transactions.length === 0) {
            return res.status(200).json({
                transactions: [],
                totalIncome: 0,
                totalExpense: 0,
                total: 0
            });
        }

        let totalIncome = 0;
        let totalExpense = 0;

        // Group transactions by date and calculate total income and total expense for each date
        const transactionsByDate = transactions.reduce((acc, transaction) => {
            const date = transaction.date.toISOString().split('T')[0]; // Format date as YYYY-MM-DD

            // Initialize date entry if not already present
            if (!acc[date]) {
                acc[date] = {
                    transactions: [],
                    totalIncome: 0,
                    totalExpense: 0
                };
            }

            // Get the category logo from the categoryMap, fallback to "Other" logo if not found
            const categoryLogo = categoryMap[transaction.category] || 'https://i.ibb.co/G7j6Bxg/other.png';

            // Separate income and expense and calculate totals
            if (transaction.type === 'income') {
                acc[date].totalIncome += transaction.amount;
                totalIncome += transaction.amount; // Add to overall total income
                acc[date].transactions.push({
                    ...transaction._doc,
                    income: transaction.amount,
                    expense: 0,
                    logo: categoryLogo  // Add category logo
                });
            } else if (transaction.type === 'expense') {
                acc[date].totalExpense += transaction.amount;
                totalExpense += transaction.amount; // Add to overall total expense
                acc[date].transactions.push({
                    ...transaction._doc,
                    income: 0,
                    expense: transaction.amount,
                    logo: categoryLogo  // Add category logo
                });
            }

            return acc;
        }, {});

        // Format the result to have an array of transactions for each date with total income and total expense
        const groupedTransactions = Object.keys(transactionsByDate).map(date => ({
            date,
            transactions: transactionsByDate[date].transactions,
            totalIncome: transactionsByDate[date].totalIncome,
            totalExpense: transactionsByDate[date].totalExpense
        }));

        res.status(200).json({
            transactions: groupedTransactions,
            totalIncome,
            totalExpense,
            total: totalIncome - totalExpense
        });
    } catch (err) {
        console.error("Error fetching transactions:", err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});



router.get('/note-suggestions', auth, async (req, res) => {
    try {
      const { q } = req.query;
  
      // Ensure the query parameter 'q' is provided
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ msg: 'Query parameter "q" is required' });
      }
  
      // Use a regular expression to match notes that start with the provided query string
      const regex = new RegExp(`^${q}`, 'i'); // 'i' flag for case-insensitive
  
      // Find transactions where the note matches the regex pattern
      const matchedNotes = await transactions.find({
        user: req.user.id, // Filter by the authenticated user
        note: { $regex: regex } // Regex search on the 'note' field
      }).distinct('note'); // Only get distinct notes to avoid duplicates
  
      res.status(200).json({
        notes: matchedNotes
      });
    } catch (err) {
      console.error('Error fetching note suggestions:', err.message);
      res.status(500).json({ msg: 'Server error' });
    }
  });

// Expense overview route
router.get('/expense-overview', auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ user: req.user.id });
        if (!transactions || transactions.length === 0) {
            return res.status(404).json({ msg: 'No transactions found' });
        }

        const totalIncome = transactions
            .filter(transaction => transaction.type === 'income')
            .reduce((sum, transaction) => sum + transaction.amount, 0);

        const totalExpense = transactions
            .filter(transaction => transaction.type === 'expense')
            .reduce((sum, transaction) => sum + transaction.amount, 0);

        const categoryExpenses = transactions
            .filter(transaction => transaction.type === 'expense')
            .reduce((acc, transaction) => {
                if (!acc[transaction.category]) {
                    acc[transaction.category] = 0;
                }
                acc[transaction.category] += transaction.amount;
                return acc;
            }, {});

        const categoryList = Object.keys(categoryExpenses).map(category => ({
            category,
            amount: categoryExpenses[category]
        }));

        res.status(200).json({
            totalIncome,
            totalExpense,
            categories: categoryList
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

//create delete api
router.delete('/delete/:id', auth, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ msg: 'Transaction not found' });
        }
        if (transaction.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // If the transaction is an expense, update the budget
        if (transaction.type === 'expense') {
            const budget = await Budget.findOne({ user: req.user.id, active: true });
            if (budget) {
                const categoryBudget = budget.categories.find(cat => cat.category === transaction.category);
                if (categoryBudget) {
                    categoryBudget.amount += transaction.amount;
                    categoryBudget.usedAmount = Math.max((categoryBudget.usedAmount || 0) - transaction.amount, 0);
                    await budget.save();
                }
            }
        }

        await Transaction.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Transaction removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/update/:id', auth, async (req, res) => {
    const { type, date, account, category, amount, note } = req.body;

    if (!type || !date || !account || !category || !amount) {
        return res.status(400).json({ msg: 'Type, date, account, category, and amount are required' });
    }

    if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ msg: 'Invalid transaction type' });
    }

    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ msg: 'Transaction not found' });
        }
        if (transaction.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Handle budget adjustments if the transaction type or amount is changed
        if (transaction.type === 'expense' && (transaction.type !== type || transaction.amount !== amount)) {
            const budget = await Budget.findOne({ user: req.user.id, active: true });
            if (budget) {
                const categoryBudget = budget.categories.find(cat => cat.category === transaction.category);
                if (categoryBudget) {
                    categoryBudget.amount += transaction.amount; // Revert previous amount
                    categoryBudget.usedAmount = Math.max((categoryBudget.usedAmount || 0) - transaction.amount, 0);

                    if (type === 'expense') {
                        categoryBudget.amount -= amount;
                        categoryBudget.usedAmount = (categoryBudget.usedAmount || 0) + amount;
                    }

                    await budget.save();
                }
            }
        }

        transaction.type = type;
        transaction.date = date;
        transaction.account = account;
        transaction.category = category;
        transaction.amount = amount;
        transaction.note = note;

        await transaction.save();

        res.status(200).json({ msg: 'Transaction updated successfully', transaction });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/:id', auth, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ msg: 'Transaction not found' });
        }
        if (transaction.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        res.status(200).json(transaction);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});
module.exports = router;
