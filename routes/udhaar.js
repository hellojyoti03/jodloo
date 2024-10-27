const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Udhaar = require('../models/Udhaar');
const User = require('../models/user');
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

const calculateInstallments = (amount, interestRate, interestType, repaymentDate, dateGiven, installmentFrequency) => {
  const timePeriodInYears = (new Date(repaymentDate) - new Date(dateGiven)) / (1000 * 60 * 60 * 24 * 365);

  if (timePeriodInYears <= 0) {
    throw new Error('Repayment date must be later than date given');
  }

  let totalAmount;
  const frequencyMultiplier = installmentFrequency === 'monthly' ? 12 : installmentFrequency === 'weekly' ? 52 : 1;

  // Simple interest calculation
  if (interestType === 'simple') {
    totalAmount = amount + (amount * interestRate / 100 * timePeriodInYears);
  } 
  // Compound interest calculation
  else if (interestType === 'compound') {
    totalAmount = amount * Math.pow((1 + interestRate / (100 * frequencyMultiplier)), frequencyMultiplier * timePeriodInYears);
  } else {
    throw new Error('Invalid interest type');
  }

  // Calculate number of installments
  const totalInstallments = timePeriodInYears * frequencyMultiplier;

  if (totalInstallments <= 0) {
    throw new Error('Total installments must be greater than zero');
  }

  // Calculate each installment amount
  const installmentAmount = totalAmount / totalInstallments;

  return {
    totalAmount,
    totalInstallments: Math.round(totalInstallments), // Rounding the number of installments
    installmentAmount
  };
};


// Add new Udhaar
router.post('/add', auth, async (req, res) => {
  const {
    usernameOrEmail,
    type,
    amount,
    dateGiven,
    purpose,
    repaymentDate,
    interestType,
    interestRate,
    installmentFrequency,
    installmentAmount, // Optional now
    notes
  } = req.body;

  // Validate the input fields
  if (!amount || !dateGiven || !repaymentDate || !interestType || !interestRate || !installmentFrequency) {
    return res.status(400).json({ msg: 'All fields are required' });
  }

  try {
    const lender = await User.findById(req.user.id);
    if (!lender) {
      return res.status(404).json({ msg: 'Lender not found' });
    }

    const borrower = await User.findOne({ $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }] });
    if (!borrower) {
      return res.status(404).json({ msg: 'Borrower not found' });
    }

    // Calculate installments
    const { totalAmount, totalInstallments, installmentAmount: calculatedInstallmentAmount } = calculateInstallments(
      amount, interestRate, interestType, repaymentDate, dateGiven, installmentFrequency
    );

    console.log('Total Amount:', totalAmount);
    console.log('Total Installments:', totalInstallments);
    console.log('Calculated Installment Amount:', calculatedInstallmentAmount);

    // Check if provided installmentAmount is within acceptable range
    if (installmentAmount && Math.abs(installmentAmount - calculatedInstallmentAmount) > 100) {
      return res.status(400).json({ 
        msg: 'Provided installment amount is incorrect. It should be close to: ' + calculatedInstallmentAmount.toFixed(2) 
      });
    }

    const newUdhaar = new Udhaar({
      lender: type === 'given' ? req.user.id : borrower.id,
      borrower: type === 'got' ? req.user.id : borrower.id,
      type,
      amount,
      totalAmount,
      dateGiven,
      purpose,
      repaymentDate,
      interestType,
      interestRate,
      installmentFrequency,
      installmentAmount: calculatedInstallmentAmount || installmentAmount, // Use calculated amount or provided
      notes
    });

    await newUdhaar.save();

    res.status(201).json({ msg: 'Udhaar added successfully', udhaar: newUdhaar });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

const calculateInstallmentsHelper = (amount, interestRate, interestType, repaymentDate, dateGiven, installmentFrequency) => {
  const startDate = new Date(dateGiven);
  const endDate = new Date(repaymentDate);
  const timeDiffInDays = (endDate - startDate) / (1000 * 60 * 60 * 24); // Difference in days

  let totalAmount;

  // Calculate number of installments based on frequency
  let totalInstallments;
  if (installmentFrequency.toLowerCase() === 'weekly') {
      totalInstallments = Math.floor(timeDiffInDays / 7); // Number of weeks
  } else if (installmentFrequency.toLowerCase() === 'monthly') {
      totalInstallments = Math.floor(timeDiffInDays / 30); // Number of months
  } else if (installmentFrequency.toLowerCase() === 'yearly') {
      totalInstallments = Math.floor(timeDiffInDays / 365); // Number of years
  }

  // Ensure there's at least 1 installment
  if (totalInstallments < 1) {
      totalInstallments = 1;
  }

  // Simple interest calculation
  if (interestType === 'simple') {
      const timePeriodInYears = timeDiffInDays / 365;
      totalAmount = amount + (amount * interestRate / 100 * timePeriodInYears);
  } 
  // Compound interest calculation
  else if (interestType === 'compound') {
      const frequencyMultiplier = installmentFrequency.toLowerCase() === 'monthly' ? 12 :
                                  installmentFrequency.toLowerCase() === 'weekly' ? 52 : 1;
      const timePeriodInYears = timeDiffInDays / 365;
      totalAmount = amount * Math.pow((1 + interestRate / (100 * frequencyMultiplier)), frequencyMultiplier * timePeriodInYears);
  }

  // Each installment amount
  const installmentAmount = totalAmount / totalInstallments;

  return {
      totalAmount,
      totalInstallments, // Number of installments
      installmentAmount: installmentAmount.toFixed(2) // Format installment amount
  };
};

router.post('/calculate-installments', async (req, res) => {
  const { 
      amount, 
      dateGiven, 
      repaymentDate, 
      interestType, 
      interestRate, 
      installmentFrequency 
  } = req.body;

  // Validate required fields
  if (!amount || !dateGiven || !repaymentDate || !interestType || !interestRate || !installmentFrequency) {
      return res.status(400).json({ msg: 'All fields are required' });
  }

  try {
      // Convert string inputs to numbers where necessary
      const parsedAmount = parseFloat(amount);
      const parsedInterestRate = parseFloat(interestRate);

      // Call the helper function to calculate installment details
      const installmentDetails = calculateInstallmentsHelper(
          parsedAmount,
          parsedInterestRate,
          interestType,
          repaymentDate,
          dateGiven,
          installmentFrequency
      );

      res.status(200).json({
          totalAmount: installmentDetails.totalAmount,
          totalInstallments: installmentDetails.totalInstallments,
          installmentAmount: installmentDetails.installmentAmount
      });
  } catch (err) {
      console.error('Error calculating installments:', err.message);
      res.status(500).json({ msg: 'Server error' });
  }
});



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

// Route to get financial information
router.get('/financial-info', auth, async (req, res) => {
  try {
      const userId = req.user.id;
      const udhaarRecords = await Udhaar.find({
          $or: [{ lender: userId }, { borrower: userId }]
      }).populate('borrower', 'username email').populate('lender', 'username email');

      let amountToGive = 0;
      let amountToReceive = 0;
      let monthlyInstallment = 0;
      let monthlyReceivables = 0;
      let nextInstallments = [];
      let nextReceivables = [];
      let overdueInstallments = [];
      let overdueReceivables = [];

      const now = new Date();

      const installmentDetails = udhaarRecords.map(record => {
          const isLender = record.lender && record.lender._id.toString() === userId;
          const isBorrower = record.borrower && record.borrower._id.toString() === userId;
          const totalAmount = record.amount + (record.amount * record.interestRate / 100);
          const installmentsLeft = Math.ceil((new Date(record.repaymentDate) - now) / (1000 * 60 * 60 * 24 * (record.installmentFrequency === 'monthly' ? 30 : record.installmentFrequency === 'weekly' ? 7 : 365)));
          const amountPaid = totalAmount - (record.installmentAmount * installmentsLeft);
          const nextInstallmentDate = getNextInstallmentDate(record.dateGiven, record.installmentFrequency, Math.floor((now - new Date(record.dateGiven)) / (1000 * 60 * 60 * 24 * (record.installmentFrequency === 'monthly' ? 30 : record.installmentFrequency === 'weekly' ? 7 : 365))));

          const detail = {
              loanTo: isLender ? (record.borrower ? record.borrower.username : 'Unknown Borrower') : (record.lender ? record.lender.username : 'Unknown Lender'),
              totalAmountToBePaid: totalAmount,
              nextInstallmentDate: nextInstallmentDate,
              eachInstallment: record.installmentAmount,
              installmentsLeft: installmentsLeft,
              amountPaid: amountPaid,
              interestRate: record.interestRate
          };

          if (isLender) {
              amountToReceive += totalAmount;
              nextReceivables.push(detail);
              if (calculateOverdue(record.dateGiven, record.installmentFrequency)) {
                  overdueReceivables.push(detail);
              }
          } else if (isBorrower) {
              amountToGive += totalAmount;
              nextInstallments.push(detail);
              if (calculateOverdue(record.dateGiven, record.installmentFrequency)) {
                  overdueInstallments.push(detail);
              }
          }

          return detail;
      });

      res.status(200).json({
          amountToGive,
          amountToReceive,
          monthlyInstallment,
          monthlyReceivables,
          nextInstallments,
          nextReceivables,
          overdueInstallments,
          overdueReceivables,
          installmentDetails
      });
  } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Server error' });
  }
});






// Get all Udhaar for a user
router.get('/', auth, async (req, res) => {
  try {
    const udhaarRecords = await Udhaar.find({ lender: req.user.id }).populate('borrower', 'username email');

    if (!udhaarRecords.length) {
      return res.status(200).json({
        udhaar: [],
      });
    }

    res.status(200).json({ udhaar: udhaarRecords });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Udhaar by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const udhaar = await Udhaar.findById(req.params.id).populate('borrower', 'username email');
    if (!udhaar) {
      return res.status(404).json({ msg: 'Udhaar not found' });
    }
    if (udhaar.lender.toString() !== req.user.id && udhaar.borrower.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    res.status(200).json(udhaar);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update Udhaar by ID
router.put('/update/:id', auth, async (req, res) => {
  const {
    amount,
    dateGiven,
    purpose,
    repaymentDate,
    interestType,
    interestRate,
    installmentFrequency,
    installmentAmount,
    notes
  } = req.body;

  try {
    let udhaar = await Udhaar.findById(req.params.id);
    if (!udhaar) {
      return res.status(404).json({ msg: 'Udhaar not found' });
    }
    if (udhaar.lender.toString() !== req.user.id && udhaar.borrower.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    udhaar.amount = amount !== undefined ? amount : udhaar.amount;
    udhaar.dateGiven = dateGiven || udhaar.dateGiven;
    udhaar.purpose = purpose || udhaar.purpose;
    udhaar.repaymentDate = repaymentDate || udhaar.repaymentDate;
    udhaar.interestType = interestType || udhaar.interestType;
    udhaar.interestRate = interestRate !== undefined ? interestRate : udhaar.interestRate;
    udhaar.installmentFrequency = installmentFrequency || udhaar.installmentFrequency;
    udhaar.installmentAmount = installmentAmount !== undefined ? installmentAmount : udhaar.installmentAmount;
    udhaar.notes = notes || udhaar.notes;

    await udhaar.save();

    res.status(200).json({ msg: 'Udhaar updated successfully', udhaar });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete Udhaar by ID
router.delete('/delete/:id', auth, async (req, res) => {
  try {
    const udhaar = await Udhaar.findById(req.params.id);
    if (!udhaar) {
      return res.status(404).json({ msg: 'Udhaar not found' });
    }
    if (udhaar.lender.toString() !== req.user.id && udhaar.borrower.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    await udhaar.remove();
    res.status(200).json({ msg: 'Udhaar deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});


//create an route to validate if username or email belongs to an existing user or not if exists than respond 200 or else 400
router.post('/validate', async (req, res) => {
  try {
    const { usernameOrEmail } = req.body;
    const user = await User.findOne({ $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }] });
    console.log(user);

    if (user) {
      return res.status(200).json({ valid: true ,username: user.username, email: user.email  });
    }else{
      return res.status(400).json({ valid: false });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});
module.exports = router;
