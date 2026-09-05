-- Support category and default Rewards shop catalogue.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'autre';

INSERT INTO public.artist_products (name, description, credits_cost, category)
SELECT seed.name, seed.description, seed.credits_cost, seed.category
FROM (VALUES
  ('Lot de 10 certificats KCB', 'Certificats d''authenticité Kucibok pour vos œuvres', 200, 'certification'),
  ('Mise en avant 7 jours', 'Profil mis en avant sur la marketplace Global', 150, 'visibilite'),
  ('Séance photo professionnelle', 'Prise en charge d''une séance photo de vos œuvres', 500, 'service'),
  ('Pack cadre standard', '5 cadres standards pour présentation d''œuvres', 300, 'supply'),
  ('Badge artiste vérifié', 'Badge de vérification premium sur votre profil', 100, 'certification')
) AS seed(name, description, credits_cost, category)
WHERE NOT EXISTS (
  SELECT 1 FROM public.artist_products existing WHERE existing.name = seed.name
);
