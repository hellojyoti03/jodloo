const User = require('../models/user');

const checkSubscription = async (req, res, next) => {
    try {
        // Fetch the user from the database
        // console.log(req)
        const user = await User.findById(req.user.id);

        // Check if the user exists
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Check if the user's subscription is active
        if (!user.subscriptionActive || new Date(user.subscriptionActiveTill) < new Date()) {
            return res.status(403).json({ msg: 'No active subscription found. Please subscribe to use this feature.' });
        }

        // Proceed to the next middleware or route handler
        next();
    } catch (err) {
        console.error('Error checking subscription:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
};

module.exports = checkSubscription;
