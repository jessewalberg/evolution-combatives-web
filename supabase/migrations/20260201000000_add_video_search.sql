-- Migration: Add Full-Text Search to Videos Table
-- This enables fast, powerful search across video titles, descriptions, and instructors
-- 
-- Features:
-- - Word stemming (running matches run)
-- - Relevance ranking (title > instructor > description)
-- - Fast indexed searches
-- - Automatic updates when source columns change

-- First, create a function to get instructor name for a video
-- This allows us to include instructor name in the search vector
CREATE OR REPLACE FUNCTION get_video_instructor_name(p_instructor_id uuid)
RETURNS text AS $$
    SELECT COALESCE(full_name, '') FROM instructors WHERE id = p_instructor_id;
$$ LANGUAGE sql STABLE;

-- Add the full-text search column with weighted fields:
-- A = title (highest priority)
-- B = instructor name (high priority) 
-- C = description (normal priority)
-- Note: We can't use the function in GENERATED column, so we'll use a trigger instead

-- Drop the column if it exists (in case of re-run)
ALTER TABLE videos DROP COLUMN IF EXISTS fts;

-- Add the fts column (not generated - will be populated by trigger)
ALTER TABLE videos ADD COLUMN fts tsvector;

-- Create function to update the search vector
CREATE OR REPLACE FUNCTION videos_fts_update() RETURNS trigger AS $$
DECLARE
    instructor_name text;
BEGIN
    -- Get instructor name
    SELECT COALESCE(full_name, '') INTO instructor_name 
    FROM instructors 
    WHERE id = NEW.instructor_id;
    
    -- Build the weighted search vector
    NEW.fts := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(instructor_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update fts on insert/update
DROP TRIGGER IF EXISTS videos_fts_update_trigger ON videos;
CREATE TRIGGER videos_fts_update_trigger
    BEFORE INSERT OR UPDATE OF title, description, instructor_id
    ON videos
    FOR EACH ROW
    EXECUTE FUNCTION videos_fts_update();

-- Populate existing videos with search vectors
UPDATE videos SET 
    fts = (
        SELECT 
            setweight(to_tsvector('english', COALESCE(videos.title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(i.full_name, '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(videos.description, '')), 'C')
        FROM instructors i
        WHERE i.id = videos.instructor_id
    );

-- Create GIN index for fast full-text search queries
CREATE INDEX IF NOT EXISTS videos_fts_idx ON videos USING GIN (fts);

-- Index on instructor_id for fast filtering
CREATE INDEX IF NOT EXISTS videos_instructor_id_idx ON videos (instructor_id);

-- Also add FTS to instructors table for instructor search
ALTER TABLE instructors DROP COLUMN IF EXISTS fts;
ALTER TABLE instructors ADD COLUMN fts tsvector 
GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(full_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(bio, '')), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS instructors_fts_idx ON instructors USING GIN (fts);

COMMENT ON COLUMN videos.fts IS 'Full-text search vector - includes title (A), instructor name (B), description (C)';
COMMENT ON COLUMN instructors.fts IS 'Full-text search vector - includes name (A) and bio (B)';