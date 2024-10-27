const Log = require('../models/Log');
const User = require('../models/user');

async function recordLog(userId, activity) {
  try {
    const log = new Log({
      user: userId,
      activity,
    });
    await log.save();
  } catch (err) {
    console.error('Error recording log:', err.message);
  }
}

module.exports = recordLog;
