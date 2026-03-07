-- Submissions table for community-submitted resources
CREATE TABLE submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url               TEXT NOT NULL,
  title             TEXT NOT NULL,
  resource_type     TEXT,
  description       TEXT,
  submitter_name    TEXT,
  submitter_twitter TEXT,
  status            TEXT DEFAULT 'pending',
  reviewer_notes    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ
);

CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_created_at ON submissions(created_at DESC);

-- Row-Level Security
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Anon can insert (public form submissions)
CREATE POLICY "Anon insert submissions" ON submissions FOR INSERT TO anon WITH CHECK (true);

-- Anon can select own submission by URL (for duplicate check)
CREATE POLICY "Anon read submissions" ON submissions FOR SELECT TO anon USING (true);

-- Service role full access (for admin operations)
CREATE POLICY "Service write submissions" ON submissions FOR ALL TO service_role USING (true) WITH CHECK (true);
