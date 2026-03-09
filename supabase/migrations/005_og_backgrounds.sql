-- OG background images: category pools for resources, unique per article

-- Pool of pre-generated backgrounds per category
CREATE TABLE og_background_pools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug TEXT NOT NULL,
  image_url     TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_og_bg_pools_category ON og_background_pools(category_slug);

-- Add background URL columns
ALTER TABLE resources ADD COLUMN IF NOT EXISTS og_background_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS og_background_url TEXT;

-- RLS
ALTER TABLE og_background_pools ENABLE ROW LEVEL SECURITY;

-- Public can read backgrounds (needed for OG image rendering)
CREATE POLICY "Public read og_background_pools" ON og_background_pools
  FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service write og_background_pools" ON og_background_pools
  FOR ALL TO service_role USING (true) WITH CHECK (true);
