-- ClaudeLists.com - Initial Database Schema

-- Categories (Claude-specific)
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  description TEXT,
  icon        TEXT,
  color       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name, slug, description, icon, color, sort_order) VALUES
  ('MCP Servers',              'mcp-servers',     'Model Context Protocol servers and integrations',       '🔌', '#8B5CF6', 1),
  ('Prompts & Techniques',     'prompts',         'Prompt engineering, system prompts, and techniques',    '💬', '#3B82F6', 2),
  ('CLAUDE.md & Config',       'claude-config',   'CLAUDE.md files, rules, and agent configurations',     '📝', '#10B981', 3),
  ('Workflows & Automation',   'workflows',       'AI workflows, pipelines, and automation patterns',      '⚙️', '#F59E0B', 4),
  ('Skills & Agents',          'skills-agents',   'Claude skills, agent architectures, and frameworks',    '🤖', '#EF4444', 5),
  ('Tools & Libraries',        'tools',           'Developer tools, SDKs, and libraries for Claude',       '🛠️', '#6366F1', 6),
  ('Tutorials & Guides',       'tutorials',       'How-to guides, walkthroughs, and educational content',  '📚', '#EC4899', 7),
  ('Projects & Showcases',     'showcases',       'Built-with-Claude projects and demos',                  '🚀', '#14B8A6', 8),
  ('News & Announcements',     'news',            'Anthropic updates, releases, and industry news',        '📰', '#64748B', 9),
  ('Discussion & Opinion',     'discussion',      'Community discussions, opinions, and debates',           '💭', '#A855F7', 10);

-- Resources (core table)
CREATE TABLE resources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id          TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL,
  tweet_text        TEXT,
  tweet_url         TEXT NOT NULL,
  author_handle     TEXT NOT NULL,
  author_name       TEXT,
  content_type      TEXT NOT NULL DEFAULT 'tweet',
  category_id       UUID REFERENCES categories(id),
  primary_url       TEXT,
  expanded_links    JSONB DEFAULT '[]',
  extracted_content JSONB,
  media             JSONB DEFAULT '[]',
  engagement        JSONB DEFAULT '{}',
  is_thread         BOOLEAN DEFAULT FALSE,
  is_duplicate      BOOLEAN DEFAULT FALSE,
  related_tweet_ids TEXT[],
  has_downloadable  BOOLEAN DEFAULT FALSE,
  markdown_content  TEXT,
  tweet_created_at  TIMESTAMPTZ,
  discovered_at     TIMESTAMPTZ DEFAULT NOW(),
  posted_to_twitter BOOLEAN DEFAULT FALSE,
  posted_at         TIMESTAMPTZ,
  status            TEXT DEFAULT 'published',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_resources_category ON resources(category_id);
CREATE INDEX idx_resources_content_type ON resources(content_type);
CREATE INDEX idx_resources_status ON resources(status);
CREATE INDEX idx_resources_discovered_at ON resources(discovered_at DESC);
CREATE INDEX idx_resources_tweet_created_at ON resources(tweet_created_at DESC);
CREATE INDEX idx_resources_posted ON resources(posted_to_twitter);
CREATE INDEX idx_resources_downloadable ON resources(has_downloadable) WHERE has_downloadable = TRUE;

-- Full-text search
ALTER TABLE resources ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(tweet_text, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(author_handle, '')), 'D')
  ) STORED;
CREATE INDEX idx_resources_fts ON resources USING GIN(fts);

-- Tags
CREATE TABLE tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resource_tags (
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  tag_id      UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);

CREATE INDEX idx_resource_tags_tag ON resource_tags(tag_id);
CREATE INDEX idx_tags_usage ON tags(usage_count DESC);

-- Auto-posts tracking
CREATE TABLE auto_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id      TEXT,
  tweet_url     TEXT,
  resource_ids  UUID[],
  content       TEXT NOT NULL,
  hashtags      TEXT[],
  status        TEXT DEFAULT 'pending',
  error_message TEXT,
  posted_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline runs (observability)
CREATE TABLE pipeline_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  status              TEXT DEFAULT 'running',
  bookmarks_fetched   INTEGER DEFAULT 0,
  bookmarks_new       INTEGER DEFAULT 0,
  bookmarks_analyzed  INTEGER DEFAULT 0,
  bookmarks_pushed    INTEGER DEFAULT 0,
  error_message       TEXT,
  metadata            JSONB DEFAULT '{}'
);

-- Row-Level Security
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read resources" ON resources FOR SELECT USING (status = 'published');
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read tags" ON tags FOR SELECT USING (true);
CREATE POLICY "Public read resource_tags" ON resource_tags FOR SELECT USING (true);

-- Service role full access (for pipeline writes)
CREATE POLICY "Service write resources" ON resources FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service write categories" ON categories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service write tags" ON tags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service write resource_tags" ON resource_tags FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service write auto_posts" ON auto_posts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service write pipeline_runs" ON pipeline_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
