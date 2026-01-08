const Database = require('../config/database');
const logger = require('../utils/logger');

class DataIngestion {
  // Insert clients and return mapping of name to ID
  static async insertClients(userId, clientsData) {
    const clientMap = new Map();
    let insertedCount = 0;
    let skippedCount = 0;

    for (const client of clientsData) {
      try {
        // Check if client already exists
        const existing = await Database.query(
          'SELECT id FROM clients WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
          [userId, client.name]
        );

        if (existing.rows.length > 0) {
          clientMap.set(client.name.toLowerCase(), existing.rows[0].id);
          skippedCount++;
          continue;
        }

        // Insert new client
        const result = await Database.query(
          `INSERT INTO clients (user_id, name, email, contract_value, start_date, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           RETURNING id`,
          [userId, client.name, client.email, client.contract_value, client.start_date, client.status]
        );

        clientMap.set(client.name.toLowerCase(), result.rows[0].id);
        insertedCount++;
      } catch (error) {
        logger.error(`Failed to insert client ${client.name}:`, error);
      }
    }

    logger.success(`Clients processed: ${insertedCount} inserted, ${skippedCount} skipped`);
    return { clientMap, insertedCount, skippedCount };
  }

  // Insert engagements
  static async insertEngagements(userId, engagementsData, clientMap) {
    let insertedCount = 0;
    let skippedCount = 0;

    for (const engagement of engagementsData) {
      try {
        const clientId = clientMap.get(engagement.client_name.toLowerCase());
        
        if (!clientId) {
          skippedCount++;
          continue;
        }

        await Database.query(
          `INSERT INTO engagements (client_id, user_id, type, occurred_at, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [clientId, userId, engagement.type, engagement.occurred_at, engagement.notes]
        );

        insertedCount++;
      } catch (error) {
        logger.error('Failed to insert engagement:', error);
        skippedCount++;
      }
    }

    logger.success(`Engagements processed: ${insertedCount} inserted, ${skippedCount} skipped`);
    return { insertedCount, skippedCount };
  }

  // Insert payments with automatic days_late calculation
  static async insertPayments(userId, paymentsData, clientMap) {
    const CSVParser = require('./csvParser');
    let insertedCount = 0;
    let skippedCount = 0;

    for (const payment of paymentsData) {
      try {
        const clientId = clientMap.get(payment.client_name.toLowerCase());
        
        if (!clientId) {
          skippedCount++;
          continue;
        }

        // Calculate days late
        let daysLate = 0;
        let status = payment.status;
        
        if (payment.paid_date && payment.due_date) {
          daysLate = CSVParser.calculateDaysLate(payment.due_date, payment.paid_date);
          if (daysLate > 0) {
            status = 'late';
          } else {
            status = 'paid';
          }
        } else if (!payment.paid_date && new Date(payment.due_date) < new Date()) {
          status = 'overdue';
        }

        await Database.query(
          `INSERT INTO payments (client_id, user_id, invoice_amount, due_date, paid_date, status, days_late, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [clientId, userId, payment.invoice_amount, payment.due_date, payment.paid_date, status, daysLate]
        );

        insertedCount++;
      } catch (error) {
        logger.error('Failed to insert payment:', error);
        skippedCount++;
      }
    }

    logger.success(`Payments processed: ${insertedCount} inserted, ${skippedCount} skipped`);
    return { insertedCount, skippedCount };
  }

  // Insert work requests
  static async insertWorkRequests(userId, workRequestsData, clientMap) {
    let insertedCount = 0;
    let skippedCount = 0;

    for (const request of workRequestsData) {
      try {
        const clientId = clientMap.get(request.client_name.toLowerCase());
        
        if (!clientId) {
          skippedCount++;
          continue;
        }

        await Database.query(
          `INSERT INTO work_requests (client_id, user_id, request_type, effort_hours, revenue_generated, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [clientId, userId, request.request_type, request.effort_hours, request.revenue_generated]
        );

        insertedCount++;
      } catch (error) {
        logger.error('Failed to insert work request:', error);
        skippedCount++;
      }
    }

    logger.success(`Work requests processed: ${insertedCount} inserted, ${skippedCount} skipped`);
    return { insertedCount, skippedCount };
  }
}

module.exports = DataIngestion;
