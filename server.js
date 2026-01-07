const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const config = require('./src/config/env');
const Database = require('./src/db');
const errorHandler = require('./src/middleware/error.middleware');
const logger = require('./src/utils/logger');
const routes = require('./src/routes');
const WeeklyReportJob = require('./src/jobs/weeklyReport');

const app = express();

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Decision Intelligence Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// Mount API routes
app.use('/api', routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Setup Cron Jobs
const setupCronJobs = () => {
  // Run every Monday at 9:00 AM
  cron.schedule('0 9 * * 1', async () => {
    logger.info('🕐 Cron job triggered: Weekly Report Generation');
    try {
      await WeeklyReportJob.runForAllUsers();
    } catch (error) {
      logger.error('Cron job failed:', error);
    }
  });

  logger.success('✅ Cron jobs scheduled');
  logger.info('📅 Weekly reports: Every Monday at 9:00 AM');
};

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await Database.testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Initialize database schema
    await Database.initialize();

    // Setup cron jobs
    setupCronJobs();

    // Start listening
    app.listen(config.port, () => {
      logger.success(`🚀 Server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API: http://localhost:${config.port}/api`);
      logger.info(`Auth endpoints ready at /api/auth`);
      logger.info(`Data endpoints ready at /api/data`);
      logger.info(`Reports endpoints ready at /api/reports`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
