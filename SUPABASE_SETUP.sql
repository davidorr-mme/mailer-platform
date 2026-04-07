-- ============================================================
-- STEP 1: Paste this entire file into the Supabase SQL Editor
-- and click "Run". It creates all the tables the app needs.
-- ============================================================

-- Users (login accounts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attribute definitions (e.g. test_credit_score)
CREATE TABLE IF NOT EXISTS attribute_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  data_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event definitions (e.g. test_credit_score_changed)
CREATE TABLE IF NOT EXISTS event_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts (subscribers)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  global_unsubscribe BOOLEAN DEFAULT FALSE,
  custom_attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contacts_custom_attributes_gin ON contacts USING GIN (custom_attributes);

-- Custom events (behavioural data per contact)
CREATE TABLE IF NOT EXISTS custom_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_name VARCHAR(255) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custom_events_contact_id ON custom_events (contact_id);
CREATE INDEX IF NOT EXISTS custom_events_event_name ON custom_events (event_name);

-- Audience segments
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  logic JSONB NOT NULL DEFAULT '{}',
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subject_line VARCHAR(500) NOT NULL DEFAULT '',
  preview_text VARCHAR(500) DEFAULT '',
  sender_name VARCHAR(255) DEFAULT '',
  sender_email VARCHAR(255) DEFAULT '',
  template_json JSONB DEFAULT '[]',
  template_html TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  segment_id UUID REFERENCES segments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation workflows
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  entry_criteria JSONB DEFAULT '{}',
  exit_criteria JSONB DEFAULT '[]',
  target_segment_id UUID REFERENCES segments(id) ON DELETE SET NULL,
  workflow_json JSONB DEFAULT '{"nodes":[],"edges":[]}',
  enrolled_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual email send records
CREATE TABLE IF NOT EXISTS campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES automations(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaign_sends_campaign_id ON campaign_sends (campaign_id);
CREATE INDEX IF NOT EXISTS campaign_sends_contact_id ON campaign_sends (contact_id);

-- Email engagement events (opens, clicks, etc.)
CREATE TABLE IF NOT EXISTS engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_send_id UUID NOT NULL REFERENCES campaign_sends(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  url TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS engagement_events_campaign_send_id ON engagement_events (campaign_send_id);
CREATE INDEX IF NOT EXISTS engagement_events_contact_id ON engagement_events (contact_id);
CREATE INDEX IF NOT EXISTS engagement_events_type ON engagement_events (type);

-- Data import history
CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type VARCHAR(20) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  rows_processed INTEGER DEFAULT 0,
  contacts_created INTEGER DEFAULT 0,
  contacts_updated INTEGER DEFAULT 0,
  events_created INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_log JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knex migration tracking (tells the app the DB is already set up)
CREATE TABLE IF NOT EXISTS knex_migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  batch INTEGER,
  migration_time TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS knex_migrations_lock (
  index SERIAL PRIMARY KEY,
  is_locked INTEGER
);

INSERT INTO knex_migrations_lock (is_locked) VALUES (0) ON CONFLICT DO NOTHING;
INSERT INTO knex_migrations (name, batch, migration_time)
  VALUES ('20240101_initial.ts', 1, NOW())
  ON CONFLICT DO NOTHING;

-- ============================================================
-- Done! All tables created successfully.
-- ============================================================
