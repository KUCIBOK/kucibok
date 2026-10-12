-- 032_security_critical.sql
--
-- ⚠️ À APPLIQUER MANUELLEMENT dans le SQL Editor de Supabase, après relecture.
-- Ce fichier n'est exécuté par aucun pipeline automatique.
--
-- Corrige :
--  1. un utilisateur qui peut modifier son propre rôle (users.role)
--  2. un propriétaire qui peut s'approuver (artworks.status)
--  3. cinq tables sans RLS (avoirs et valorisations des conseillers)
--
-- Les appels du backend (service_role) ont auth.uid() = NULL : ils restent autorisés.

-- ─── 1. Rôle protégé ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION protect_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.role IS DISTINCT FROM OLD.role
     AND NOT is_admin() THEN
    RAISE EXCEPTION 'Changement de rôle interdit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_role ON users;
CREATE TRIGGER trg_protect_user_role
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION protect_user_role();

-- ─── 2. Statut d'œuvre réservé à la modération ──────────────────────────────
-- Le propriétaire peut seulement passer en 'draft' ou 'archived'.
CREATE OR REPLACE FUNCTION protect_artwork_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NOT is_admin()
     AND NEW.status NOT IN ('draft', 'archived') THEN
    RAISE EXCEPTION 'Statut réservé à la modération';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_artwork_status ON artworks;
CREATE TRIGGER trg_protect_artwork_status
  BEFORE UPDATE ON artworks
  FOR EACH ROW EXECUTE FUNCTION protect_artwork_status();

-- ─── 3. RLS sur les tables des conseillers ──────────────────────────────────
-- Chaque conseiller ne voit que ses propres lignes ; l'admin voit tout.
ALTER TABLE advisor_holdings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "advisor_holdings: propre ou admin" ON advisor_holdings;
CREATE POLICY "advisor_holdings: propre ou admin" ON advisor_holdings
  FOR ALL
  USING (advisor_id = auth.uid() OR is_admin())
  WITH CHECK (advisor_id = auth.uid() OR is_admin());

ALTER TABLE advisor_portfolio_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "advisor_snapshots: propre ou admin" ON advisor_portfolio_snapshots;
CREATE POLICY "advisor_snapshots: propre ou admin" ON advisor_portfolio_snapshots
  FOR ALL
  USING (advisor_id = auth.uid() OR is_admin())
  WITH CHECK (advisor_id = auth.uid() OR is_admin());

ALTER TABLE portfolio_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portfolio_events: propre ou admin" ON portfolio_events;
CREATE POLICY "portfolio_events: propre ou admin" ON portfolio_events
  FOR ALL
  USING (advisor_id = auth.uid() OR is_admin())
  WITH CHECK (advisor_id = auth.uid() OR is_admin());

-- Historique de valorisation : admin uniquement pour l'instant.
-- Si l'écran conseiller le lit directement, ajouter une politique SELECT pour les conseillers.
ALTER TABLE artist_valuation_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "valuation_history: admin" ON artist_valuation_history;
CREATE POLICY "valuation_history: admin" ON artist_valuation_history
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Cache analytique : accès serveur uniquement (aucune politique = aucun accès client).
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;

-- ─── Vérification après application ─────────────────────────────────────────
-- select tablename, rowsecurity from pg_tables where schemaname = 'public'
--   and tablename in ('advisor_holdings','advisor_portfolio_snapshots','portfolio_events',
--                     'artist_valuation_history','analytics_cache');
-- Doit renvoyer rowsecurity = true pour les cinq tables.
