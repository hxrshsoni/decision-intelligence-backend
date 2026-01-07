const express = require('express');
const ReportsController = require('../controllers/reports.controller');
const authMiddleware = require('../middleware/auth.middleware');
const WeeklyReportJob = require('../jobs/weeklyReport');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Generate new report
router.post('/generate', ReportsController.generateReport);

// Get latest report
router.get('/latest', ReportsController.getLatestReport);

// Get report history
router.get('/history', ReportsController.getReportHistory);

// Get specific report by ID
router.get('/:id', ReportsController.getReportById);

// Manual trigger for weekly report (for testing)
router.post('/trigger-weekly', async (req, res, next) => {
  try {
    const userId = req.user.id;
    logger.info('Manual weekly report trigger for user:', userId);
    
    const report = await WeeklyReportJob.runForUser(userId);
    
    res.json({
      success: true,
      message: 'Weekly report generated and email sent!',
      data: report
    });
  } catch (error) {
    logger.error('Manual trigger failed:', error);
    next(error);
  }
});

module.exports = router;
