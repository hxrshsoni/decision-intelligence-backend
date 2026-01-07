const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error caught by middleware:', err);

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // PostgreSQL specific errors
  if (err.code === '23505') {
    statusCode = 409;
    message = 'Duplicate entry - resource already exists';
  }

  if (err.code === '23503') {
    statusCode = 400;
    message = 'Invalid reference - related resource not found';
  }

  if (err.code === '23502') {
    statusCode = 400;
    message = 'Missing required field';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
