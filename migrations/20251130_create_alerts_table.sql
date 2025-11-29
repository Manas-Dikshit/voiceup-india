-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create alerts table for emergency system (PostgreSQL syntax)
CREATE TABLE IF NOT EXISTS alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id uuid NOT NULL,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    broadcast_status TEXT NOT NULL DEFAULT 'pending',
    recipients_count INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster incident lookup
CREATE INDEX IF NOT EXISTS idx_alerts_incident_id ON alerts(incident_id);