const logger = require('../utils/logger');

class Scorer {
  // Calculate total risk score from triggered rules
  static calculateRiskScore(triggeredRules) {
    const riskScore = triggeredRules
      .filter(rule => rule.category === 'risk')
      .reduce((sum, rule) => sum + rule.weight, 0);

    return Math.min(riskScore, 100); // Cap at 100
  }

  // Get severity band
  static getSeverityBand(score) {
    if (score < 40) return 'healthy';
    if (score < 70) return 'attention';
    return 'high_risk';
  }

  // Get severity label
  static getSeverityLabel(score) {
    if (score < 40) return '✅ Healthy';
    if (score < 70) return '⚠️ Attention Needed';
    return '🚨 High Risk';
  }

  // Sort rules by priority
  static sortByPriority(rules) {
    return rules.sort((a, b) => b.weight - a.weight);
  }

  // Limit output to top items
  static limitOutput(warnings, opportunities, maxWarnings = 5, maxOpportunities = 3) {
    return {
      warnings: this.sortByPriority(warnings).slice(0, maxWarnings),
      opportunities: this.sortByPriority(opportunities).slice(0, maxOpportunities)
    };
  }

  // Calculate score change from last week
  static calculateScoreChange(currentScore, previousScore) {
    if (previousScore === null || previousScore === undefined) {
      return { change: 0, direction: 'new' };
    }

    const change = currentScore - previousScore;
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';

    return { change: Math.abs(change), direction };
  }
}

module.exports = Scorer;
