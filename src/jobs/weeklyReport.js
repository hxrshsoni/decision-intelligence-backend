const RuleEngine = require('../engine/ruleEngine');
const Scorer = require('../engine/scorer');
const Database = require('../db');
const EmailService = require('../services/emailService');
const logger = require('../utils/logger');

class WeeklyReportJob {
  // Run weekly reports for all users
  static async runForAllUsers() {
    try {
      logger.info('========== WEEKLY REPORT JOB STARTED ==========');
      const startTime = Date.now();

      // Get all active users
      const usersResult = await Database.query(
        'SELECT id, email, business_name FROM users ORDER BY id'
      );

      logger.info(`Found ${usersResult.rows.length} users to process`);

      let successCount = 0;
      let errorCount = 0;

      for (const user of usersResult.rows) {
        try {
          await this.generateAndSendReport(user);
          successCount++;
        } catch (error) {
          logger.error(`Failed to process user ${user.id}:`, error);
          errorCount++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.success(`========== WEEKLY REPORT JOB COMPLETED ==========`);
      logger.info(`Duration: ${duration}s | Success: ${successCount} | Errors: ${errorCount}`);

      return { successCount, errorCount, duration };
    } catch (error) {
      logger.error('Weekly report job failed:', error);
      throw error;
    }
  }

  // Generate and send report for a single user
  static async generateAndSendReport(user) {
    try {
      logger.info(`Processing user: ${user.email}`);

      // Initialize rule engine
      const engine = new RuleEngine();

      // Evaluate all clients
      const triggeredRules = await engine.evaluateAllClients(user.id);

      // Separate warnings and opportunities
      const warnings = triggeredRules.filter(r => r.category === 'risk');
      const opportunities = triggeredRules.filter(r => r.category === 'opportunity');

      // Calculate risk score
      const riskScore = Scorer.calculateRiskScore(triggeredRules);
      const severityBand = Scorer.getSeverityBand(riskScore);
      const severityLabel = Scorer.getSeverityLabel(riskScore);

      // Limit output
      const limited = Scorer.limitOutput(warnings, opportunities);

      // Get previous week's score
      const previousReport = await Database.query(
        `SELECT total_risk_score 
         FROM weekly_reports 
         WHERE user_id = $1 
         ORDER BY report_date DESC 
         LIMIT 1`,
        [user.id]
      );

      const previousScore = previousReport.rows[0]?.total_risk_score || null;
      const scoreChange = Scorer.calculateScoreChange(riskScore, previousScore);

      // Save report to database
      const reportResult = await Database.query(
        `INSERT INTO weekly_reports (user_id, report_date, total_risk_score, triggered_rules, sent_at, created_at)
         VALUES ($1, NOW(), $2, $3, NOW(), NOW())
         RETURNING id`,
        [user.id, riskScore, JSON.stringify(triggeredRules)]
      );

      const reportId = reportResult.rows[0].id;

      // Save rule triggers
      for (const rule of triggeredRules) {
        await Database.query(
          `INSERT INTO rule_triggers (report_id, client_id, rule_id, score_contribution, explanation, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [reportId, rule.client_id, rule.rule_id, rule.weight, rule.explanation]
        );
      }

      // Prepare report data for email
      const reportData = {
        reportId,
        riskScore,
        severityBand,
        severityLabel,
        scoreChange,
        warnings: limited.warnings,
        opportunities: limited.opportunities,
        reportDate: new Date().toISOString()
      };

      // Send email
      await EmailService.sendWeeklyReport(user, reportData);

      logger.success(`Report generated and sent for user: ${user.email}`, {
        reportId,
        riskScore,
        warningsCount: limited.warnings.length,
        opportunitiesCount: limited.opportunities.length
      });

      return reportData;
    } catch (error) {
      logger.error(`Failed to generate report for user ${user.id}:`, error);
      throw error;
    }
  }

  // Run for a specific user (for testing)
  static async runForUser(userId) {
    try {
      const userResult = await Database.query(
        'SELECT id, email, business_name FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      return await this.generateAndSendReport(user);
    } catch (error) {
      logger.error(`Failed to run report for user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = WeeklyReportJob;
