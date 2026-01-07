const express = require('express');
const cors = require('cors');
// const morgan = require('morgan');
const dotenv = require('dotenv');
const Database = require('./src/db');
const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Create uploads directory at startup
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory at startup');
}

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/data', require('./src/routes/data.routes'));
app.use('/api/reports', require('./src/routes/report.routes'));

// Error handling
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

// Start server
const startServer = async () => {
  try {
    await Database.connect();
    logger.success('Database connected');
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.success(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
