-- Collector Dashboard Setup
-- Tables and columns for collection, follows, and notification preferences

-- 1. Add columns to artworks table
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS source text DEFAULT 'purchased' CHECK (source IN ('purchased', 'digitized', 'other'));
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS price_documented numeric DEFAULT 0;
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS acquisition_date timestamp DEFAULT now();
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS priority_access boolean DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_artworks_owner_id ON artworks(owner_id);
CREATE INDEX IF NOT EXISTS idx_artworks_priority_access ON artworks(priority_access);

-- 2. Add columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'failed'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- 3. Create collector_follows table
CREATE TABLE IF NOT EXISTS collector_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now(),
  UNIQUE(collector_id, artist_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_collector_follows_collector_id ON collector_follows(collector_id);
CREATE INDEX IF NOT EXISTS idx_collector_follows_artist_id ON collector_follows(artist_id);

-- Enable RLS
ALTER TABLE collector_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collector_follows
CREATE POLICY IF NOT EXISTS "Users can view their own follows" ON collector_follows
  FOR SELECT USING (collector_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can create follows" ON collector_follows
  FOR INSERT WITH CHECK (collector_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can delete their own follows" ON collector_follows
  FOR DELETE USING (collector_id = auth.uid());

-- 4. Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  notification_mode text DEFAULT 'in_app' CHECK (notification_mode IN ('in_app', 'email', 'both')),
  frequency text DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'weekly')),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_preferences
CREATE POLICY IF NOT EXISTS "Users can view their own prefs" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can create their prefs" ON notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update their prefs" ON notification_preferences
  FOR UPDATE USING (user_id = auth.uid());

-- Insert audit log
INSERT INTO audit_log (table_name, operation, description)
VALUES ('collector_dashboard', 'SETUP', 'Created collector dashboard tables and columns')
ON CONFLICT DO NOTHING;
