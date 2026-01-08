const Database = require('../config/database');
const logger = require('../utils/logger');

class AnalyticsController {
  // Get revenue trends
  static async getRevenueTrends(req, res, next) {
    try {
      const { userId } = req.user;
      const { period = '30' } = req.query; // days

      const result = await Database.query(
        `SELECT 
          DATE(date) as date,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense,
          SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net
        FROM transactions
        WHERE user_id = $1 
        AND date >= CURRENT_DATE - INTERVAL '${period} days'
        GROUP BY DATE(date)
        ORDER BY date ASC`,
        [userId]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get revenue trends error:', error);
      next(error);
    }
  }

  // Get spending by category
  static async getSpendingByCategory(req, res, next) {
    try {
      const { userId } = req.user;
      const { period = '30' } = req.query;

      const result = await Database.query(
        `SELECT 
          category,
          SUM(amount) as total,
          COUNT(*) as count
        FROM transactions
        WHERE user_id = $1 
        AND type = 'expense'
        AND date >= CURRENT_DATE - INTERVAL '${period} days'
        GROUP BY category
        ORDER BY total DESC
        LIMIT 10`,
        [userId]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get spending by category error:', error);
      next(error);
    }
  }

  // Get key metrics
  static async getKeyMetrics(req, res, next) {
    try {
      const { userId } = req.user;

      // Total income
      const incomeResult = await Database.query(
        `SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = $1 AND type = 'income'
        AND date >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      );

      // Total expenses
      const expenseResult = await Database.query(
        `SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = $1 AND type = 'expense'
        AND date >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      );

      // Active goals
      const goalsResult = await Database.query(
        `SELECT COUNT(*) as total
        FROM goals
        WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      // Active subscriptions
      const subsResult = await Database.query(
        `SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as monthly_cost
        FROM subscriptions
        WHERE user_id = $1 AND is_active = true`,
        [userId]
      );

      const income = parseFloat(incomeResult.rows[0].total);
      const expenses = parseFloat(expenseResult.rows[0].total);
      const savingsRate = income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0;

      res.json({
        success: true,
        data: {
          income: income,
          expenses: expenses,
          netCashFlow: income - expenses,
          savingsRate: parseFloat(savingsRate),
          activeGoals: parseInt(goalsResult.rows[0].total),
          activeSubscriptions: parseInt(subsResult.rows[0].total),
          monthlySubscriptionCost: parseFloat(subsResult.rows[0].monthly_cost)
        }
      });
    } catch (error) {
      logger.error('Get key metrics error:', error);
      next(error);
    }
  }

  // Get budget vs actual
  static async getBudgetVsActual(req, res, next) {
    try {
      const { userId } = req.user;

      const result = await Database.query(
        `SELECT 
          b.category,
          b.amount as budget,
          COALESCE(SUM(t.amount), 0) as actual,
          b.amount - COALESCE(SUM(t.amount), 0) as remaining
        FROM budgets b
        LEFT JOIN transactions t ON 
          t.category = b.category 
          AND t.user_id = b.user_id 
          AND t.type = 'expense'
          AND t.date >= CURRENT_DATE - INTERVAL '30 days'
        WHERE b.user_id = $1
        GROUP BY b.id, b.category, b.amount
        ORDER BY b.category`,
        [userId]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get budget vs actual error:', error);
      next(error);
    }
  }

  // Get recent transactions
  static async getRecentTransactions(req, res, next) {
    try {
      const { userId } = req.user;
      const { limit = 10 } = req.query;

      const result = await Database.query(
        `SELECT 
          id,
          amount,
          category,
          description,
          date,
          type,
          created_at
        FROM transactions
        WHERE user_id = $1
        ORDER BY date DESC, created_at DESC
        LIMIT $2`,
        [userId, limit]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get recent transactions error:', error);
      next(error);
    }
  }
}

module.exports = AnalyticsController;
