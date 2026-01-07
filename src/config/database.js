const { Pool } = require('pg');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 30000
      });

      const client = await this.pool.connect();
      logger.info('✅ Database connected successfully');
      client.release();

      this.pool.on('error', (err) => {
        logger.error('Unexpected database pool error:', err);
      });

      return true;
    } catch (error) {
      logger.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  async query(text, params) {
    if (!this.pool) {
      throw new Error('Database not initialized. Call connect() first.');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error('Query error:', { text, error: error.message });
      throw error;
    }
  }

  // THIS METHOD WAS MISSING - ADD IT!
  async getClient() {
    if (!this.pool) {
      throw new Error('Database not initialized. Call connect() first.');
    }
    return await this.pool.connect();
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database connections closed');
    }
  }
}

// Export singleton instance
module.exports = new Database();
