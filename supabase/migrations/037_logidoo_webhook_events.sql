-- 037_logidoo_webhook_events.sql
--
-- ⚠️ À APPLIQUER MANUELLEMENT dans le SQL Editor, après relecture. Idempotent.
-- Webhooks Logidoo reçus sur POST /api/logistics/logidoo/webhook?secret=…
-- Le contenu des webhooks n'est montré qu'en captures d'écran dans la documentation Logidoo :
-- le payload brut est conservé tel quel pour établir le mapping des statuts à partir de cas réels.
-- Accès serveur uniquement : RLS activé sans policy (le service_role des Functions contourne RLS).

CREATE TABLE IF NOT EXISTS logidoo_webhook_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload     JSONB NOT NULL,
  headers     JSONB DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logidoo_webhook_events_received ON logidoo_webhook_events(received_at DESC);

ALTER TABLE logidoo_webhook_events ENABLE ROW LEVEL SECURITY;

-- ─── Vérification après application ─────────────────────────────────────────
-- select count(*) from logidoo_webhook_events;
-- select policyname from pg_policies where tablename = 'logidoo_webhook_events';  -- aucune ligne attendue
