-- Articles table for the content engine
CREATE TABLE articles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  article_type      TEXT NOT NULL CHECK (article_type IN ('daily', 'weekly', 'monthly')),
  content           TEXT NOT NULL,
  tweet_thread      JSONB DEFAULT '[]'::jsonb,
  promo_tweet       TEXT,
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'rejected')),
  scheduled_for     TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  reviewer_notes    TEXT,
  thread_tweet_ids  TEXT[],
  thread_url        TEXT,
  promo_tweet_id    TEXT,
  promo_tweet_url   TEXT,
  meta_description  TEXT,
  og_title          TEXT,
  period_start      DATE,
  period_end        DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_type ON articles(article_type);
CREATE INDEX idx_articles_scheduled ON articles(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_articles_published ON articles(published_at DESC) WHERE status = 'published';

-- Full-text search on articles
ALTER TABLE articles ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED;
CREATE INDEX idx_articles_fts ON articles USING GIN(fts);

-- Junction: which resources appear in which articles
CREATE TABLE article_resources (
  article_id  UUID REFERENCES articles(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  position    INTEGER DEFAULT 0,
  PRIMARY KEY (article_id, resource_id)
);

CREATE INDEX idx_article_resources_resource ON article_resources(resource_id);

-- Track which resources have been featured in daily articles
ALTER TABLE resources ADD COLUMN IF NOT EXISTS featured_in_daily BOOLEAN DEFAULT FALSE;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS featured_daily_at TIMESTAMPTZ;

-- Updated_at trigger for articles (reuse existing function if available)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_resources ENABLE ROW LEVEL SECURITY;

-- Public can read published articles
CREATE POLICY "Public read articles" ON articles
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public read article_resources" ON article_resources
  FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service write articles" ON articles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service write article_resources" ON article_resources
  FOR ALL TO service_role USING (true) WITH CHECK (true);
