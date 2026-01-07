const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided. Authentication required.'
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Add user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email
    };

    logger.debug('User authenticated:', { userId: decoded.userId });
    next();
  } catch (error) {
    logger.error('Authentication failed:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = authMiddleware;
