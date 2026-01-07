const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const DataController = require('../controllers/data.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// All routes require authentication
router.use(authMiddleware);

// Upload routes
router.post('/upload/clients', upload.single('file'), DataController.uploadClients);
router.post('/upload/engagements', upload.single('file'), DataController.uploadEngagements);
router.post('/upload/payments', upload.single('file'), DataController.uploadPayments);
router.post('/upload/work-requests', upload.single('file'), DataController.uploadWorkRequests);

// Get data routes
router.get('/clients', DataController.getClients);
router.get('/summary', DataController.getSummary);

module.exports = router;
