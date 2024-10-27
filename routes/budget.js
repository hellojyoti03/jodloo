const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Budget = require('../models/budget');
const User = require('../models/user');
const transactions = require('../models/transactions');
const checkSubscription = require('../middleware/checkSubscription');
const goal = require('../models/goal');
const investment = require('../models/investment');
const Udhaar = require('../models/Udhaar');
const Transaction = require('../models/transactions');
// const transactions = require('../models/transactions');
// const { Transaction } = require('firebase-admin/firestore');
// const transactions = require('../models/transactions');

// Create or update a budget for the user
const validAlertThresholds = ['None', 'Every 10%', 'Every 20%', 'Every 30%', 'Every 50%', 'Remaining 20%', 'Remaining 30%'];
const validResetPeriods = ['Every Day', 'Weekdays', 'Weekend', 'Every Week', 'Every Month', 'Every Year'];

router.post('/', auth, checkSubscription, async (req, res) => {
    const { budgetName, resetPeriod, alertThreshold, categories, usernames } = req.body;

    // Validation for required fields
    if (!budgetName || !resetPeriod || !alertThreshold || !categories || !Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({ msg: 'Budget name, reset period, alert threshold, and a non-empty categories list are required' });
    }

    if (!validAlertThresholds.includes(alertThreshold)) {
        return res.status(400).json({ msg: 'Invalid alert threshold. Valid options are: ' + validAlertThresholds.join(', ') });
    }

    if (!validResetPeriods.includes(resetPeriod)) {
        return res.status(400).json({ msg: 'Invalid reset period. Valid options are: ' + validResetPeriods.join(', ') });
    }

    try {
        // Extract the list of usernames from the input
        const usernameList = usernames.map(u => u.username);

        // console.log("Usernames provided:", usernameList);

        // Find users by provided usernames
        const users = await User.find({ username: { $in: usernameList } });
        // console.log("Users found:", users);
        // console.log("Users found in database:", users.map(user => user.username));

        // Check if all usernames were found
        if (users.length !== usernameList.length) {
            const foundUsernames = users.map(user => user.username);

            const notFound = usernameList.filter(username => !foundUsernames.includes(username));
            return res.status(400).json({ msg: `One or more usernames are invalid: ${notFound.join(', ')}` });
        }

        // Map users to collaborators with their respective roles
        const collaborators = users.map(user => {
            const usernameData = usernames.find(u => u.username === user.username);
            return {
                user: user._id,
                accessLevel: user._id.equals(req.user.id) ? 'owner' : (usernameData.role || 'viewer') // Default to 'viewer' if no role is provided
            };
        });

        // Ensure the authenticated user is assigned the owner role
        const isOwnerAssigned = collaborators.some(collab => collab.user.equals(req.user.id) && collab.accessLevel === 'owner');
        if (!isOwnerAssigned) {
            collaborators.push({
                user: req.user.id,
                accessLevel: 'owner'
            });
        }

        // Create the new budget
        const budgetCategories = categories.map(categoryData => ({
            category: categoryData.category,
            amount: categoryData.amount,
            usedAmount: 0
        }));

        const budget = new Budget({
            collaborators, // Include the collaborators array
            budgetName,
            resetPeriod,
            alertThreshold,
            categories: budgetCategories,
            active: false
        });

        await budget.save();

        res.status(201).json({ msg: 'Budget created successfully' });
    } catch (err) {
        console.error("Error while creating budget:", err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/', auth, checkSubscription, async (req, res) => {
    try {
        // Find budgets where the user is either an owner or collaborator
        const budgets = await Budget.find({
            'collaborators.user': req.user.id
        }).populate('collaborators.user', 'fullName email');

        if (!budgets || budgets.length === 0) {
            return res.status(404).json({ msg: 'No budgets found' });
        }

        // Fetch the user's active budget ID
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const activeBudgetId = user.activeBudgetId ? user.activeBudgetId.toString() : null;

        const budgetDetails = budgets.map(budget => {
            // Find the role of the authenticated user for this budget
            const userRole = budget.collaborators.find(collab => collab.user.toString() === req.user.id)?.accessLevel || 'unknown';

            return {
                _id: budget._id,
                budgetName: budget.budgetName,
                resetPeriod: budget.resetPeriod,
                alertThreshold: budget.alertThreshold,
                totalAmount: budget.categories.reduce((total, category) => total + category.amount, 0),
                categories: budget.categories,
                active: budget._id.toString() === activeBudgetId, // Check if this budget is the active one
                userRole: userRole, // Add the role of the authenticated user
                collaborators: budget.collaborators.map(collab => ({
                    userId: collab.user._id,
                    fullName: collab.user.fullName,
                    email: collab.user.email,
                    accessLevel: collab.accessLevel
                }))
            };
        });

        res.status(200).json({ budgets: budgetDetails });
    } catch (err) {
        console.error("Error fetching budgets:", err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});


router.put('/:id', auth, checkSubscription, async (req, res) => {
    try {
        const budget = await Budget.findById(req.params.id);
        if (!budget) {
            return res.status(404).json({ msg: 'Budget not found' });
        }

        const isOwner = budget.user.toString() === req.user.id;
        const collaborator = budget.collaborators.find(collab => collab.user.toString() === req.user.id);

        if (!isOwner && (!collaborator || collaborator.accessLevel !== 'editor')) {
            return res.status(403).json({ msg: 'User not authorized to update this budget' });
        }

        // Proceed with update logic...
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});


router.get('/users', auth, checkSubscription, async (req, res) => {
    try {
        const users = await User.find({}, 'username fullName');

        res.status(200).json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});


router.post('/activate/:id', auth, checkSubscription, async (req, res) => {
    try {
        const userId = req.user.id;

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Check if the budget exists and the user is either an owner or a collaborator
        const budget = await Budget.findOne({
            _id: req.params.id,
            'collaborators.user': userId // Check if the user is a collaborator
        });

        if (!budget) {
            return res.status(404).json({ msg: 'Budget not found or user is not authorized' });
        }

        // Update the user's document to set this budget as the active budget
        user.activeBudgetId = budget._id;
        await user.save();

        res.status(200).json({ msg: 'Budget activated successfully', budget });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.delete('/:id', auth, checkSubscription, async (req, res) => {
    try {
        const budget = await Budget.findOneAndDelete({ _id: req.params.id, user: req.user.id });

        if (!budget) {
            return res.status(404).json({ msg: 'Budget not found' });
        }

        // Update total budget
        const user = await User.findById(req.user.id);
        user.totalBudget -= budget.categories.reduce((total, category) => total + category.amount, 0);
        await user.save();

        res.status(200).json({ msg: 'Budget deleted successfully', totalBudget: user.totalBudget });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});


router.delete('/', auth, checkSubscription, async (req, res) => {
    try {
        const budgets = await Budget.deleteMany({ user: req.user.id });

        if (budgets.deletedCount === 0) {
            return res.status(404).json({ msg: 'No budgets to delete' });
        }

        // Reset total budget
        const user = await User.findById(req.user.id);
        user.totalBudget = 0;
        await user.save();

        res.status(200).json({ msg: 'All budgets cleared successfully', totalBudget: user.totalBudget });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/active-categories', auth, async (req, res) => {
    try {
        const activeBudget = await Budget.findOne({ 'collaborators.user': req.user.id });

        if (!activeBudget) {
            // If no active budget is found, return sample categories
            const sampleCategories = [
                { category: 'Food', amount: 100 },
                { category: 'Transport', amount: 50 },
                { category: 'Groceries', amount: 200 },
                { category: 'Entertainment', amount: 150 },
                { category: 'Utilities', amount: 100 },
                { category: 'Healthcare', amount: 75 },
                { category: 'Personal Care', amount: 80 },
                { category: 'Miscellaneous', amount: 45 }
            ];
            
            return res.status(200).json({
                msg: 'No active budget found. Here are some sample categories.',
                budgetId: null,
                budgetName: 'Sample Budget',
                categories: sampleCategories
            });
        }

        const categories = activeBudget.categories.map(category => ({
            category: category.category,
            amount: category.amount
        }));

        res.status(200).json({
            budgetId: activeBudget._id,
            budgetName: activeBudget.budgetName,
            categories
        });
    } catch (err) {
        console.error("Error fetching active categories:", err.message);  // Improved error log
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/overview', auth, checkSubscription, async (req, res) => {
    try {
        // Find the user by their ID and populate activeBudgetId
        const user = await User.findById(req.user.id).populate('activeBudgetId');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Use the populated activeBudgetId to get the active budget
        const activeBudget = user.activeBudgetId;

        // If no active budget is found, respond with an error
        if (!activeBudget) {
            return res.status(404).json({ msg: 'No active budget found for this user' });
        }

        // Initialize total budget and used amounts
        let totalBudget = 0;
        let totalUsed = 0;

        // Fetch the user's transactions related to this budget
        const transactionsList = await Transaction.find({ user: req.user.id, type: 'expense' });

        // Calculate the used amount for each category
        const budgetUtilization = activeBudget.categories.map(category => {
            // Filter the transactions to only those that belong to the current category
            const categoryTransactions = transactionsList.filter(transaction => transaction.category === category.category);

            // Sum the amounts for the category's transactions to get the used amount
            const categoryUsedAmount = categoryTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

            // Add the category's amount to the total budget
            totalBudget += category.amount;

            // Add the category's used amount to the total used
            totalUsed += categoryUsedAmount;

            return {
                category: category.category,
                usedAmount: categoryUsedAmount,
                usedPercentage: category.amount > 0 
                    ? ((categoryUsedAmount / category.amount) * 100).toFixed(2)
                    : '0.00',  // Avoid division by zero
                totalAmount: category.amount
            };
        });

        // Create an array to hold the category details with their percentage of the total budget
        const categories = activeBudget.categories.map(category => ({
            category: category.category,
            amount: category.amount,
            percentageOfTotalBudget: totalBudget > 0 
                ? ((category.amount / totalBudget) * 100).toFixed(2)
                : '0.00'  // Avoid division by zero
        }));

        // Calculate total income and total expense
        const totalIncome = await Transaction.aggregate([
            { $match: { user: req.user.id, type: 'income' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        
        const totalExpense = await Transaction.aggregate([
            { $match: { user: req.user.id, type: 'expense' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const netTotal = (totalIncome[0]?.total || 0) - (totalExpense[0]?.total || 0);

        // Respond with the overview data
        res.status(200).json({
            totalBudget,
            totalUsed,
            budgetUtilization,
            categories,
            totalIncome: totalIncome[0]?.total || 0,
            totalExpense: totalExpense[0]?.total || 0,
            netTotal,
            latestBudget: {
                name: activeBudget.budgetName,  // Ensure 'budgetName' is used instead of 'name'
                used: totalUsed,  // Used amount for the active budget
                total: totalBudget  // Total budget amount for the active budget
            }
        });
    } catch (err) {
        console.error("Error fetching overview data:", err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});





router.get('/financial-summary', auth, async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Fetch user with populated active budget and collaborators
        const user = await User.findById(userId).populate({
            path: 'activeBudgetId',
            populate: {
                path: 'collaborators.user',
                select: 'fullName email',
            },
        });

        let budgetSummary = null;

        // Check if the user has an active budget
        if (user && user.activeBudgetId) {
            // Get active budget directly from the populated user document
            const activeBudget = user.activeBudgetId;

            // Calculate budget summary for the active budget
            const totalAmount = activeBudget.categories.reduce((sum, category) => sum + category.amount, 0);
            const totalUsed = activeBudget.categories.reduce((sum, category) => sum + (category.usedAmount || 0), 0);
            const percentageUsed = totalAmount > 0 ? ((totalUsed / totalAmount) * 100).toFixed(2) : '0.00';

            budgetSummary = {
                budgetId: activeBudget._id,
                budgetName: activeBudget.budgetName,
                totalAmount,
                totalUsed,
                percentageUsed,
                categories: activeBudget.categories.map((category) => ({
                    category: category.category,
                    amount: category.amount,
                    usedAmount: category.usedAmount || 0,
                    percentageUsed: ((category.usedAmount || 0) / category.amount * 100).toFixed(2),
                })),
            };
        }

        // Fetch Goals, Investments, and Udhaar in parallel to optimize fetching time
        const [goals, investments, udhaars] = await Promise.all([
            goal.find({ user: userId }),
            investment.find({ user: userId }),
            Udhaar.find({ $or: [{ lender: userId }, { borrower: userId }] }),
        ]);

        // Calculate goal summary
        const goalSummary = goals.map((goal) => ({
            goalName: goal.note,
            goalAmount: goal.goalAmount,
            moneySaved: goal.moneySaved,
            percentageReached: ((goal.moneySaved / goal.goalAmount) * 100).toFixed(2),
            daysLeft: Math.ceil((new Date(goal.date) - new Date()) / (1000 * 60 * 60 * 24)),
        }));

        // Calculate investment summary
        const investmentSummary = investments.map((investment) => ({
            investmentName: investment.account,
            investedAmount: investment.investedAmount,
            currentValue: investment.currentValue,
            percentageReached: ((investment.currentValue / investment.investedAmount) * 100).toFixed(2),
        }));

        // Calculate Udhaar summary
        const udhaarSummary = udhaars.map((udhaar) => {
            const installmentDateDiff = (new Date() - new Date(udhaar.dateGiven)) / (1000 * 60 * 60 * 24);
            const installmentDaysLeft = Math.ceil((new Date(udhaar.repaymentDate) - new Date()) / (1000 * 60 * 60 * 24));

            return {
                currentInstallmentOverdue: installmentDateDiff > 0 ? `${Math.ceil(installmentDateDiff)} days ago` : 'On time',
                nextInstallmentDate: udhaar.repaymentDate.toISOString().split('T')[0],
                totalInstallmentsLeft: installmentDaysLeft,
                totalReceivableLeft: udhaar.amount - (udhaar.amountPaid || 0),
                currentReceivableOverdue: installmentDateDiff > 0 ? `${Math.ceil(installmentDateDiff)} days extra` : 'On time',
                nextReceivableDate: udhaar.repaymentDate.toISOString().split('T')[0],
            };
        });

        // Respond with the aggregated data
        res.status(200).json({
            success: true,
            message: 'Financial summary retrieved successfully',
            data: {
                budgetSummary: budgetSummary || 'No active budget found', // Respond with 'No active budget found' if null
                goalSummary,
                investmentSummary,
                udhaarSummary,
            },
        });
    } catch (err) {
        console.error('Error fetching financial summary data:', err.message);
        next(err); // Pass to the centralized error handler
    }
});



const calculateOverdue = (installmentDate, frequency) => {
    const now = new Date();
    const dueDate = new Date(installmentDate);

    if (frequency === 'monthly') {
        dueDate.setMonth(dueDate.getMonth() + 1);
    } else if (frequency === 'weekly') {
        dueDate.setDate(dueDate.getDate() + 7);
    } else if (frequency === 'yearly') {
        dueDate.setFullYear(dueDate.getFullYear() + 1);
    }

    return now > dueDate;
};

// Utility function to calculate the next installment date
const getNextInstallmentDate = (dateGiven, frequency, installmentNumber) => {
    const nextDate = new Date(dateGiven);
    if (frequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + installmentNumber);
    } else if (frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + installmentNumber * 7);
    } else if (frequency === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + installmentNumber);
    }
    return nextDate;
};
const formatAmount = (amount) => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

router.get('/analysis', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch the user's budgets
        const budgets = await Budget.find({ 'collaborators.user': userId });
        let budgetData = [];
        let totalBudget = 0;
        let totalUsed = 0;

        // Prepare budget data for pie chart
        if (budgets.length > 0) {
            budgets.forEach(budget => {
                budget.categories.forEach(category => {
                    const usedPercentage = ((category.usedAmount / category.amount) * 100).toFixed(2);
                    budgetData.push({
                        category: category.category,
                        usedPercentage: parseFloat(usedPercentage),
                        amount: category.amount,
                        color: '#' + Math.floor(Math.random() * 16777215).toString(16) // Random color for simplicity
                    });
                    totalBudget += category.amount;
                    totalUsed += category.usedAmount || 0;
                });
            });
        }

        // Fetch Udhaar data (Liabilities and Assets)
        const udhaarRecords = await Udhaar.find({
            $or: [{ lender: userId }, { borrower: userId }]
        });

        let totalInvestments = 0; // Placeholder for investment calculation logic
        let totalLiabilities = 0;
        let liabilities = [];

        // Calculate liabilities and assets from Udhaar
        udhaarRecords.forEach(record => {
            const isLender = record.lender.toString() === userId;
            const isBorrower = record.borrower.toString() === userId;
            const totalAmount = record.amount + (record.amount * record.interestRate / 100);

            if (isBorrower) {
                totalLiabilities += totalAmount;
                liabilities.push({
                    description: record.purpose,
                    amount: formatAmount(totalAmount),
                    nextInstallmentDate: record.repaymentDate,
                    overdue: calculateOverdue(record.dateGiven, record.installmentFrequency)
                });
            }
        });

        // Fetch transactions data (Income and Expense)
        const transactionsList = await transactions.find({ user: userId });
        let incomeCount = 0, expenseCount = 0, incomeAmount = 0, expenseAmount = 0;

        transactionsList.forEach(transaction => {
            if (transaction.type === 'income') {
                incomeCount++;
                incomeAmount += transaction.amount;
            } else if (transaction.type === 'expense') {
                expenseCount++;
                expenseAmount += transaction.amount;
            }
        });

        // Prepare response data
        const responseData = {
            netWorth: formatAmount(totalInvestments - totalLiabilities),
            totalInvestments: formatAmount(totalInvestments),
            totalLiabilities: formatAmount(totalLiabilities),
            transactionsSummary: {
                income: { count: incomeCount, amount: formatAmount(incomeAmount) },
                expense: { count: expenseCount, amount: formatAmount(expenseAmount) },
                overall: { count: incomeCount + expenseCount, amount: formatAmount(incomeAmount - expenseAmount) }
            },
            budgetData, // Pie chart data
            liabilities
        };

        // Send response
        res.status(200).json(responseData);
    } catch (err) {
        console.error("Error fetching financial info:", err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/active-budget', auth, checkSubscription, async (req, res) => {
    try {
        // Find the user and populate the active budget
        const user = await User.findById(req.user.id).populate({
            path: 'activeBudgetId',
            populate: {
                path: 'collaborators.user', // Populate collaborators' user details
                select: 'fullName email'
            }
        });
        // console.log(user);
        if (!user || !user.activeBudgetId) {
            return res.status(404).json({ msg: 'No active budget found for the user' });
        }

        // Prepare response with budget details
        const activeBudget = user.activeBudgetId;
        const budgetData = {
            budgetId: activeBudget._id,
            budgetName: activeBudget.budgetName,
            resetPeriod: activeBudget.resetPeriod,
            alertThreshold: activeBudget.alertThreshold,
            categories: activeBudget.categories.map(category => ({
                category: category.category,
                amount: category.amount,
                usedAmount: category.usedAmount || 0
            })),
            collaborators: activeBudget.collaborators.map(collab => ({
                userId: collab.user._id,
                fullName: collab.user.fullName,
                email: collab.user.email,
                accessLevel: collab.accessLevel
            })),
            createdAt: activeBudget.createdAt
        };

        res.status(200).json(budgetData);
    } catch (err) {
        console.error("Error fetching active budget:", err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});
module.exports = router;
