const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/user');
const Influencer = require('../models/Influencer');
const Budget = require('../models/budget');
const Udhaar = require('../models/Udhaar');
const ChatRequest = require('../models/chatRequest');
const ChatRoom = require('../models/chatRoom');
const Goal = require('../models/goal');
const Investment = require('../models/investment');
const OTP = require('../models/otp');
const auth = require('../middleware/auth');
const VerifiedEmail = require('../models/verifiedEmail');
const recordLog = require('../middleware/recordLog');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

// Create a transporter for nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});



sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Generate a random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// User login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    // console.log(user);
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }
    await recordLog(user.id, 'Logged in');

    const payload = {
      user: {
        id: user.id,
      },
    };
    if (!user.active) {
      return res.status(200).json({ msg: 'User is inactive', active: false });
    }
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      async (err, token) => {
        if (err) throw err;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
        console.log(user.active);
        user.sessions.push({ token, expiresAt });
        await user.save(); 
        if (user.active) {
          res.json({ token ,message:"Your Session Is Valid For Next 1 Week",active:true });
        } else {
          res.status(400).json({ msg: 'User is not active' });
        }
      }
    );
  } catch (err) {
    console.error(`Error during login for user ${email}:`, err.message);
    res.status(500).send('Server error');
  }
});


// Initiate the signup process by sending an OTP to the email
router.post('/initiate-signup', async (req, res) => {
  const { email } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists with this email' });
    }

    const otp = generateOTP();

    // const mailOptions = {
    //   from: process.env.GMAIL_USER,
    //   to: email,
    //   subject: 'OTP for Signup',
    //   text: `Your OTP for signup is ${otp}. It is valid for 5 minutes.`,
    // };

    // await transporter.sendMail(mailOptions);

    const msg = {
      to: email,
      from: process.env.SENDGRID_VERIFIED_SENDER, // Replace with your verified sender email in SendGrid
      templateId: process.env.SENDGRID_TEMPLATE_ID, // Replace with your dynamic template ID
      dynamic_template_data: {
        subject: 'Jodloo- Otp FOr Signup',
        otp: otp,
        date:'9/11/2024'
      },
    };

    await sgMail.send(msg); // Send email using SendGrid


    let otpDoc = await OTP.findOne({ email });
    if (otpDoc) {
      otpDoc.otp = otp;
      otpDoc.createdAt = Date.now();
    } else {
      otpDoc = new OTP({ email, otp });
    }

    await otpDoc.save();

    res.status(200).json({ msg: 'OTP sent to email' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Verify the OTP for signup
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const otpDoc = await OTP.findOne({ email });
    if (!otpDoc) {
      return res.status(400).json({ msg: 'OTP not found or expired' });
    }

    if (otpDoc.otp !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }

    // Mark email as verified
    await OTP.deleteOne({ email });

    let verifiedEmail = await VerifiedEmail.findOne({ email });
    if (!verifiedEmail) {
      verifiedEmail = new VerifiedEmail({ email });
      await verifiedEmail.save();
    }

    res.status(200).json({ msg: 'OTP verified. Proceed to complete registration.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/verify-token', auth, async (req, res) => {
  try {
    // If the middleware succeeds, it means the token is valid
    res.status(200).json({ msg: 'Token is valid' });
  } catch (err) {
    console.error('Token verification error:', err.message);
    res.status(401).json({ msg: 'Invalid token' });
  }
});

// Complete the registration process
// Complete the registration process
router.post('/register', async (req, res) => {
  const { fullName, email, username, password, promoCode } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    user = new User({
      fullName,
      email,
      username,
      password,
      promoCode,
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Check if the promo code is valid
    if (promoCode) {
      const influencer = await Influencer.findOne({ promoCode });
      if (!influencer) {
        return res.status(400).json({ msg: 'Invalid promo code' });
      }

      // Optionally, check if the promo code is expired
      if (new Date() > influencer.promoCodeExpiresAt) {
        return res.status(400).json({ msg: 'Promo code expired' });
      }

      // Increment the totalUsers for the influencer
      influencer.totalUsers += 1;
      await influencer.save();
    }

    await user.save();

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, async (err, token) => {
      if (err) throw err;

      // Save token in user's sessions
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      user.sessions.push({ token, expiresAt });
      await user.save(); // Save the user with the new session

      res.json({ token, message: "Your Session Is Valid For Next 1 hr" });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});



//initiate the forgot password process by sending a 6-digit OTP to the email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'User not found with this email' });
    }

    const otp = generateOTP();

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'OTP for Password Reset',
      text: `Your OTP for password reset is ${otp}. It is valid for 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    let otpDoc = await OTP.findOne({ email });
    if (otpDoc) {
      otpDoc.otp = otp;
      otpDoc.createdAt = Date.now();
      otpDoc.verified = false; // Reset verified status if re-initiating the process
      otpDoc.used = false; // Reset used status if re-initiating the process
    } else {
      otpDoc = new OTP({ email, otp });
    }

    await otpDoc.save();

    res.status(200).json({ msg: 'OTP sent to email' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Verify the OTP for password reset
router.post('/verify-otp-for-password', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const otpDoc = await OTP.findOne({ email });
    if (!otpDoc) {
      return res.status(400).json({ msg: 'OTP not found or expired' });
    }

    if (otpDoc.otp !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }

    // Mark OTP as verified
    otpDoc.verified = true;
    await otpDoc.save();

    res.status(200).json({ msg: 'OTP verified. Proceed to reset password.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Set new password after OTP verification
// Set new password after OTP verification
router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    console.log(user)
    if (!user) {
      return res.status(400).json({ msg: 'User not found with this email' });
    }

    const otpDoc = await OTP.findOne({ email });
    if (!otpDoc || !otpDoc.verified) {
      return res.status(400).json({ msg: 'OTP not verified or invalid' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    // Mark OTP as used and delete it
    await OTP.deleteOne({ email });

    res.status(200).json({ msg: 'Password reset successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Logout from all sessions
router.post('/logout-all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.sessions = [];
    await user.save();
    await recordLog(user.id, 'Logged Out');
    res.status(200).json({ msg: 'Logged out from all sessions successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.status(200).json({ msg: 'Password changed successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// // Financial Summary Route
// router.get('/financial-summary', auth, async (req, res) => {
//   try {
//     const userId = req.user.id;

//     // 1. Budget Usage
//     const budgets = await Budget.find({ user: userId, active: true });
//     const budgetSummary = budgets.map(budget => {
//       const totalAmount = budget.categories.reduce((sum, category) => sum + category.amount, 0);
//       const totalUsed = budget.categories.reduce((sum, category) => sum + (category.usedAmount || 0), 0);
//       const percentageUsed = ((totalUsed / totalAmount) * 100).toFixed(2);

//       return {
//         budgetName: budget.budgetName,
//         totalAmount,
//         totalUsed,
//         percentageUsed,
//         categories: budget.categories.map(category => ({
//           category: category.category,
//           amount: category.amount,
//           usedAmount: category.usedAmount || 0,
//           percentageUsed: ((category.usedAmount || 0) / category.amount * 100).toFixed(2),
//         })),
//       };
//     });

//     // 2. Goals
//     const goals = await Goal.find({ user: userId });
//     const goalSummary = goals.map(goal => ({
//       note: goal.note,
//       goalAmount: goal.goalAmount,
//       moneySaved: goal.moneySaved,
//       percentageReached: ((goal.moneySaved / goal.goalAmount) * 100).toFixed(2),
//       daysLeft: Math.ceil((new Date(goal.date) - new Date()) / (1000 * 60 * 60 * 24)),
//     }));

//     // 3. Investments
//     const investments = await Investment.find({ user: userId });
//     const investmentSummary = investments.map(investment => ({
//       account: investment.account,
//       investedAmount: investment.investedAmount,
//       currentValue: investment.currentValue,
//       percentageReached: ((investment.currentValue / investment.investedAmount) * 100).toFixed(2),
//     }));

//     // 4. Udhaar Summary
//     const udhaars = await Udhaar.find({ $or: [{ lender: userId }, { borrower: userId }] });
//     const udhaarSummary = udhaars.map(udhaar => {
//       const installmentDateDiff = (new Date() - new Date(udhaar.dateGiven)) / (1000 * 60 * 60 * 24);
//       const installmentDaysLeft = Math.ceil((new Date(udhaar.repaymentDate) - new Date()) / (1000 * 60 * 60 * 24));
      
//       return {
//         currentInstallmentOverdue: installmentDateDiff > 0 ? `${Math.ceil(installmentDateDiff)} days ago` : 'On time',
//         nextInstallmentDate: udhaar.repaymentDate.toISOString().split('T')[0],
//         totalInstallmentsLeft: installmentDaysLeft,
//         totalReceivableLeft: udhaar.amount - udhaar.amountPaid,
//         currentReceivableOverdue: installmentDateDiff > 0 ? `${Math.ceil(installmentDateDiff)} days extra` : 'On time',
//         nextReceivableDate: udhaar.repaymentDate.toISOString().split('T')[0],
//       };
//     });

//     res.status(200).json({
//       budgetSummary,
//       goalSummary,
//       investmentSummary,
//       udhaarSummary,
//     });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).json({ msg: 'Server error' });
//   }
// });

router.delete('/delete-user', async (req, res) => {
  try {
    const { email, userId } = req.body;

    // Ensure either email or userId is provided
    if (!email && !userId) {
      return res.status(400).json({ msg: 'Please provide either an email address or user ID' });
    }

    let user;
    
    if (userId) {
      // Find user by ID
      user = await User.findById(userId);
    } else if (email) {
      // Find user by email
      user = await User.findOne({ email });
    }

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Delete associated chat requests
    await ChatRequest.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] });

    // Delete associated chat rooms where the user is a participant
    await ChatRoom.deleteMany({ participants: user._id });

    // Delete the user
    await user.remove();

    res.status(200).json({ msg: 'User and all associated data deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});
module.exports = router;
