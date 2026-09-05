-- Artist public background: exhibitions, fairs, biennials and collaborations.
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS exhibitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS awards JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.artists.exhibitions IS
  'Public exhibition history. Each item may contain title, venue, location, year and description.';
COMMENT ON COLUMN public.artists.awards IS
  'Public awards and distinctions. Each item may contain title, organisation, year and description.';
