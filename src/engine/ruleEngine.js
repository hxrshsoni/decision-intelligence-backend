const Database = require('../db');
const logger = require('../utils/logger');

class RuleEngine {
  constructor() {
    this.rules = [];
  }

  // Load active rules from database
  async loadRules() {
    try {
      const result = await Database.query(
        'SELECT * FROM rules WHERE is_active = true ORDER BY weight DESC'
      );
      this.rules = result.rows;
      logger.success(`Loaded ${this.rules.length} active rules`);
      return this.rules;
    } catch (error) {
      logger.error('Failed to load rules:', error);
      throw error;
    }
  }

  // Calculate baseline metrics for a user
  async calculateBaselines(userId) {
    try {
      logger.info('Calculating baselines for user:', userId);

      const baselines = {};

      // Average engagement frequency (days between engagements)
      const engagementFreq = await Database.query(`
        SELECT AVG(days_between) as value
        FROM (
          SELECT client_id, 
                 EXTRACT(DAY FROM (occurred_at - LAG(occurred_at) OVER (PARTITION BY client_id ORDER BY occurred_at))) as days_between
          FROM engagements
          WHERE user_id = $1 AND occurred_at > NOW() - INTERVAL '90 days'
        ) sub
        WHERE days_between IS NOT NULL
      `, [userId]);
      baselines.avg_engagement_frequency = parseFloat(engagementFreq.rows[0]?.value || 14);

      // Average payment delay
      const paymentDelay = await Database.query(`
        SELECT AVG(days_late) as value
        FROM payments
        WHERE user_id = $1 
          AND status IN ('paid', 'late') 
          AND paid_date IS NOT NULL
          AND paid_date > NOW() - INTERVAL '90 days'
      `, [userId]);
      baselines.avg_payment_delay = parseFloat(paymentDelay.rows[0]?.value || 0);

      // Average engagement per week
      const engagementPerWeek = await Database.query(`
        SELECT COUNT(*)::decimal / 12 as value
        FROM engagements
        WHERE user_id = $1 AND occurred_at > NOW() - INTERVAL '90 days'
      `, [userId]);
      baselines.avg_engagement_per_week = parseFloat(engagementPerWeek.rows[0]?.value || 1);

      // Store baselines in database
      for (const [metric, value] of Object.entries(baselines)) {
        await Database.query(
          'INSERT INTO baselines (user_id, metric_name, metric_value, calculated_at) VALUES ($1, $2, $3, NOW())',
          [userId, metric, value]
        );
      }

      logger.success('Baselines calculated:', baselines);
      return baselines;
    } catch (error) {
      logger.error('Failed to calculate baselines:', error);
      throw error;
    }
  }

  // Get comprehensive client data
  async getClientData(userId, clientId) {
    try {
      // Get client info
      const clientResult = await Database.query(
        'SELECT * FROM clients WHERE id = $1 AND user_id = $2',
        [clientId, userId]
      );

      if (clientResult.rows.length === 0) {
        return null;
      }

      const client = clientResult.rows[0];

      // Get last engagement
      const lastEngagement = await Database.query(
        'SELECT MAX(occurred_at) as last_contact FROM engagements WHERE client_id = $1',
        [clientId]
      );

      // Calculate days since last contact
      const lastContact = lastEngagement.rows[0]?.last_contact;
      const daysSinceContact = lastContact
        ? Math.floor((Date.now() - new Date(lastContact)) / (1000 * 60 * 60 * 24))
        : 999;

      // Get payment history
      const paymentHistory = await Database.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status IN ('late', 'overdue')) as late_payment_count,
          AVG(days_late) as avg_delay
        FROM payments 
        WHERE client_id = $1
      `, [clientId]);

      // Get recent work requests (last 30 days)
      const workRequests = await Database.query(`
        SELECT 
          SUM(effort_hours) as total_effort,
          SUM(revenue_generated) as total_revenue
        FROM work_requests 
        WHERE client_id = $1 
          AND created_at > NOW() - INTERVAL '30 days'
      `, [clientId]);

      // Get engagement count (last 30 days vs previous 30 days)
      const recentEngagements = await Database.query(`
        SELECT COUNT(*) as count
        FROM engagements
        WHERE client_id = $1 
          AND occurred_at > NOW() - INTERVAL '30 days'
      `, [clientId]);

      const previousEngagements = await Database.query(`
        SELECT COUNT(*) as count
        FROM engagements
        WHERE client_id = $1 
          AND occurred_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'
      `, [clientId]);

      const recentCount = parseInt(recentEngagements.rows[0]?.count || 0);
      const previousCount = parseInt(previousEngagements.rows[0]?.count || 0);
      const engagementDropPercent = previousCount > 0
        ? ((previousCount - recentCount) / previousCount) * 100
        : 0;

      return {
        client: client,
        days_since_contact: daysSinceContact,
        late_payment_count: parseInt(paymentHistory.rows[0]?.late_payment_count || 0),
        avg_payment_delay: parseFloat(paymentHistory.rows[0]?.avg_delay || 0),
        recent_effort: parseFloat(workRequests.rows[0]?.total_effort || 0),
        recent_revenue: parseFloat(workRequests.rows[0]?.total_revenue || 0),
        engagement_drop_percent: Math.max(0, engagementDropPercent),
        contract_value: parseFloat(client.contract_value || 0)
      };
    } catch (error) {
      logger.error('Failed to get client data:', error);
      throw error;
    }
  }

  // Evaluate a single rule condition
  evaluateCondition(condition, data, baselines) {
    const { metric, operator, threshold, logic, metric2, operator2, threshold2 } = condition;

    // Get first metric value
    let value1 = data[metric];
    let compareValue1 = threshold;

    // Handle baseline-relative comparisons
    if (condition.baseline_relative && baselines[metric]) {
      compareValue1 = baselines[metric] * threshold;
    }

    // Evaluate first condition
    let result1 = this.compare(value1, operator, compareValue1);

    // If no second condition, return first result
    if (!logic || !metric2) {
      return result1;
    }

    // Evaluate second condition
    let value2 = data[metric2];
    let compareValue2 = threshold2;

    if (condition.baseline_relative2 && baselines[metric2]) {
      compareValue2 = baselines[metric2] * threshold2;
    }

    let result2 = this.compare(value2, operator2, compareValue2);

    // Combine with logic operator
    if (logic === 'AND') {
      return result1 && result2;
    } else if (logic === 'OR') {
      return result1 || result2;
    }

    return result1;
  }

  // Compare values with operator
  compare(value, operator, threshold) {
    switch(operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      default: return false;
    }
  }

  // Generate human-readable explanation
  generateExplanation(rule, data, baselines) {
    const condition = rule.condition_logic;
    const metric = condition.metric;
    const value = data[metric];

    let explanation = `${rule.rule_name}: `;

    // Build explanation based on metric
    if (metric === 'days_since_contact') {
      explanation += `Last contact was ${value} days ago (threshold: ${condition.threshold} days)`;
    } else if (metric === 'late_payment_count') {
      explanation += `Client has ${value} late payments (threshold: ${condition.threshold})`;
    } else if (metric === 'engagement_drop_percent') {
      explanation += `Engagement dropped by ${value.toFixed(1)}% (threshold: ${condition.threshold}%)`;
    } else if (metric === 'recent_effort') {
      explanation += `Recent effort: ${value} hours, Revenue: $${data.recent_revenue || 0}`;
    } else if (metric === 'contract_value') {
      explanation += `High-value client ($${value}) with ${data.days_since_contact} days since contact`;
    } else {
      explanation += `${metric} = ${value}`;
    }

    return explanation;
  }

  // Evaluate all rules for a specific client
  async evaluateClient(userId, clientId, baselines) {
    try {
      const clientData = await this.getClientData(userId, clientId);

      if (!clientData) {
        return [];
      }

      const triggeredRules = [];

      for (const rule of this.rules) {
        const isTriggered = this.evaluateCondition(rule.condition_logic, clientData, baselines);

        if (isTriggered) {
          triggeredRules.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            category: rule.category,
            weight: rule.weight,
            action: rule.action_text,
            explanation: this.generateExplanation(rule, clientData, baselines),
            client_name: clientData.client.name,
            client_id: clientId
          });
        }
      }

      return triggeredRules;
    } catch (error) {
      logger.error(`Failed to evaluate client ${clientId}:`, error);
      return [];
    }
  }

  // Evaluate all clients for a user
  async evaluateAllClients(userId) {
    try {
      logger.info('Evaluating all clients for user:', userId);

      // Load rules
      await this.loadRules();

      // Calculate baselines
      const baselines = await this.calculateBaselines(userId);

      // Get all active clients
      const clientsResult = await Database.query(
        'SELECT id FROM clients WHERE user_id = $1 AND status = $2',
        [userId, 'active']
      );

      const allTriggeredRules = [];

      // Evaluate each client
      for (const client of clientsResult.rows) {
        const triggered = await this.evaluateClient(userId, client.id, baselines);
        allTriggeredRules.push(...triggered);
      }

      logger.success(`Evaluation complete: ${allTriggeredRules.length} rules triggered`);
      return allTriggeredRules;
    } catch (error) {
      logger.error('Failed to evaluate all clients:', error);
      throw error;
    }
  }
}

module.exports = RuleEngine;
