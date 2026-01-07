const express = require('express');
const ReportController = require('../controllers/reports.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Generate new report
router.post('/generate', ReportController.generateReport);

// Get latest report
router.get('/latest', ReportController.getLatestReport);

// Get all reports for user
router.get('/', ReportController.getAllReports);

// Get specific report by ID
router.get('/:id', ReportController.getReportById);

module.exports = router;
