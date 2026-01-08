const Database = require('../config/database');

const logger = require('../utils/logger');

class DecisionEngine {
  // Generate comprehensive report for a user
  static async generateReport(userId) {
    logger.info(`Generating report for user: ${userId}`);

    try {
      // Fetch all user data
      const [
        transactions,
        budgets,
        goals,
        subscriptions,
        userProfile
      ] = await Promise.all([
        this.getUserTransactions(userId),
        this.getUserBudgets(userId),
        this.getUserGoals(userId),
        this.getUserSubscriptions(userId),
        this.getUserProfile(userId)
      ]);

      // Calculate financial metrics
      const metrics = this.calculateMetrics(transactions, budgets, goals, subscriptions);

      // Calculate risk score (0-100)
      const riskScore = this.calculateRiskScore(metrics);

      // Determine severity band
      const { band, label } = this.determineSeverityBand(riskScore);

      // Generate warnings
      const warnings = this.generateWarnings(metrics, riskScore);

      // Generate opportunities
      const opportunities = this.generateOpportunities(metrics, userProfile);

      // Save report to database
      const reportId = await this.saveReport(
        userId,
        riskScore,
        band,
        label,
        metrics,
        warnings,
        opportunities
      );

      return {
        id: reportId,
        riskScore,
        severityBand: band,
        severityLabel: label,
        metrics,
        warnings,
        opportunities,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error generating report:', error);
      throw error;
    }
  }

  // Fetch user transactions
  static async getUserTransactions(userId) {
    const result = await Database.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC LIMIT 100',
      [userId]
    );
    return result.rows;
  }

  // Fetch user budgets
  static async getUserBudgets(userId) {
    const result = await Database.query(
      'SELECT * FROM budgets WHERE user_id = $1',
      [userId]
    );
    return result.rows;
  }

  // Fetch user goals
  static async getUserGoals(userId) {
    const result = await Database.query(
      'SELECT * FROM goals WHERE user_id = $1',
      [userId]
    );
    return result.rows;
  }

  // Fetch user subscriptions
  static async getUserSubscriptions(userId) {
    const result = await Database.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    return result.rows;
  }

  // Fetch user profile
  static async getUserProfile(userId) {
    const result = await Database.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0];
  }

  // Calculate financial metrics
  static calculateMetrics(transactions, budgets, goals, subscriptions) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filter transactions for current month
    const monthlyTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    // Calculate totals
    const totalIncome = monthlyTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalExpenses = Math.abs(monthlyTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0));

    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    // Calculate budget utilization
    const budgetUtilization = budgets.map(budget => {
      const categoryExpenses = monthlyTransactions
        .filter(t => t.category === budget.category && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      return {
        category: budget.category,
        spent: categoryExpenses,
        limit: parseFloat(budget.amount),
        utilization: (categoryExpenses / parseFloat(budget.amount)) * 100
      };
    });

    // Calculate subscription costs
    const monthlySubscriptionCost = subscriptions.reduce(
      (sum, sub) => sum + parseFloat(sub.amount),
      0
    );

    return {
      totalIncome,
      totalExpenses,
      savingsRate,
      budgetUtilization,
      monthlySubscriptionCost,
      subscriptionCount: subscriptions.length,
      activeGoals: goals.filter(g => g.status === 'active').length
    };
  }

  // Calculate risk score (0-100)
  static calculateRiskScore(metrics) {
    let score = 0;

    // High expenses relative to income (30 points)
    if (metrics.totalIncome > 0) {
      const expenseRatio = metrics.totalExpenses / metrics.totalIncome;
      if (expenseRatio > 0.9) score += 30;
      else if (expenseRatio > 0.8) score += 20;
      else if (expenseRatio > 0.7) score += 10;
    }

    // Low savings rate (25 points)
    if (metrics.savingsRate < 5) score += 25;
    else if (metrics.savingsRate < 10) score += 15;
    else if (metrics.savingsRate < 20) score += 5;

    // Budget overruns (25 points)
    const overBudgetCount = metrics.budgetUtilization.filter(b => b.utilization > 100).length;
    if (overBudgetCount > 0) {
      score += Math.min(25, overBudgetCount * 10);
    }

    // High subscription costs (20 points)
    if (metrics.totalIncome > 0) {
      const subRatio = metrics.monthlySubscriptionCost / metrics.totalIncome;
      if (subRatio > 0.2) score += 20;
      else if (subRatio > 0.15) score += 10;
    }

    return Math.min(100, score);
  }

  // Determine severity band
  static determineSeverityBand(score) {
    if (score >= 75) return { band: 4, label: 'Critical' };
    if (score >= 50) return { band: 3, label: 'High' };
    if (score >= 25) return { band: 2, label: 'Medium' };
    return { band: 1, label: 'Low' };
  }

  // Generate warnings based on metrics
  static generateWarnings(metrics, riskScore) {
    const warnings = [];

    // Budget warnings
    metrics.budgetUtilization.forEach(budget => {
      if (budget.utilization > 100) {
        warnings.push({
          type: 'budget_exceeded',
          category: budget.category,
          severity: 'high',
          message: `You've exceeded your ${budget.category} budget by ${(budget.utilization - 100).toFixed(1)}%`,
          amount: budget.spent - budget.limit
        });
      } else if (budget.utilization > 80) {
        warnings.push({
          type: 'budget_warning',
          category: budget.category,
          severity: 'medium',
          message: `You've used ${budget.utilization.toFixed(1)}% of your ${budget.category} budget`,
          amount: budget.spent
        });
      }
    });

    // Savings warnings
    if (metrics.savingsRate < 10) {
      warnings.push({
        type: 'low_savings',
        severity: 'high',
        message: `Your savings rate is only ${metrics.savingsRate.toFixed(1)}%. Aim for at least 20%.`,
        currentRate: metrics.savingsRate
      });
    }

    // Subscription warnings
    if (metrics.totalIncome > 0) {
      const subRatio = (metrics.monthlySubscriptionCost / metrics.totalIncome) * 100;
      if (subRatio > 15) {
        warnings.push({
          type: 'high_subscriptions',
          severity: 'medium',
          message: `Subscriptions account for ${subRatio.toFixed(1)}% of your income`,
          amount: metrics.monthlySubscriptionCost
        });
      }
    }

    return warnings;
  }

  // Generate opportunities for improvement
  static generateOpportunities(metrics, userProfile) {
    const opportunities = [];

    // Budget optimization
    if (metrics.budgetUtilization.length === 0) {
      opportunities.push({
        type: 'create_budget',
        priority: 'high',
        message: 'Create budgets to better track your spending',
        potentialSavings: 0
      });
    }

    // Subscription optimization
    if (metrics.subscriptionCount > 3) {
      opportunities.push({
        type: 'review_subscriptions',
        priority: 'medium',
        message: `Review your ${metrics.subscriptionCount} subscriptions for unused services`,
        potentialSavings: metrics.monthlySubscriptionCost * 0.3
      });
    }

    // Savings goal
    if (metrics.savingsRate < 20) {
      const targetSavings = metrics.totalIncome * 0.2;
      const currentSavings = metrics.totalIncome - metrics.totalExpenses;
      opportunities.push({
        type: 'increase_savings',
        priority: 'high',
        message: `Increase savings by reducing expenses by $${(targetSavings - currentSavings).toFixed(2)}`,
        potentialSavings: targetSavings - currentSavings
      });
    }

    return opportunities;
  }

  // Save report to database
  static async saveReport(userId, riskScore, band, label, metrics, warnings, opportunities) {
    const client = await Database.getClient();

    try {
      await client.query('BEGIN');

      // Insert report
      const reportResult = await client.query(
        `INSERT INTO reports 
         (user_id, risk_score, severity_band, severity_label, metrics, generated_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING id`,
        [userId, riskScore, band, label, JSON.stringify(metrics)]
      );

      const reportId = reportResult.rows[0].id;

      // Insert warnings
      for (const warning of warnings) {
        await client.query(
          `INSERT INTO report_warnings 
           (report_id, type, category, severity, message, amount) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            reportId,
            warning.type,
            warning.category || null,
            warning.severity,
            warning.message,
            warning.amount || null
          ]
        );
      }

      // Insert opportunities
      for (const opp of opportunities) {
        await client.query(
          `INSERT INTO report_opportunities 
           (report_id, type, priority, message, potential_savings) 
           VALUES ($1, $2, $3, $4, $5)`,
          [reportId, opp.type, opp.priority, opp.message, opp.potentialSavings || 0]
        );
      }

      await client.query('COMMIT');
      return reportId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = DecisionEngine;
