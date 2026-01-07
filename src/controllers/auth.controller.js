const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('../db');
const config = require('../config/env');
const validators = require('../utils/validators');
const logger = require('../utils/logger');

class AuthController {
  // Register new user
  static async register(req, res, next) {
    try {
      const { email, password, businessName } = req.body;

      // Validate inputs
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      if (!validators.isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }

      if (!validators.isValidPassword(password)) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters'
        });
      }

      // Check if user already exists
      const existingUser = await Database.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Email already registered'
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Create user
      const result = await Database.query(
        `INSERT INTO users (email, password_hash, business_name, created_at, updated_at) 
         VALUES ($1, $2, $3, NOW(), NOW()) 
         RETURNING id, email, business_name, created_at`,
        [email.toLowerCase(), passwordHash, businessName || null]
      );

      const user = result.rows[0];

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: '30d' }
      );

      logger.success('User registered successfully:', { userId: user.id, email: user.email });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            businessName: user.business_name,
            createdAt: user.created_at
          },
          token
        }
      });
    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }

  // Login user
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Validate inputs
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      // Find user
      const result = await Database.query(
        'SELECT id, email, password_hash, business_name FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwtSecret,
        { expiresIn: '30d' }
      );

      logger.success('User logged in successfully:', { userId: user.id, email: user.email });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            businessName: user.business_name
          },
          token
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }

  // Get current user profile
  static async getProfile(req, res, next) {
    try {
      const userId = req.user.id;

      const result = await Database.query(
        'SELECT id, email, business_name, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = result.rows[0];

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          businessName: user.business_name,
          createdAt: user.created_at
        }
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  // Update user profile
  static async updateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const { businessName } = req.body;

      if (!businessName || !validators.isValidBusinessName(businessName)) {
        return res.status(400).json({
          success: false,
          error: 'Valid business name is required'
        });
      }

      const result = await Database.query(
        `UPDATE users 
         SET business_name = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING id, email, business_name, updated_at`,
        [businessName, userId]
      );

      const user = result.rows[0];

      logger.success('Profile updated:', { userId: user.id });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: user.id,
          email: user.email,
          businessName: user.business_name,
          updatedAt: user.updated_at
        }
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }
}

module.exports = AuthController;
