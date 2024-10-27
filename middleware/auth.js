const jwt = require('jsonwebtoken');
const User = require('../models/user');
require('dotenv').config();

module.exports = async function (req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');

  // Check if no token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Extract token
  const token = authHeader.split(' ')[1];

  try {
    // Decode the token to get the user ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch the full user object using the ID from the decoded token
    const user = await User.findById(decoded.user.id);

    if (!user) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    // Check if the token is in the user's sessions
    const session = user.sessions.find((s) => s.token === token);
    if (!session) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    // Attach the full user object to the request
    req.user = user;
    next();
  } catch (err) {
    console.error('Token validation error:', err);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
