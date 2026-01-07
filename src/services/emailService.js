const { Resend } = require('resend');
const config = require('../config/env');
const logger = require('../utils/logger');

const resend = config.resendApiKey && config.resendApiKey !== 'optional_for_now' 
  ? new Resend(config.resendApiKey) 
  : null;

class EmailService {
  // Send email via Resend
  static async send({ to, subject, html }) {
    try {
      if (!resend) {
        logger.warn('Resend not configured. Email not sent.');
        console.log('\n========== EMAIL PREVIEW ==========');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body:\n${html}`);
        console.log('===================================\n');
        return { success: true, preview: true };
      }

      const result = await resend.emails.send({
        from: 'Decision Intelligence <reports@yourdomain.com>', // Change this later
        to: to,
        subject: subject,
        html: html
      });

      logger.success('Email sent successfully:', { to, messageId: result.id });
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  // Generate weekly report email HTML
  static generateWeeklyReportEmail(user, report) {
    const { riskScore, severityLabel, warnings, opportunities, reportDate } = report;

    const warningsHtml = warnings.length > 0
      ? warnings.map(w => `
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 15px; border-radius: 5px;">
            <h3 style="margin: 0 0 10px 0; color: #991b1b; font-size: 16px;">${w.rule_name}</h3>
            <p style="margin: 0 0 8px 0; color: #7f1d1d; font-size: 14px;"><strong>Client:</strong> ${w.client_name}</p>
            <p style="margin: 0 0 8px 0; color: #7f1d1d; font-size: 14px;">${w.explanation}</p>
            <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 600;">→ ${w.action}</p>
          </div>
        `).join('')
      : '<p style="color: #059669; font-size: 14px;">✅ No critical warnings this week!</p>';

    const opportunitiesHtml = opportunities.length > 0
      ? opportunities.map(o => `
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin-bottom: 15px; border-radius: 5px;">
            <h3 style="margin: 0 0 10px 0; color: #166534; font-size: 16px;">${o.rule_name}</h3>
            <p style="margin: 0 0 8px 0; color: #14532d; font-size: 14px;"><strong>Client:</strong> ${o.client_name}</p>
            <p style="margin: 0 0 8px 0; color: #14532d; font-size: 14px;">${o.explanation}</p>
            <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 600;">→ ${o.action}</p>
          </div>
        `).join('')
      : '<p style="color: #6b7280; font-size: 14px;">No new opportunities detected this week.</p>';

    const severityColor = riskScore < 40 ? '#059669' : riskScore < 70 ? '#f59e0b' : '#ef4444';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 30px;">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="margin: 0 0 10px 0; font-size: 28px; color: #111827;">Weekly Business Intelligence</h1>
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Report for ${user.business_name || user.email}</p>
            <p style="margin: 5px 0 0 0; color: #9ca3af; font-size: 12px;">${new Date(reportDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <!-- Risk Score -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; padding: 30px; text-align: center; margin-bottom: 40px;">
            <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Overall Risk Score</p>
            <h2 style="margin: 0; color: #ffffff; font-size: 48px; font-weight: bold;">${riskScore}<span style="font-size: 24px;">/100</span></h2>
            <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 18px; font-weight: 600;">${severityLabel}</p>
          </div>

          <!-- Warnings Section -->
          <div style="margin-bottom: 40px;">
            <h2 style="margin: 0 0 20px 0; font-size: 22px; color: #111827; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">
              ⚠️ Warnings (${warnings.length})
            </h2>
            ${warningsHtml}
          </div>

          <!-- Opportunities Section -->
          <div style="margin-bottom: 40px;">
            <h2 style="margin: 0 0 20px 0; font-size: 22px; color: #111827; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">
              💡 Opportunities (${opportunities.length})
            </h2>
            ${opportunitiesHtml}
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #e5e7eb; padding-top: 30px; text-align: center;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">This report was automatically generated by Decision Intelligence Platform</p>
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">Focus on what matters. Ignore the rest.</p>
          </div>

        </div>
      </body>
      </html>
    `;
  }

  // Send weekly report email
  static async sendWeeklyReport(user, report) {
    try {
      const subject = `Weekly Report: ${report.severityLabel} - ${new Date().toLocaleDateString()}`;
      const html = this.generateWeeklyReportEmail(user, report);

      await this.send({
        to: user.email,
        subject: subject,
        html: html
      });

      logger.success('Weekly report email sent:', { userId: user.id, email: user.email });
    } catch (error) {
      logger.error('Failed to send weekly report email:', error);
      throw error;
    }
  }
}

module.exports = EmailService;
