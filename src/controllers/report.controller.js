const DecisionEngine = require('../services/decisionEngine');
const Database = require('../db');
const logger = require('../utils/logger');

class ReportController {
  // Generate new report
  static async generateReport(req, res, next) {
    try {
      const userId = req.user.id;

      // Run decision engine
      const report = await DecisionEngine.generateReport(userId);

      res.json({
        success: true,
        message: 'Report generated successfully',
        data: report
      });
    } catch (error) {
      logger.error('Generate report error:', error);
      next(error);
    }
  }

  // Get latest report
  static async getLatestReport(req, res, next) {
    try {
      const userId = req.user.id;

      const result = await Database.query(
        `SELECT * FROM reports 
         WHERE user_id = $1 
         ORDER BY generated_at DESC 
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: null,
          message: 'No reports found'
        });
      }

      const report = result.rows[0];
      
      // Get warnings and opportunities
      const [warnings, opportunities] = await Promise.all([
        Database.query('SELECT * FROM report_warnings WHERE report_id = $1', [report.id]),
        Database.query('SELECT * FROM report_opportunities WHERE report_id = $1', [report.id])
      ]);

      res.json({
        success: true,
        data: {
          ...report,
          warnings: warnings.rows,
          opportunities: opportunities.rows
        }
      });
    } catch (error) {
      logger.error('Get latest report error:', error);
      next(error);
    }
  }

  // Get all reports
  static async getAllReports(req, res, next) {
    try {
      const userId = req.user.id;

      const result = await Database.query(
        `SELECT id, risk_score, severity_band, severity_label, generated_at 
         FROM reports 
         WHERE user_id = $1 
         ORDER BY generated_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get all reports error:', error);
      next(error);
    }
  }

  // Get report by ID
  static async getReportById(req, res, next) {
    try {
      const userId = req.user.id;
      const reportId = req.params.id;

      const result = await Database.query(
        'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
        [reportId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }

      const report = result.rows[0];

      // Get warnings and opportunities
      const [warnings, opportunities] = await Promise.all([
        Database.query('SELECT * FROM report_warnings WHERE report_id = $1', [report.id]),
        Database.query('SELECT * FROM report_opportunities WHERE report_id = $1', [report.id])
      ]);

      res.json({
        success: true,
        data: {
          ...report,
          warnings: warnings.rows,
          opportunities: opportunities.rows
        }
      });
    } catch (error) {
      logger.error('Get report by ID error:', error);
      next(error);
    }
  }
}

module.exports = ReportController;
