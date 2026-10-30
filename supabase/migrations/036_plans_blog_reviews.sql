-- 036_plans_blog_reviews.sql
--
-- ⚠️ À APPLIQUER MANUELLEMENT dans le SQL Editor, après relecture. Idempotent.
-- Les listes de plans et de catégories, le blog et les avis passent de données codées en dur
-- (ou de routes vides) à la base de données.
--
-- 1. plans      : rôle visé et description (l'écran admin « Plans » les saisit).
-- 2. blog_posts : extrait et date de publication.
-- 3. blog_comments : commentaires d'articles (accès serveur uniquement, RLS sans policy).
-- 4. reviews    : un seul avis par professionnel et par œuvre.
-- 5. categories : les 4 catégories jusqu'ici servies en dur, pour ne pas vider le formulaire
--                 de soumission d'œuvre. Modifiables ensuite depuis l'onglet admin « Catégories ».

-- 1. Plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_role_check') THEN
    ALTER TABLE plans ADD CONSTRAINT plans_role_check
      CHECK (role IS NULL OR role IN ('buyer', 'artist', 'curator', 'advisor'));
  END IF;
END $$;

-- 2. Blog
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
UPDATE blog_posts SET published_at = created_at WHERE published = TRUE AND published_at IS NULL;

-- 3. Commentaires du blog
CREATE TABLE IF NOT EXISTS blog_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blog_comments_post ON blog_comments(post_id, created_at);
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

-- 4. Avis : un par professionnel et par œuvre
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_artwork_professional
  ON reviews(artwork_id, professional_id);

-- 5. Catégories de départ (ne remplace rien d'existant)
INSERT INTO categories (name) VALUES ('Painting'), ('Sculpture'), ('Photography'), ('Mixed Media')
ON CONFLICT (name) DO NOTHING;

-- ─── Vérification après application ─────────────────────────────────────────
-- select column_name from information_schema.columns where table_name = 'plans' and column_name in ('role','description');
-- select column_name from information_schema.columns where table_name = 'blog_posts' and column_name in ('excerpt','published_at');
-- select count(*) from blog_comments;
-- select name from categories order by name;
-- select policyname from pg_policies where tablename = 'blog_comments';  -- aucune ligne attendue
