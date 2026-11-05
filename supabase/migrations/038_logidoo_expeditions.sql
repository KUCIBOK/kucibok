-- 038 — Création d'expédition chez Logidoo après validation admin (idempotent)
-- La demande reste « pending » ; un administrateur la valide, l'expédition est créée chez Logidoo,
-- le coût et le suivi sont enregistrés ici.

ALTER TABLE delivery_requests
  ADD COLUMN IF NOT EXISTS transport_mode          TEXT DEFAULT 'AIR',
  ADD COLUMN IF NOT EXISTS transport_type          TEXT DEFAULT 'EXPRESS',
  ADD COLUMN IF NOT EXISTS origin_country_code     TEXT,
  ADD COLUMN IF NOT EXISTS destination_country     TEXT,
  ADD COLUMN IF NOT EXISTS destination_country_code TEXT,
  ADD COLUMN IF NOT EXISTS sender_name             TEXT,
  ADD COLUMN IF NOT EXISTS sender_email            TEXT,
  ADD COLUMN IF NOT EXISTS sender_phone            TEXT,
  ADD COLUMN IF NOT EXISTS sender_address          TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email         TEXT,
  ADD COLUMN IF NOT EXISTS goods_value             NUMERIC,
  ADD COLUMN IF NOT EXISTS pickup_node_id          TEXT,
  ADD COLUMN IF NOT EXISTS pickup_node_name        TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_node_id         TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_node_name       TEXT,
  ADD COLUMN IF NOT EXISTS validated_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by            UUID,
  ADD COLUMN IF NOT EXISTS logidoo_submitted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS logidoo_expedition_id   TEXT,
  ADD COLUMN IF NOT EXISTS logidoo_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS logidoo_tracking_url    TEXT,
  ADD COLUMN IF NOT EXISTS logidoo_status          TEXT,
  ADD COLUMN IF NOT EXISTS logidoo_error           TEXT;

CREATE INDEX IF NOT EXISTS idx_delivery_logidoo_expedition ON delivery_requests(logidoo_expedition_id);
