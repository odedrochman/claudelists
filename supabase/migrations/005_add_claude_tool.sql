-- Add claude_tool column for filtering by Claude tool type
ALTER TABLE resources ADD COLUMN IF NOT EXISTS claude_tool text;
