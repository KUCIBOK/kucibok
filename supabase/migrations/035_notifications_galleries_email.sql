-- 035_notifications_galleries_email.sql
--
-- ⚠️ À APPLIQUER MANUELLEMENT dans le SQL Editor, après relecture. Idempotent.
-- 1. Notifications in-app (cloche artiste : œuvre approuvée/rejetée, vente réalisée…).
--    Accès serveur uniquement : RLS activé sans policy (le service_role des Functions contourne RLS).
-- 2. Colonne e-mail des galeries (import CSV « Galeries scrapées » de l'admin), unique sans casse.

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'info',
  severity   TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  title      TEXT NOT NULL,
  message    TEXT,
  metadata   JSONB DEFAULT '{}'::jsonb,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread  ON notifications(user_id) WHERE read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE galleries ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_galleries_email ON galleries (lower(email)) WHERE email IS NOT NULL;

-- ─── Vérification après application ─────────────────────────────────────────
-- select count(*) from notifications;
-- select column_name from information_schema.columns where table_name = 'galleries' and column_name = 'email';
-- select policyname from pg_policies where tablename = 'notifications';  -- aucune ligne attendue
