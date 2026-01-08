const CSVParser = require('../services/csvParser');
const DataIngestion = require('../services/dataIngestion');
const Database = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.success('Created uploads directory');
}

class DataController {
  // Upload clients CSV
  static async uploadClients(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const userId = req.user.id;
      const filePath = req.file.path;

      // Parse CSV
      const rows = await CSVParser.parseFile(filePath);
      const normalizedData = CSVParser.normalizeClients(rows);

      // Insert into database
      const result = await DataIngestion.insertClients(userId, normalizedData);

      // Delete uploaded file
      fs.unlink(filePath, (err) => {
        if (err) logger.error('Failed to delete temp file:', err);
      });

      res.json({
        success: true,
        message: 'Clients data uploaded successfully',
        data: {
          totalRows: rows.length,
          inserted: result.insertedCount,
          skipped: result.skippedCount
        }
      });
    } catch (error) {
      logger.error('Upload clients error:', error);
      next(error);
    }
  }

  // Upload engagements CSV
  static async uploadEngagements(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const userId = req.user.id;
      const filePath = req.file.path;

      // Get existing clients for this user
      const clientsResult = await Database.query(
        'SELECT id, name FROM clients WHERE user_id = $1',
        [userId]
      );

      const clientMap = new Map();
      clientsResult.rows.forEach(client => {
        clientMap.set(client.name.toLowerCase(), client.id);
      });

      // Parse CSV
      const rows = await CSVParser.parseFile(filePath);
      const normalizedData = CSVParser.normalizeEngagements(rows);

      // Insert into database
      const result = await DataIngestion.insertEngagements(userId, normalizedData, clientMap);

      // Delete uploaded file
      fs.unlink(filePath, (err) => {
        if (err) logger.error('Failed to delete temp file:', err);
      });

      res.json({
        success: true,
        message: 'Engagements data uploaded successfully',
        data: {
          totalRows: rows.length,
          inserted: result.insertedCount,
          skipped: result.skippedCount
        }
      });
    } catch (error) {
      logger.error('Upload engagements error:', error);
      next(error);
    }
  }

  // Upload payments CSV
  static async uploadPayments(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const userId = req.user.id;
      const filePath = req.file.path;

      // Get existing clients
      const clientsResult = await Database.query(
        'SELECT id, name FROM clients WHERE user_id = $1',
        [userId]
      );

      const clientMap = new Map();
      clientsResult.rows.forEach(client => {
        clientMap.set(client.name.toLowerCase(), client.id);
      });

      // Parse CSV
      const rows = await CSVParser.parseFile(filePath);
      const normalizedData = CSVParser.normalizePayments(rows);

      // Insert into database
      const result = await DataIngestion.insertPayments(userId, normalizedData, clientMap);

      // Delete uploaded file
      fs.unlink(filePath, (err) => {
        if (err) logger.error('Failed to delete temp file:', err);
      });

      res.json({
        success: true,
        message: 'Payments data uploaded successfully',
        data: {
          totalRows: rows.length,
          inserted: result.insertedCount,
          skipped: result.skippedCount
        }
      });
    } catch (error) {
      logger.error('Upload payments error:', error);
      next(error);
    }
  }

  // Upload work requests CSV
  static async uploadWorkRequests(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const userId = req.user.id;
      const filePath = req.file.path;

      // Get existing clients
      const clientsResult = await Database.query(
        'SELECT id, name FROM clients WHERE user_id = $1',
        [userId]
      );

      const clientMap = new Map();
      clientsResult.rows.forEach(client => {
        clientMap.set(client.name.toLowerCase(), client.id);
      });

      // Parse CSV
      const rows = await CSVParser.parseFile(filePath);
      const normalizedData = CSVParser.normalizeWorkRequests(rows);

      // Insert into database
      const result = await DataIngestion.insertWorkRequests(userId, normalizedData, clientMap);

      // Delete uploaded file
      fs.unlink(filePath, (err) => {
        if (err) logger.error('Failed to delete temp file:', err);
      });

      res.json({
        success: true,
        message: 'Work requests data uploaded successfully',
        data: {
          totalRows: rows.length,
          inserted: result.insertedCount,
          skipped: result.skippedCount
        }
      });
    } catch (error) {
      logger.error('Upload work requests error:', error);
      next(error);
    }
  }

  // Get all clients for logged-in user
  static async getClients(req, res, next) {
    try {
      const userId = req.user.id;

      const result = await Database.query(
        `SELECT id, name, email, contract_value, start_date, status, created_at 
         FROM clients 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get clients error:', error);
      next(error);
    }
  }

  // Get data summary
  static async getDataSummary(req, res, next) {
    try {
      const userId = req.user.id;

      const [clients, engagements, payments, workRequests] = await Promise.all([
        Database.query('SELECT COUNT(*) FROM clients WHERE user_id = $1', [userId]),
        Database.query('SELECT COUNT(*) FROM engagements WHERE user_id = $1', [userId]),
        Database.query('SELECT COUNT(*) FROM payments WHERE user_id = $1', [userId]),
        Database.query('SELECT COUNT(*) FROM work_requests WHERE user_id = $1', [userId])
      ]);

      res.json({
        success: true,
        data: {
          clients: parseInt(clients.rows[0].count),
          engagements: parseInt(engagements.rows[0].count),
          payments: parseInt(payments.rows[0].count),
          workRequests: parseInt(workRequests.rows[0].count)
        }
      });
    } catch (error) {
      logger.error('Get data summary error:', error);
      next(error);
    }
  }
}

module.exports = DataController;
