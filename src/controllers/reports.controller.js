const RuleEngine = require('../engine/ruleEngine');
const Scorer = require('../engine/scorer');
const Database = require('../db');
const logger = require('../utils/logger');

class ReportsController {
  // Generate report on-demand
  static async generateReport(req, res, next) {
    try {
      const userId = req.user.id;

      logger.info('Generating on-demand report for user:', userId);

      // Initialize rule engine
      const engine = new RuleEngine();

      // Evaluate all clients
      const triggeredRules = await engine.evaluateAllClients(userId);

      // Separate warnings and opportunities
      const warnings = triggeredRules.filter(r => r.category === 'risk');
      const opportunities = triggeredRules.filter(r => r.category === 'opportunity');

      // Calculate risk score
      const riskScore = Scorer.calculateRiskScore(triggeredRules);
      const severityBand = Scorer.getSeverityBand(riskScore);
      const severityLabel = Scorer.getSeverityLabel(riskScore);

      // Limit output
      const limited = Scorer.limitOutput(warnings, opportunities);

      // Get previous week's score for comparison
      const previousReport = await Database.query(
        `SELECT total_risk_score 
         FROM weekly_reports 
         WHERE user_id = $1 
         ORDER BY report_date DESC 
         LIMIT 1`,
        [userId]
      );

      const previousScore = previousReport.rows[0]?.total_risk_score || null;
      const scoreChange = Scorer.calculateScoreChange(riskScore, previousScore);

      // Save report
      const reportResult = await Database.query(
        `INSERT INTO weekly_reports (user_id, report_date, total_risk_score, triggered_rules, created_at)
         VALUES ($1, NOW(), $2, $3, NOW())
         RETURNING id`,
        [userId, riskScore, JSON.stringify(triggeredRules)]
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

      logger.success('Report generated successfully:', { reportId, riskScore });

      res.json({
        success: true,
        message: 'Report generated successfully',
        data: {
          reportId: reportId,
          riskScore: riskScore,
          severityBand: severityBand,
          severityLabel: severityLabel,
          scoreChange: scoreChange,
          warnings: limited.warnings,
          opportunities: limited.opportunities,
          totalWarnings: warnings.length,
          totalOpportunities: opportunities.length,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Generate report error:', error);
      next(error);
    }
  }

  // Get latest report
  static async getLatestReport(req, res, next) {
    try {
      const userId = req.user.id;

      const result = await Database.query(
        `SELECT id, report_date, total_risk_score, triggered_rules, created_at
         FROM weekly_reports
         WHERE user_id = $1
         ORDER BY report_date DESC
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          message: 'No reports found. Generate your first report!',
          data: null
        });
      }

      const report = result.rows[0];
      const triggeredRules = report.triggered_rules;

      const warnings = triggeredRules.filter(r => r.category === 'risk');
      const opportunities = triggeredRules.filter(r => r.category === 'opportunity');

      const limited = Scorer.limitOutput(warnings, opportunities);

      res.json({
        success: true,
        data: {
          reportId: report.id,
          reportDate: report.report_date,
          riskScore: report.total_risk_score,
          severityBand: Scorer.getSeverityBand(report.total_risk_score),
          severityLabel: Scorer.getSeverityLabel(report.total_risk_score),
          warnings: limited.warnings,
          opportunities: limited.opportunities,
          totalWarnings: warnings.length,
          totalOpportunities: opportunities.length,
          generatedAt: report.created_at
        }
      });
    } catch (error) {
      logger.error('Get latest report error:', error);
      next(error);
    }
  }

  // Get report history
  static async getReportHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 10;

      const result = await Database.query(
        `SELECT id, report_date, total_risk_score, created_at
         FROM weekly_reports
         WHERE user_id = $1
         ORDER BY report_date DESC
         LIMIT $2`,
        [userId, limit]
      );

      const history = result.rows.map(report => ({
        reportId: report.id,
        reportDate: report.report_date,
        riskScore: report.total_risk_score,
        severityBand: Scorer.getSeverityBand(report.total_risk_score),
        severityLabel: Scorer.getSeverityLabel(report.total_risk_score),
        createdAt: report.created_at
      }));

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      logger.error('Get report history error:', error);
      next(error);
    }
  }

  // Get specific report by ID
  static async getReportById(req, res, next) {
    try {
      const userId = req.user.id;
      const reportId = req.params.id;

      const result = await Database.query(
        `SELECT id, report_date, total_risk_score, triggered_rules, created_at
         FROM weekly_reports
         WHERE id = $1 AND user_id = $2`,
        [reportId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }

      const report = result.rows[0];
      const triggeredRules = report.triggered_rules;

      const warnings = triggeredRules.filter(r => r.category === 'risk');
      const opportunities = triggeredRules.filter(r => r.category === 'opportunity');

      res.json({
        success: true,
        data: {
          reportId: report.id,
          reportDate: report.report_date,
          riskScore: report.total_risk_score,
          severityBand: Scorer.getSeverityBand(report.total_risk_score),
          severityLabel: Scorer.getSeverityLabel(report.total_risk_score),
          warnings: Scorer.sortByPriority(warnings),
          opportunities: Scorer.sortByPriority(opportunities),
          generatedAt: report.created_at
        }
      });
    } catch (error) {
      logger.error('Get report by ID error:', error);
      next(error);
    }
  }
}

module.exports = ReportsController;
