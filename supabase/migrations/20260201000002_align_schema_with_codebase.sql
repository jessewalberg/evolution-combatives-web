-- Migration: Align database schema with codebase expectations
-- This migration adds missing columns and renames columns to match the codebase

-- ============================================================================
-- 1. user_progress table - rename columns to match codebase expectations
-- ============================================================================

-- Rename watched_seconds to progress_seconds
ALTER TABLE user_progress 
RENAME COLUMN watched_seconds TO progress_seconds;

-- Rename last_watched to last_watched_at  
ALTER TABLE user_progress 
RENAME COLUMN last_watched TO last_watched_at;

-- Add progress_percentage column (computed from progress_seconds / video duration)
ALTER TABLE user_progress 
ADD COLUMN IF NOT EXISTS progress_percentage DECIMAL(5,2) DEFAULT 0;

-- Add completion_date column (timestamp when video was marked complete)
ALTER TABLE user_progress 
ADD COLUMN IF NOT EXISTS completion_date TIMESTAMPTZ;

-- ============================================================================
-- 2. profiles table - add missing columns for user profile editing
-- ============================================================================

-- Add avatar_url for profile pictures
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add bio for user biography/description
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add phone for optional contact number
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- ============================================================================
-- 3. Update any triggers or functions that reference old column names
-- ============================================================================

-- Update the user_progress table's updated_at trigger if it exists
-- (No changes needed if trigger just updates updated_at on any change)

-- ============================================================================
-- 4. Add helpful comments
-- ============================================================================

COMMENT ON COLUMN user_progress.progress_seconds IS 'Number of seconds watched in the video';
COMMENT ON COLUMN user_progress.last_watched_at IS 'Timestamp of when the video was last watched';
COMMENT ON COLUMN user_progress.progress_percentage IS 'Percentage of video completed (0-100)';
COMMENT ON COLUMN user_progress.completion_date IS 'Timestamp when video was marked as completed';

COMMENT ON COLUMN profiles.avatar_url IS 'URL to user profile picture';
COMMENT ON COLUMN profiles.bio IS 'User biography or description';
COMMENT ON COLUMN profiles.phone IS 'User phone number (optional)';
