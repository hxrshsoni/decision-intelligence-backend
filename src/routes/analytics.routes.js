const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analytics.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Analytics endpoints
router.get('/revenue-trends', AnalyticsController.getRevenueTrends);
router.get('/spending-by-category', AnalyticsController.getSpendingByCategory);
router.get('/key-metrics', AnalyticsController.getKeyMetrics);
router.get('/budget-vs-actual', AnalyticsController.getBudgetVsActual);
router.get('/recent-transactions', AnalyticsController.getRecentTransactions);

module.exports = router;
