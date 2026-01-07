const express = require('express');
const authRoutes = require('./auth.routes');
const dataRoutes = require('./data.routes');
const reportsRoutes = require('./reports.routes');

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/data', dataRoutes);
router.use('/reports', reportsRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Decision Intelligence Platform API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile (protected)',
        updateProfile: 'PUT /api/auth/profile (protected)'
      },
      data: {
        uploadClients: 'POST /api/data/upload/clients (protected)',
        uploadEngagements: 'POST /api/data/upload/engagements (protected)',
        uploadPayments: 'POST /api/data/upload/payments (protected)',
        uploadWorkRequests: 'POST /api/data/upload/work-requests (protected)',
        getClients: 'GET /api/data/clients (protected)',
        getSummary: 'GET /api/data/summary (protected)'
      },
      reports: {
        generate: 'POST /api/reports/generate (protected)',
        latest: 'GET /api/reports/latest (protected)',
        history: 'GET /api/reports/history (protected)',
        byId: 'GET /api/reports/:id (protected)'
      }
    }
  });
});

module.exports = router;
