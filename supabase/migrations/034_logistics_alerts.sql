-- 034_logistics_alerts.sql
--
-- ⚠️ À APPLIQUER MANUELLEMENT dans le SQL Editor, après relecture. Idempotent.
-- Alertes logistiques affichées dans l'onglet admin « Logistique » (/api/logistics/*).
-- Accès serveur uniquement : RLS activé sans policy, le service_role (Vercel Functions)
-- contourne RLS, les clients anon/authenticated n'ont aucun accès.

CREATE TABLE IF NOT EXISTS logistics_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES delivery_requests(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES delivery_events(id) ON DELETE CASCADE,
  tracking_id TEXT,
  type        TEXT NOT NULL DEFAULT 'status_change'
              CHECK (type IN ('status_change', 'delivery_exception', 'delay', 'delivered', 'created', 'cancelled')),
  severity    TEXT NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  title       TEXT NOT NULL,
  message     TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Une alerte par événement de livraison, un seul retard ouvert par livraison
CREATE UNIQUE INDEX IF NOT EXISTS uq_logistics_alerts_event
  ON logistics_alerts(event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_logistics_alerts_delay
  ON logistics_alerts(delivery_id) WHERE type = 'delay';
CREATE INDEX IF NOT EXISTS idx_logistics_alerts_created ON logistics_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logistics_alerts_unread  ON logistics_alerts(read) WHERE read = FALSE;

ALTER TABLE logistics_alerts ENABLE ROW LEVEL SECURITY;

-- ─── Vérification après application ─────────────────────────────────────────
-- select count(*) from logistics_alerts;
-- select policyname from pg_policies where tablename = 'logistics_alerts';  -- aucune ligne attendue
