-- Add AI quality score column to resources
-- Score is 1-10, assigned by Claude during analysis
-- Used for default sorting and future "Top Contributors" feature

ALTER TABLE resources ADD COLUMN ai_quality_score INTEGER DEFAULT NULL;

-- Index for sorting by score
CREATE INDEX idx_resources_ai_quality_score ON resources(ai_quality_score DESC NULLS LAST);

-- Comment for documentation
COMMENT ON COLUMN resources.ai_quality_score IS 'Quality/usefulness score (1-10) assigned by Claude during pipeline analysis';
