// Custom Success Response Utility
const successResponse = (res, message, data = {}) => {
    res.status(200).json({
        success: true,
        message: message || 'Success',
        data: data,
    });
};

module.exports = successResponse;
