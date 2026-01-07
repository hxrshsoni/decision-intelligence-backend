-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  business_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Clients Table
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  contract_value DECIMAL(10,2),
  start_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Engagements Table
CREATE TABLE IF NOT EXISTS engagements (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagements_client ON engagements(client_id);
CREATE INDEX IF NOT EXISTS idx_engagements_occurred ON engagements(occurred_at);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  invoice_amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status VARCHAR(50) DEFAULT 'pending',
  days_late INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Work Requests Table
CREATE TABLE IF NOT EXISTS work_requests (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  request_type VARCHAR(100),
  effort_hours DECIMAL(5,2),
  revenue_generated DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Rules Table
CREATE TABLE IF NOT EXISTS rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL,
  condition_logic JSONB NOT NULL,
  weight INTEGER NOT NULL,
  action_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Baselines Table
CREATE TABLE IF NOT EXISTS baselines (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,2),
  calculated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baselines_user ON baselines(user_id);

-- Weekly Reports Table
CREATE TABLE IF NOT EXISTS weekly_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  total_risk_score INTEGER DEFAULT 0,
  triggered_rules JSONB,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_user ON weekly_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_date ON weekly_reports(report_date);

-- Rule Triggers Table
CREATE TABLE IF NOT EXISTS rule_triggers (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES weekly_reports(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  rule_id INTEGER REFERENCES rules(id),
  score_contribution INTEGER,
  explanation TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed Initial Rules
INSERT INTO rules (rule_name, category, condition_logic, weight, action_text) VALUES
('No Recent Contact', 'risk', 
 '{"metric": "days_since_contact", "operator": ">", "threshold": 21}'::jsonb, 
 30, 
 'Schedule a check-in call with this client immediately'),
 
('Multiple Late Payments', 'risk',
 '{"metric": "late_payment_count", "operator": ">=", "threshold": 2}'::jsonb,
 25,
 'Review payment terms and send payment reminder'),
 
('Engagement Drop', 'risk',
 '{"metric": "engagement_drop_percent", "operator": ">", "threshold": 30}'::jsonb,
 20,
 'Client engagement has dropped significantly - reach out proactively'),
 
('Low Revenue High Effort', 'opportunity',
 '{"metric": "recent_effort", "operator": ">", "threshold": 10}'::jsonb,
 20,
 'Discuss increasing rates or optimizing scope with this client'),
 
('High Value Client Risk', 'risk',
 '{"metric": "contract_value", "operator": ">", "threshold": 5000, "logic": "AND", "metric2": "days_since_contact", "operator2": ">", "threshold2": 14}'::jsonb,
 35,
 'High-value client showing disengagement - priority action needed')
ON CONFLICT (rule_name) DO NOTHING;
