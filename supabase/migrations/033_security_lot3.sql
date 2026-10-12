-- 033_security_lot3.sql
--
-- ⚠️ À APPLIQUER MANUELLEMENT dans le SQL Editor, après relecture. Idempotent.
-- Le front n'écrit pas directement dans subscriptions, transactions ni reviews :
-- ces écritures passent par le backend (service_role, qui ignore RLS).
--
-- 1. Insertions directes par le client retirées (le client pouvait s'abonner ou
--    enregistrer une transaction 'confirmed' à sa guise).
DROP POLICY IF EXISTS "subscriptions: insertion propre" ON subscriptions;
DROP POLICY IF EXISTS "transactions: insertion authentifié" ON transactions;

-- 2. Fonctions de cache analytique : accès serveur uniquement.
REVOKE EXECUTE ON FUNCTION set_cached_analytics(VARCHAR, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_cached_analytics(VARCHAR) FROM PUBLIC, anon, authenticated;

-- 3. Bucket public « blogs » : téléversement réservé aux admins et curateurs.
DROP POLICY IF EXISTS "blogs: upload pro ou admin" ON storage.objects;
CREATE POLICY "blogs: upload pro ou admin" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'blogs' AND (is_admin() OR is_curator()));

-- ─── Vérification après application ─────────────────────────────────────────
-- select policyname, tablename from pg_policies
--   where tablename in ('subscriptions', 'transactions')
--     and policyname in ('subscriptions: insertion propre', 'transactions: insertion authentifié');
-- Doit renvoyer zéro ligne.
