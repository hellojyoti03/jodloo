// Custom Error Handler Middleware
const errorHandler = (err, req, res, next) => {
  console.error("Error:", err.message);

  // Check if res is a valid response object
  if (typeof res.status === 'function') {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Server Error',
      error: err.error || {},
    });
  } else {
    console.error('Invalid response object detected. Cannot send error response.');
    next(err); // In case something goes wrong, ensure it does not block the process
  }
};

module.exports = errorHandler;
