const pool = require('../config/database');

class Database {
  // Generic query method
  static async query(text, params) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Initialize database schema
  static async initialize() {
    try {
      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await pool.query(schema);
      console.log('✅ Database schema initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database schema:', error);
      throw error;
    }
  }

  // Get pool for transactions
  static getPool() {
    return pool;
  }

  // Test connection
  static async testConnection() {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('✅ Database connection test successful:', result.rows[0].now);
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }
}

module.exports = Database;
