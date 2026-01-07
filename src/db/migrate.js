const Database = require('../config/database');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
require('dotenv').config();

async function runMigration() {
  try {
    // Connect to database
    await Database.connect();
    
    // Read SQL file
    const sqlPath = path.join(__dirname, '../../database_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute SQL
    await Database.query(sql);
    
    logger.info('✅ Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
