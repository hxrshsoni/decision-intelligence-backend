const Database = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs');
const csv = require('csv-parser');

class DataController {
  // Upload Transactions
  static async uploadTransactions(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { userId } = req.user;
      const transactions = [];
      
      // Parse CSV
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (row) => {
            transactions.push({
              amount: parseFloat(row.amount),
              category: row.category,
              description: row.description || '',
              date: row.date,
              type: row.type || 'expense'
            });
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Insert into database
      let inserted = 0;
      for (const transaction of transactions) {
        try {
          await Database.query(
            `INSERT INTO transactions (user_id, amount, category, description, date, type, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [userId, transaction.amount, transaction.category, transaction.description, transaction.date, transaction.type]
          );
          inserted++;
        } catch (err) {
          logger.error('Error inserting transaction:', err);
        }
      }

      // Delete uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Successfully uploaded ${inserted} transactions`,
        data: { inserted, total: transactions.length }
      });
    } catch (error) {
      logger.error('Upload transactions error:', error);
      if (req.file) fs.unlinkSync(req.file.path);
      next(error);
    }
  }

  // Upload Budgets
  static async uploadBudgets(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { userId } = req.user;
      const budgets = [];
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (row) => {
            budgets.push({
              category: row.category,
              amount: parseFloat(row.amount),
              period: row.period || 'monthly'
            });
          })
          .on('end', resolve)
          .on('error', reject);
      });

      let inserted = 0;
      for (const budget of budgets) {
        try {
          await Database.query(
            `INSERT INTO budgets (user_id, category, amount, period, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (user_id, category) 
             DO UPDATE SET amount = $3, period = $4, updated_at = NOW()`,
            [userId, budget.category, budget.amount, budget.period]
          );
          inserted++;
        } catch (err) {
          logger.error('Error inserting budget:', err);
        }
      }

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Successfully uploaded ${inserted} budgets`,
        data: { inserted, total: budgets.length }
      });
    } catch (error) {
      logger.error('Upload budgets error:', error);
      if (req.file) fs.unlinkSync(req.file.path);
      next(error);
    }
  }

  // Upload Goals
  static async uploadGoals(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { userId } = req.user;
      const goals = [];
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (row) => {
            goals.push({
              name: row.name,
              target_amount: parseFloat(row.target_amount),
              current_amount: parseFloat(row.current_amount || 0),
              deadline: row.deadline,
              status: row.status || 'active'
            });
          })
          .on('end', resolve)
          .on('error', reject);
      });

      let inserted = 0;
      for (const goal of goals) {
        try {
          await Database.query(
            `INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [userId, goal.name, goal.target_amount, goal.current_amount, goal.deadline, goal.status]
          );
          inserted++;
        } catch (err) {
          logger.error('Error inserting goal:', err);
        }
      }

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Successfully uploaded ${inserted} goals`,
        data: { inserted, total: goals.length }
      });
    } catch (error) {
      logger.error('Upload goals error:', error);
      if (req.file) fs.unlinkSync(req.file.path);
      next(error);
    }
  }

  // Upload Subscriptions
  static async uploadSubscriptions(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { userId } = req.user;
      const subscriptions = [];
      
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (row) => {
            subscriptions.push({
              name: row.name,
              amount: parseFloat(row.amount),
              billing_cycle: row.billing_cycle || 'monthly',
              next_billing_date: row.next_billing_date,
              is_active: row.is_active !== 'false'
            });
          })
          .on('end', resolve)
          .on('error', reject);
      });

      let inserted = 0;
      for (const subscription of subscriptions) {
        try {
          await Database.query(
            `INSERT INTO subscriptions (user_id, name, amount, billing_cycle, next_billing_date, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [userId, subscription.name, subscription.amount, subscription.billing_cycle, subscription.next_billing_date, subscription.is_active]
          );
          inserted++;
        } catch (err) {
          logger.error('Error inserting subscription:', err);
        }
      }

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Successfully uploaded ${inserted} subscriptions`,
        data: { inserted, total: subscriptions.length }
      });
    } catch (error) {
      logger.error('Upload subscriptions error:', error);
      if (req.file) fs.unlinkSync(req.file.path);
      next(error);
    }
  }

  // Get data summary
  static async getDataSummary(req, res, next) {
    try {
      const { userId } = req.user;

      const transactionsCount = await Database.query(
        'SELECT COUNT(*) as count FROM transactions WHERE user_id = $1',
        [userId]
      );

      const budgetsCount = await Database.query(
        'SELECT COUNT(*) as count FROM budgets WHERE user_id = $1',
        [userId]
      );

      const goalsCount = await Database.query(
        'SELECT COUNT(*) as count FROM goals WHERE user_id = $1',
        [userId]
      );

      const subscriptionsCount = await Database.query(
        'SELECT COUNT(*) as count FROM subscriptions WHERE user_id = $1',
        [userId]
      );

      res.json({
        success: true,
        data: {
          transactions: parseInt(transactionsCount.rows[0].count),
          budgets: parseInt(budgetsCount.rows[0].count),
          goals: parseInt(goalsCount.rows[0].count),
          subscriptions: parseInt(subscriptionsCount.rows[0].count)
        }
      });
    } catch (error) {
      logger.error('Get data summary error:', error);
      next(error);
    }
  }
}

module.exports = DataController;
