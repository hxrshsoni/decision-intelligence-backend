const fs = require('fs');
const csv = require('csv-parser');
const logger = require('../utils/logger');

class CSVParser {
  // Parse CSV file and return rows
  static parseFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          logger.success(`CSV parsed successfully: ${results.length} rows`);
          resolve(results);
        })
        .on('error', (error) => {
          logger.error('CSV parsing error:', error);
          reject(error);
        });
    });
  }

  // Validate and normalize client data
  static normalizeClients(rows) {
    return rows.map(row => ({
      name: row.name || row.client_name || row.Name || row['Client Name'],
      email: row.email || row.Email || row.client_email || null,
      contract_value: parseFloat(row.contract_value || row.value || row.Value || 0),
      start_date: this.parseDate(row.start_date || row.date || row.Date),
      status: (row.status || row.Status || 'active').toLowerCase()
    })).filter(client => client.name); // Remove rows without name
  }

  // Validate and normalize engagement data
  static normalizeEngagements(rows) {
    return rows.map(row => ({
      client_name: row.client_name || row.client || row.Client || row.name,
      type: (row.type || row.Type || row.engagement_type || 'meeting').toLowerCase(),
      occurred_at: this.parseDate(row.date || row.occurred_at || row.Date),
      notes: row.notes || row.Notes || row.description || null
    })).filter(eng => eng.client_name && eng.occurred_at);
  }

  // Validate and normalize payment data
  static normalizePayments(rows) {
    return rows.map(row => ({
      client_name: row.client_name || row.client || row.Client || row.name,
      invoice_amount: parseFloat(row.amount || row.invoice_amount || row.Amount || 0),
      due_date: this.parseDate(row.due_date || row.due || row['Due Date']),
      paid_date: this.parseDate(row.paid_date || row.paid || row['Paid Date']),
      status: (row.status || row.Status || 'pending').toLowerCase()
    })).filter(payment => payment.client_name && payment.invoice_amount > 0);
  }

  // Validate and normalize work request data
  static normalizeWorkRequests(rows) {
    return rows.map(row => ({
      client_name: row.client_name || row.client || row.Client || row.name,
      request_type: row.request_type || row.type || row.Type || 'general',
      effort_hours: parseFloat(row.effort_hours || row.hours || row.Hours || 0),
      revenue_generated: parseFloat(row.revenue || row.revenue_generated || row.Revenue || 0)
    })).filter(req => req.client_name);
  }

  // Parse date from various formats
  static parseDate(dateStr) {
    if (!dateStr) return null;
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
  }

  // Calculate days late for payments
  static calculateDaysLate(dueDate, paidDate) {
    if (!dueDate || !paidDate) return 0;
    
    const due = new Date(dueDate);
    const paid = new Date(paidDate);
    
    if (paid <= due) return 0;
    
    const diffTime = Math.abs(paid - due);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }
}

module.exports = CSVParser;
