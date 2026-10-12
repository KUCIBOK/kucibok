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

-- ─── Hors périmètre de cette migration ──────────────────────────────────────
-- RLS sur advisor_holdings, advisor_portfolio_snapshots, portfolio_events,
-- artist_valuation_history, analytics_cache : ces tables viennent de la migration
-- 027, non appliquée en production. À traiter quand 027 sera déployée.

-- ─── Vérification après application ─────────────────────────────────────────
-- select tgname, tgrelid::regclass from pg_trigger
--   where tgname in ('trg_protect_user_role', 'trg_protect_artwork_status');
-- Doit renvoyer les deux triggers.
