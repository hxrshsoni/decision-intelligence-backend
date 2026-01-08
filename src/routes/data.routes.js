const express = require('express');
const router = express.Router();
const DataController = require('../controllers/data.controller');
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// All routes require authentication
router.use(authMiddleware);

// Upload endpoints
router.post('/upload/transactions', upload.single('file'), DataController.uploadTransactions);
router.post('/upload/budgets', upload.single('file'), DataController.uploadBudgets);
router.post('/upload/goals', upload.single('file'), DataController.uploadGoals);
router.post('/upload/subscriptions', upload.single('file'), DataController.uploadSubscriptions);

// Get data summary
router.get('/summary', DataController.getDataSummary);

module.exports = router;
