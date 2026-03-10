-- Taxonomy Redesign: New categories, renamed categories, new filter columns
-- Based on analysis of 87 resources (taxonomy-report.md)

-- 1. Add new categories
INSERT INTO categories (name, slug, description, icon, color, sort_order) VALUES
  ('Claude Code',           'claude-code',        'Claude Code desktop app setup, features, integrations, and development workflows', '💻', '#0EA5E9', 11),
  ('Claude Cowork',         'claude-cowork',       'Claude Cowork desktop app tutorials, business automation, and real-world applications', '🤝', '#F97316', 12);

-- 2. Rename existing categories to better match user language
UPDATE categories SET name = 'Specialized Prompts', description = 'Domain-specific prompt collections for finance, business, content creation, and analysis' WHERE slug = 'prompts';
UPDATE categories SET name = 'Configuration & Setup', slug = 'config-setup', description = 'CLAUDE.md files, Skills folders, memory configuration, and system optimization' WHERE slug = 'claude-config';
UPDATE categories SET name = 'Official Updates', description = 'Announcements from Anthropic, new features, courses, and platform changes' WHERE slug = 'news';
UPDATE categories SET name = 'Community Content', description = 'Discussions, opinions, market analysis, and community-generated insights' WHERE slug = 'discussion';

-- 3. Add new filter dimension columns to resources
ALTER TABLE resources ADD COLUMN IF NOT EXISTS skill_level TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS content_format TEXT;

-- 4. Add check constraints for valid values
ALTER TABLE resources ADD CONSTRAINT chk_skill_level CHECK (skill_level IS NULL OR skill_level IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE resources ADD CONSTRAINT chk_content_format CHECK (content_format IS NULL OR content_format IN ('video', 'written-guide', 'prompt-collection', 'code-example', 'case-study', 'news', 'discussion'));

-- 5. Create indexes for new filter columns
CREATE INDEX IF NOT EXISTS idx_resources_skill_level ON resources(skill_level);
CREATE INDEX IF NOT EXISTS idx_resources_content_format ON resources(content_format);
