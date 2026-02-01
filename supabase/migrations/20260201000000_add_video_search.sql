-- Migration: Add Full-Text Search to Videos Table
-- This enables fast, powerful search across video titles and descriptions
-- 
-- Features:
-- - Word stemming (running matches run)
-- - Relevance ranking
-- - Fast indexed searches
-- - Automatic updates when title/description changes

-- Add the full-text search column
-- Uses GENERATED ALWAYS to auto-update when source columns change
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS fts tsvector 
GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
) STORED;

-- Create GIN index for fast full-text search queries
CREATE INDEX IF NOT EXISTS videos_fts_idx ON videos USING GIN (fts);

-- Optional: Add index on title for fast ILIKE fallback searches
CREATE INDEX IF NOT EXISTS videos_title_trgm_idx ON videos USING GIN (title gin_trgm_ops);

-- Grant necessary permissions (adjust role names as needed for your setup)
-- GRANT SELECT ON videos TO authenticated;

COMMENT ON COLUMN videos.fts IS 'Full-text search vector - auto-generated from title (weight A) and description (weight B)';
