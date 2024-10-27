const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
require('dotenv').config();

module.exports = async function (req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.admin.id);

    if (!admin) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    const session = admin.sessions.find(s => s.token === token);
    if (!session) {
      return res.status(401).json({ msg: 'Token is not valid' });
    }

    req.admin = decoded.admin;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
