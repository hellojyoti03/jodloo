const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const User = require('../models/user');
const Influencer = require('../models/Influencer');
const jwt = require('jsonwebtoken');
const authAdmin = require('../middleware/authAdmin');
const Log = require('../models/Log');
const successResponse = require('../middleware/successResponse');
require('dotenv').config();

// Admin login


router.post('/login', async (req, res, next) => {
  const { username, password } = req.body;

  try {
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return next({ statusCode: 400, message: 'Invalid credentials' });
    }

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return next({ statusCode: 400, message: 'Invalid credentials' });
    }

    const payload = {
      admin: { id: admin.id },
    };

    // Generate token
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, async (err, token) => {
      if (err) return next(err);

      // Save token to the admin's sessions in the database
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
      admin.sessions.push({ token, expiresAt });
      await admin.save();

      return successResponse(res, 'Admin logged in successfully', { token });
    });
  } catch (err) {
    next(err); // Pass error to custom error handler middleware
  }
});

router.post('/signup', async (req, res, next) => {
  const { username, password } = req.body;

  try {
    // Check if the username already exists
    let admin = await Admin.findOne({ username });
    if (admin) {
      return next({ statusCode: 400, message: 'Admin already exists' });
    }

    // Create a new admin
    admin = new Admin({
      username,
      password,
    });

    // Save the new admin to the database
    await admin.save();

    // Generate a JWT token for the newly created admin
    const payload = {
      admin: {
        id: admin.id,
      },
    };

    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
      if (err) return next(err); // Pass JWT generation error to error handler
      return successResponse(res, 'Admin signed up successfully', { token }); // Use success response utility
    });
  } catch (err) {
    next(err); // Pass error to custom error handler middleware
  }
});

router.get('/subscribers', authAdmin, async (req, res, next) => {
  try {
    // Find all users who have used a promo code
    const users = await User.find({ promoCode: { $ne: null } });

    if (!users.length) {
      return next({ statusCode: 404, message: 'No subscribers found' }); // Use next() for centralized error handling
    }

    // Map users to their corresponding influencer and prepare the response
    const subscriberDetails = await Promise.all(users.map(async (user) => {
      const influencer = await Influencer.findOne({ promoCode: user.promoCode }).lean(); // Use lean() for performance optimization
      return {
        subscriberName: user.fullName,
        dateSignedUp: user.createdAt.toISOString().split('T')[0], // Date the user signed up
        influencer: influencer ? influencer.name : 'Unknown',
        couponCode: user.promoCode,
      };
    }));

    return successResponse(res, 'Subscribers fetched successfully', subscriberDetails); // Use custom success response utility
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});

router.post('/add-influencer', authAdmin, async (req, res, next) => {
  const { name, email, promoCode, promoDurationDays, discount } = req.body;

  try {
    // Check if the promo code already exists
    const existingInfluencer = await Influencer.findOne({ promoCode }).lean(); // Use lean() for performance optimization
    if (existingInfluencer) {
      return next({ statusCode: 400, message: 'Promo code already exists' }); // Use next() for centralized error handling
    }

    const promoCodeExpiresAt = new Date();
    promoCodeExpiresAt.setDate(promoCodeExpiresAt.getDate() + promoDurationDays); // Set expiry date

    const influencer = new Influencer({
      name,
      email,
      promoCode,
      promoCodeExpiresAt,
      discount: discount || 0, // Assign discount or default to 0
    });

    await influencer.save();

    return successResponse(res, 'Influencer added successfully', { influencer }); // Use success response utility
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});


router.put('/update-discount', authAdmin, async (req, res, next) => {
  const { promoCode, discount } = req.body;

  try {
    // Find the influencer by promo code
    const influencer = await Influencer.findOne({ promoCode }).lean(); // Use lean() for performance optimization

    if (!influencer) {
      return next({ statusCode: 404, message: 'Promo code not found' }); // Use next() for centralized error handling
    }

    // Update the discount field and the last updated time
    await Influencer.updateOne(
      { promoCode },
      { $set: { discount, lastUpdated: Date.now() } }
    );

    // Return success response with updated discount
    return successResponse(res, 'Discount updated successfully', { promoCode, discount });
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});

router.put('/update-total-paid', authAdmin, async (req, res, next) => {
  const { promoCode, totalPaid } = req.body;

  try {
    // Find the influencer by promo code
    const influencer = await Influencer.findOne({ promoCode }).lean(); // Use lean() for performance optimization

    if (!influencer) {
      return next({ statusCode: 404, message: 'Promo code not found' }); // Use next() for centralized error handling
    }

    // Update the totalPaid field and the last updated time
    await Influencer.updateOne(
      { promoCode },
      { $set: { totalPaid, lastUpdated: Date.now() } }
    );

    // Return success response with updated totalPaid
    return successResponse(res, 'Total paid updated successfully', { promoCode, totalPaid });
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});

router.put('/update-pending-payment', authAdmin, async (req, res, next) => {
  const { promoCode, pendingPayment } = req.body;

  try {
    // Find the influencer by promo code
    const influencer = await Influencer.findOne({ promoCode }).lean(); // Use lean() for performance optimization

    if (!influencer) {
      return next({ statusCode: 404, message: 'Promo code not found' }); // Use next() for centralized error handling
    }

    // Update the pendingPayment field and the last updated time
    await Influencer.updateOne(
      { promoCode },
      { $set: { pendingPayment, lastUpdated: Date.now() } }
    );

    // Return success response with updated pendingPayment
    return successResponse(res, 'Pending payment updated successfully', { promoCode, pendingPayment });
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});
router.put('/toggle-user-status/:userId', authAdmin, async (req, res, next) => {
  const { userId } = req.params;

  try {
    // Find the user by ID
    const user = await User.findById(userId).lean(); // Use lean() for performance optimization

    if (!user) {
      return next({ statusCode: 404, message: 'User not found' }); // Use next() for centralized error handling
    }

    // Toggle the active status and save the changes
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { active: !user.active } },
      { new: true, lean: true } // Return the updated document and use lean for plain JavaScript objects
    );

    // Return success response with updated user status
    return successResponse(res, `User account has been ${updatedUser.active ? 'activated' : 'deactivated'}`, {
      userId: updatedUser._id,
      status: updatedUser.active ? 'Active' : 'Inactive',
    });
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});

router.get('/users', authAdmin, async (req, res, next) => {
  try {
    // Find all users and select only the required fields
    const users = await User.find({}, 'fullName email active').lean(); // Use lean() for performance optimization

    // Map through users to format the response
    const userDetails = users.map(user => ({
      id: user._id,
      name: user.fullName,
      email: user.email,
      status: user.active ? 'Active' : 'Inactive',
    }));

    // Return success response with user details
    return successResponse(res, 'Users fetched successfully', userDetails);
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});

router.get('/influencer-details/:promoCode', authAdmin, async (req, res, next) => {
  const { promoCode } = req.params;

  try {
    const influencer = await Influencer.findOne({ promoCode }).lean(); // Use lean() for performance optimization

    if (!influencer) {
      return next({ statusCode: 404, message: 'Influencer not found' }); // Use next() for centralized error handling
    }

    const now = new Date();
    const daysLeft = Math.ceil((new Date(influencer.promoCodeExpiresAt) - now) / (1000 * 60 * 60 * 24));
    const isPromoCodeValid = daysLeft > 0;

    // Return success response with influencer details
    return successResponse(res, 'Influencer details fetched successfully', {
      name: influencer.name,
      promoCode: influencer.promoCode,
      totalUsers: influencer.totalUsers,
      totalPaidSubscribers: influencer.totalPaidSubscribers,
      paidSubscribersThisMonth: influencer.paidSubscribersThisMonth,
      promoCodeValidity: isPromoCodeValid ? 'Valid' : 'Expired',
      daysLeftForPromoCode: isPromoCodeValid ? daysLeft : 0,
      totalPaid: influencer.totalPaid,
      pendingPayment: influencer.pendingPayment,
    });
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});

router.get('/influencers', authAdmin, async (req, res, next) => {
  try {
    // Fetch all influencers with lean for better performance
    const influencers = await Influencer.find().lean(); 

    if (!influencers.length) {
      return next({ statusCode: 404, message: 'No influencers found' }); // Use next() for centralized error handling
    }

    // Map influencer details
    const influencerDetails = influencers.map(influencer => {
      const now = new Date();
      const daysLeft = Math.ceil((new Date(influencer.promoCodeExpiresAt) - now) / (1000 * 60 * 60 * 24));
      const isPromoCodeValid = daysLeft > 0;

      return {
        name: influencer.name,
        email: influencer.email,
        promoCode: influencer.promoCode,
        totalUsers: influencer.totalUsers,
        totalPaidSubscribers: influencer.totalPaidSubscribers,
        paidSubscribersThisMonth: influencer.paidSubscribersThisMonth,
        promoCodeValidity: isPromoCodeValid ? 'Valid' : 'Expired',
        daysLeftForPromoCode: isPromoCodeValid ? daysLeft : 0,
        totalPaid: influencer.totalPaid,
        pendingPayment: influencer.pendingPayment,
        lastUpdated: influencer.lastUpdated,
      };
    });

    // Return success response with influencer details
    return successResponse(res, 'Influencers fetched successfully', influencerDetails);
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});

router.get('/verify-token', authAdmin, async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return next({ statusCode: 404, message: 'Admin not found' }); // Use next() for centralized error handling
    }

    // Check if the token exists in the admin's sessions
    const token = req.header('Authorization').split(' ')[1];
    const session = admin.sessions.find(s => s.token === token);

    if (!session) {
      return next({ statusCode: 401, message: 'Token is not valid' }); // Use next() for centralized error handling
    }

    // Return success response
    return successResponse(res, 'Token is valid', { admin });
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});

router.put('/update-subscription', authAdmin, async (req, res, next) => {
  const { email, subscriptionActive, subscriptionActiveTill } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return next({ statusCode: 404, message: 'User not found' }); // Use next() for centralized error handling
    }

    // Update the subscription details
    user.subscriptionActive = subscriptionActive !== undefined ? subscriptionActive : user.subscriptionActive;
    user.subscriptionActiveTill = subscriptionActiveTill ? new Date(subscriptionActiveTill) : user.subscriptionActiveTill;

    // Save the changes to the database
    await user.save();

    // Return success response
    return successResponse(res, 'Subscription details updated successfully', { user });
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});

router.get('/statistics', authAdmin, async (req, res, next) => {
  try {
    // Get the total number of users
    const totalUsers = await User.countDocuments();

    // Get the total number of paid users
    const totalPaidUsers = await User.countDocuments({ subscriptionActive: true });

    // Calculate the percentage of paid users
    const paidUsersPercentage = totalUsers > 0 ? ((totalPaidUsers / totalUsers) * 100).toFixed(2) : 0;

    // Return success response
    return successResponse(res, 'Statistics fetched successfully', {
      totalUsers,
      totalPaidUsers,
      paidUsersPercentage: `${paidUsersPercentage}%`
    });
  } catch (err) {
    next(err); // Pass error to centralized error handler
  }
});

router.get('/subscription-management', authAdmin, async (req, res, next) => {
  try {
    // Find all users
    const users = await User.find();

    // Map through users and create the response structure
    const userDetails = users.map(user => {
      const today = new Date();
      const subscriptionEndDate = user.subscriptionActiveTill;
      const premiumDaysLeft = subscriptionEndDate ? Math.ceil((subscriptionEndDate - today) / (1000 * 60 * 60 * 24)) : 0;

      return {
        name: user.fullName,
        email: user.email,
        premiumStatus: user.subscriptionActive ? 'Active' : 'Inactive',
        subscriptionDate: subscriptionEndDate ? subscriptionEndDate.toISOString().split('T')[0] : 'N/A',
        premiumDaysLeft: user.subscriptionActive ? premiumDaysLeft : 'N/A',
      };
    });

    // Return a standardized success response
    return successResponse(res, 'Subscription management data fetched successfully', userDetails);
  } catch (err) {
    next(err); // Pass the error to the centralized error handler
  }
});

router.put('/assign-30-days-free', authAdmin, async (req, res, next) => {
  try {
    const today = new Date();
    const freeSubscriptionEndDate = new Date(today);
    freeSubscriptionEndDate.setDate(freeSubscriptionEndDate.getDate() + 30);

    // Update all users who do not have an active subscription
    const users = await User.find({
      $or: [
        { subscriptionActive: false },  // Subscription is explicitly inactive
        { subscriptionActive: null },   // Subscription is null
        { subscriptionActive: { $exists: false } } // Subscription field does not exist
      ]
    });

    const updatePromises = users.map(user => {
      user.subscriptionActive = true;
      user.subscriptionActiveTill = freeSubscriptionEndDate;
      return user.save(); // Save each user individually
    });

    await Promise.all(updatePromises); // Wait for all updates to finish

    // Return a standardized success response
    return successResponse(res, '30 days free subscription assigned to all new users', { updatedCount: users.length });
  } catch (err) {
    next(err); // Pass the error to the centralized error handler
  }
});

router.put('/remove-30-days-free', authAdmin, async (req, res, next) => {
  try {
    // Find users with active subscriptions
    const users = await User.find({
      subscriptionActive: true,
      subscriptionActiveTill: { $gte: new Date() },
    });

    // Update users to remove active subscriptions
    const updatePromises = users.map(user => {
      user.subscriptionActive = false;
      user.subscriptionActiveTill = null;
      return user.save(); // Save each user individually
    });

    await Promise.all(updatePromises); // Wait for all updates to finish

    // Return a standardized success response
    return successResponse(res, '30 days free subscription removed from all users', { updatedCount: users.length });
  } catch (err) {
    next(err); // Pass the error to the centralized error handler
  }
});

router.get('/logs', authAdmin, async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  try {
    const currentPage = parseInt(page);
    const perPageLimit = parseInt(limit);

    // Fetch logs with pagination
    const logs = await Log.find()
      .populate('user', 'fullName')
      .sort({ timestamp: -1 }) // Sort by most recent first
      .skip((currentPage - 1) * perPageLimit)
      .limit(perPageLimit);

    // Get the total number of logs for pagination
    const totalLogs = await Log.countDocuments();

    // Format the response using the success response utility
    return successResponse(res, 'Logs retrieved successfully', {
      totalLogs,
      currentPage,
      totalPages: Math.ceil(totalLogs / perPageLimit),
      logs: logs.map(log => ({
        user: log.user.fullName,
        activity: log.activity,
        timestamp: log.timestamp,
      })),
    });
  } catch (err) {
    next(err); // Pass the error to the centralized error handler
  }
});

router.get('/performance-summary', authAdmin, async (req, res, next) => {
  try {
    // Fetch all influencers
    const influencers = await Influencer.find();

    if (!influencers.length) {
      return res.status(404).json({ success: false, msg: 'No influencers found' });
    }

    // Prepare summary data for each influencer
    const performanceSummary = await Promise.all(
      influencers.map(async (influencer) => {
        // Aggregate the users who signed up using the influencer's promo code
        const subscribers = await User.find({ promoCode: influencer.promoCode }, 'fullName subscriptionDate');

        return {
          promoCode: influencer.promoCode,
          influencer: influencer.name,
          subscribersBroughtIn: subscribers.length,
          subscriberDetails: subscribers.map(subscriber => ({
            subscriberName: subscriber.fullName,
            dateSubscribed: subscriber.subscriptionDate,
            influencer: influencer.name,
          }))
        };
      })
    );

    // Use success response utility for consistent response formatting
    return successResponse(res, 'Performance summary retrieved successfully', performanceSummary);
  } catch (err) {
    next(err); // Pass the error to the centralized error handler
  }
});

module.exports = router;
